import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { Edit } from '../../src/edit.js'
import { StaleEditError } from '../../src/errors.js'
import { clearCache } from '../../src/parser.js'

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex')
}

function tmp(suffix = '.js') {
  return path.join(os.tmpdir(), `reflection-edit-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`)
}

describe('Edit', () => {
  let file
  let source
  let hash

  beforeEach(() => {
    clearCache()
    file = tmp()
    source = "Scenario('x', async ({ I }) => {\n  I.click('a')\n})\n"
    fs.writeFileSync(file, source)
    hash = sha1(source)
  })
  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  function makeEdit(opts = {}) {
    // Replace I.click('a') with I.click('b')
    const start = source.indexOf("I.click('a')")
    const end = start + "I.click('a')".length
    return new Edit({
      filePath: file,
      source,
      parsedAtHash: hash,
      start,
      end,
      replacement: "I.click('b')",
      eol: '\n',
      ...opts,
    })
  }

  it('preview returns modified source without writing', () => {
    const edit = makeEdit()
    const preview = edit.preview()
    expect(preview).toContain("I.click('b')")
    expect(preview).not.toContain("I.click('a')")
    expect(fs.readFileSync(file, 'utf8')).toBe(source)
  })

  it('diff returns a unified diff', () => {
    const edit = makeEdit()
    const d = edit.diff()
    expect(d).toContain("-  I.click('a')")
    expect(d).toContain("+  I.click('b')")
  })

  it('apply writes the new content atomically', () => {
    const edit = makeEdit()
    const result = edit.apply()
    expect(result.filePath).toBe(file)
    expect(fs.readFileSync(file, 'utf8')).toContain("I.click('b')")
  })

  it('apply throws StaleEditError if file changed', () => {
    const edit = makeEdit()
    fs.writeFileSync(file, "// something else\n")
    expect(() => edit.apply()).toThrow(StaleEditError)
  })

  it('apply accepts ignoreStale: true', () => {
    // This test uses a changed file where ignoreStale should force-write using current content
    const edit = makeEdit()
    // Simulate a harmless change in whitespace/comments: keep the target text intact
    const altered = source.replace("Scenario('x'", "Scenario('x' /* note */")
    fs.writeFileSync(file, altered)
    expect(() => edit.apply({ ignoreStale: true })).not.toThrow()
    expect(fs.readFileSync(file, 'utf8')).toContain("I.click('b')")
    expect(fs.readFileSync(file, 'utf8')).toContain('/* note */')
  })

  it('normalizes CRLF in replacement when file is CRLF', () => {
    const crlfSource = "Scenario('x', async ({ I }) => {\r\n  I.click('a')\r\n})\r\n"
    fs.writeFileSync(file, crlfSource)
    const newHash = sha1(crlfSource)
    const start = crlfSource.indexOf("I.click('a')")
    const end = start + "I.click('a')".length
    const edit = new Edit({
      filePath: file,
      source: crlfSource,
      parsedAtHash: newHash,
      start,
      end,
      // replacement with LF-only newlines
      replacement: "I.click('b')\n  I.see('ok')",
      eol: '\r\n',
    })
    edit.apply()
    const written = fs.readFileSync(file, 'utf8')
    expect(written).toContain("I.click('b')\r\n  I.see('ok')")
  })

  it('supports zero-width insert (start === end) via appendLeft', () => {
    const src = "Scenario('x', async ({ I }) => {\n})\n"
    const newFile = tmp()
    fs.writeFileSync(newFile, src)
    try {
      const pos = src.indexOf('})')
      const edit = new (makeEdit().constructor)({
        filePath: newFile,
        source: src,
        parsedAtHash: sha1(src),
        start: pos,
        end: pos,
        replacement: "  I.amOnPage('/')\n",
        eol: '\n',
      })
      expect(edit.isInsert).toBe(true)
      const preview = edit.preview()
      expect(preview).toContain("I.amOnPage('/')")
      expect(preview).toContain("Scenario('x'")
      edit.apply()
      const written = fs.readFileSync(newFile, 'utf8')
      expect(written).toContain("I.amOnPage('/')")
    } finally {
      fs.unlinkSync(newFile)
    }
  })

  it('supports deletion via empty-string replacement', () => {
    const del = new (makeEdit().constructor)({
      filePath: file,
      source,
      parsedAtHash: hash,
      start: source.indexOf("  I.click('a')\n"),
      end: source.indexOf("  I.click('a')\n") + "  I.click('a')\n".length,
      replacement: '',
      eol: '\n',
    })
    const preview = del.preview()
    expect(preview).not.toContain("I.click('a')")
    expect(preview).toContain("Scenario('x'")
  })

  it('preserves BOM when present', () => {
    const bomSource = '\ufeff' + source
    fs.writeFileSync(file, bomSource)
    const newHash = sha1(bomSource)
    const start = bomSource.indexOf("I.click('a')")
    const end = start + "I.click('a')".length
    const edit = new Edit({
      filePath: file,
      source: bomSource.replace('\ufeff', ''),
      parsedAtHash: newHash,
      start: start - 1,
      end: end - 1,
      replacement: "I.click('b')",
      eol: '\n',
    })
    edit.apply()
    const written = fs.readFileSync(file, 'utf8')
    expect(written.charCodeAt(0)).toBe(0xfeff)
    expect(written).toContain("I.click('b')")
  })
})
