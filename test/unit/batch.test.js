import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Batch } from '../../src/batch.js'
import { Edit } from '../../src/edit.js'
import { OverlappingEditError, ReflectionError, StaleEditError } from '../../src/errors.js'
import { parseFile, clearCache } from '../../src/parser.js'

function tmp() {
  return path.join(os.tmpdir(), `reflection-batch-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
}

describe('Batch', () => {
  let file

  beforeEach(() => {
    clearCache()
    file = tmp()
    fs.writeFileSync(
      file,
      "Scenario('x', async ({ I }) => {\n  I.click('a')\n  I.click('b')\n})\n",
    )
  })
  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  function editFor(needle, replacement) {
    const parsed = parseFile(file)
    const start = parsed.source.indexOf(needle)
    const end = start + needle.length
    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start,
      end,
      replacement,
      eol: '\n',
    })
  }

  it('empty batch apply is a no-op', () => {
    const batch = new Batch(file)
    expect(batch.apply()).toEqual({ filePath: file, applied: 0 })
  })

  it('applies multiple non-overlapping edits in one write', () => {
    const batch = new Batch(file)
    batch.add(editFor("I.click('a')", "I.click('A')"))
    batch.add(editFor("I.click('b')", "I.click('B')"))
    const result = batch.apply()
    expect(result.applied).toBe(2)
    const written = fs.readFileSync(file, 'utf8')
    expect(written).toContain("I.click('A')")
    expect(written).toContain("I.click('B')")
  })

  it('preview returns the combined result without writing', () => {
    const batch = new Batch(file)
    batch.add(editFor("I.click('a')", "I.click('A')"))
    const preview = batch.preview()
    expect(preview).toContain("I.click('A')")
    expect(fs.readFileSync(file, 'utf8')).not.toContain("I.click('A')")
  })

  it('diff returns a unified diff of the batch', () => {
    const batch = new Batch(file)
    batch.add(editFor("I.click('a')", "I.click('A')"))
    const d = batch.diff()
    expect(d).toContain("-  I.click('a')")
    expect(d).toContain("+  I.click('A')")
  })

  it('throws OverlappingEditError when ranges overlap', () => {
    const batch = new Batch(file)
    batch.add(editFor("I.click('a')", "xxx"))
    // Overlapping edit: a subrange of the first
    const parsed = parseFile(file)
    const start = parsed.source.indexOf("click('a')")
    const overlap = new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start,
      end: start + 5,
      replacement: 'zzz',
      eol: '\n',
    })
    expect(() => batch.add(overlap)).toThrow(OverlappingEditError)
  })

  it('throws ReflectionError on non-edit input', () => {
    const batch = new Batch(file)
    expect(() => batch.add({})).toThrow(ReflectionError)
  })

  it('throws ReflectionError when edit targets a different file', () => {
    const batch = new Batch(file)
    const other = tmp()
    fs.writeFileSync(other, "const a = 1\n")
    try {
      const bad = new Edit({
        filePath: other,
        source: 'const a = 1\n',
        parsedAtHash: 'x',
        start: 0,
        end: 1,
        replacement: 'c',
        eol: '\n',
      })
      expect(() => batch.add(bad)).toThrow(ReflectionError)
    } finally {
      fs.unlinkSync(other)
    }
  })

  it('throws StaleEditError if file changed since batch creation', () => {
    const batch = new Batch(file)
    batch.add(editFor("I.click('a')", "I.click('A')"))
    fs.writeFileSync(file, "// hijacked\n")
    expect(() => batch.apply()).toThrow(StaleEditError)
  })
})
