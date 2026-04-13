import fs from 'node:fs'
import crypto from 'node:crypto'
import MagicString from 'magic-string'
import { createPatch } from 'diff'
import { StaleEditError, OverlappingEditError, ReflectionError } from './errors.js'
import { atomicWriteFileSync } from './fs-atomic.js'
import { getDefaultParser, parseFile } from './parser.js'

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex')
}

function detectEOL(source) {
  const idx = source.indexOf('\n')
  if (idx === -1) return '\n'
  return source[idx - 1] === '\r' ? '\r\n' : '\n'
}

function normalizeEOL(text, targetEOL) {
  const unified = text.replace(/\r\n/g, '\n')
  if (targetEOL === '\n') return unified
  return unified.replace(/\n/g, '\r\n')
}

export class Batch {
  constructor(filePath) {
    this.filePath = filePath
    this._edits = []
    this._parsed = parseFile(filePath)
  }

  get size() {
    return this._edits.length
  }

  add(edit) {
    if (!edit || typeof edit.apply !== 'function') {
      throw new ReflectionError('Batch.add requires an Edit instance', { filePath: this.filePath })
    }
    if (edit.filePath !== this._parsed.filePath && edit.filePath !== this.filePath) {
      throw new ReflectionError(
        `Edit file ${edit.filePath} does not match batch file ${this.filePath}`,
        { filePath: this.filePath },
      )
    }
    for (const existing of this._edits) {
      if (rangesOverlap(existing.range, edit.range)) {
        throw new OverlappingEditError(
          `Edit ranges overlap in ${this.filePath}: [${existing.range.start},${existing.range.end}) vs [${edit.range.start},${edit.range.end})`,
          { filePath: this.filePath },
        )
      }
    }
    this._edits.push(edit)
    return this
  }

  _build(source) {
    const eol = detectEOL(source)
    const s = new MagicString(source)
    for (const edit of this._edits) {
      const replacement = normalizeEOL(edit.replacement, eol)
      if (edit.range.start === edit.range.end) {
        s.appendLeft(edit.range.start, replacement)
      } else {
        s.overwrite(edit.range.start, edit.range.end, replacement)
      }
    }
    return s.toString()
  }

  preview() {
    return this._build(this._parsed.source)
  }

  diff() {
    return createPatch(this.filePath, this._parsed.source, this.preview(), '', '')
  }

  apply({ ignoreStale = false } = {}) {
    if (this._edits.length === 0) return { filePath: this.filePath, applied: 0 }

    let current
    try {
      current = fs.readFileSync(this.filePath, 'utf8')
    } catch (cause) {
      throw new ReflectionError(`Cannot read file for batch apply: ${this.filePath}`, {
        filePath: this.filePath,
        cause,
      })
    }
    const currentHash = sha1(current)
    if (!ignoreStale && currentHash !== this._parsed.hash) {
      throw new StaleEditError(
        `File ${this.filePath} changed since the batch was created. Re-read and retry, or pass { ignoreStale: true }.`,
        { filePath: this.filePath },
      )
    }

    const hasBOM = current.charCodeAt(0) === 0xfeff
    const workingSource = current.replace(/^\ufeff/, '')
    const result = this._build(workingSource)
    const out = hasBOM ? '\ufeff' + result : result
    atomicWriteFileSync(this.filePath, out)
    getDefaultParser().invalidate(this.filePath)
    return { filePath: this.filePath, applied: this._edits.length }
  }
}

function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end
}
