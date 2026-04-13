import fs from 'node:fs'
import crypto from 'node:crypto'
import MagicString from 'magic-string'
import { createPatch } from 'diff'
import { StaleEditError, ReflectionError } from './errors.js'
import { atomicWriteFileSync } from './fs-atomic.js'
import { getDefaultParser } from './parser.js'

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

export class Edit {
  constructor({ filePath, source, parsedAtHash, start, end, replacement, eol }) {
    this.filePath = filePath
    this._source = source
    this._parsedAtHash = parsedAtHash
    this._start = start
    this._end = end
    this._replacement = replacement
    this._eol = eol
  }

  get range() {
    return { start: this._start, end: this._end }
  }

  get replacement() {
    return this._replacement
  }

  get isInsert() {
    return this._start === this._end
  }

  preview() {
    const s = new MagicString(this._source)
    const replacement = normalizeEOL(this._replacement, this._eol)
    if (this.isInsert) {
      s.appendLeft(this._start, replacement)
    } else {
      s.overwrite(this._start, this._end, replacement)
    }
    return s.toString()
  }

  diff() {
    return createPatch(this.filePath, this._source, this.preview(), '', '')
  }

  apply({ ignoreStale = false } = {}) {
    let current
    try {
      current = fs.readFileSync(this.filePath, 'utf8')
    } catch (cause) {
      throw new ReflectionError(`Cannot read file for edit: ${this.filePath}`, {
        filePath: this.filePath,
        cause,
      })
    }
    const currentHash = sha1(current)
    if (!ignoreStale && currentHash !== this._parsedAtHash) {
      throw new StaleEditError(
        `File ${this.filePath} changed since the Edit was created. Re-read and retry, or pass { ignoreStale: true }.`,
        { filePath: this.filePath },
      )
    }

    const workingSource = ignoreStale ? current.replace(/^\ufeff/, '') : this._source
    const eol = detectEOL(workingSource)
    const s = new MagicString(workingSource)
    const replacement = normalizeEOL(this._replacement, eol)
    if (this._start === this._end) {
      s.appendLeft(this._start, replacement)
    } else {
      s.overwrite(this._start, this._end, replacement)
    }
    const result = s.toString()

    // Preserve BOM if present
    const hasBOM = current.charCodeAt(0) === 0xfeff
    const out = hasBOM ? '\ufeff' + result : result

    atomicWriteFileSync(this.filePath, out)
    getDefaultParser().invalidate(this.filePath)
    return { filePath: this.filePath }
  }
}
