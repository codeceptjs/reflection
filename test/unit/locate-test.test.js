import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFile, clearCache } from '../../src/parser.js'
import { locateTestByTitle } from '../../src/locate/test.js'
import { NotFoundError, AmbiguousLocateError } from '../../src/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

describe('locateTestByTitle (JS)', () => {
  beforeEach(() => clearCache())

  it('finds a single Scenario by title', () => {
    const parsed = parseFile(fix('js/simple.scenario.js'))
    const r = locateTestByTitle(parsed, { title: 'login works' })
    const block = parsed.source.slice(r.range.start, r.range.end)
    expect(block.startsWith("Scenario('login works'")).toBe(true)
    expect(block.endsWith(')')).toBe(true)
    expect(r.dataBlockRange).toBeNull()
  })

  it('finds a second Scenario in the same file', () => {
    const parsed = parseFile(fix('js/simple.scenario.js'))
    const r = locateTestByTitle(parsed, { title: 'logout works' })
    const block = parsed.source.slice(r.range.start, r.range.end)
    expect(block).toContain("Scenario('logout works'")
    expect(block).toContain('Goodbye')
  })

  it('throws NotFoundError when title does not exist', () => {
    const parsed = parseFile(fix('js/simple.scenario.js'))
    expect(() => locateTestByTitle(parsed, { title: 'no such' })).toThrow(NotFoundError)
  })

  it('throws AmbiguousLocateError on duplicate titles without line hint', () => {
    const parsed = parseFile(fix('js/duplicate-titles.scenario.js'))
    expect(() => locateTestByTitle(parsed, { title: 'check state' })).toThrow(AmbiguousLocateError)
  })

  it('disambiguates duplicate titles by line hint', () => {
    const parsed = parseFile(fix('js/duplicate-titles.scenario.js'))
    // First duplicate is on line 3, second on line 7
    const r = locateTestByTitle(parsed, { title: 'check state', lineHint: 7 })
    const block = parsed.source.slice(r.range.start, r.range.end)
    expect(block).toContain("'/b'")
  })

  it('handles Data().Scenario() and returns an inner range + dataBlockRange', () => {
    const parsed = parseFile(fix('js/data-driven.scenario.js'))
    const r = locateTestByTitle(parsed, { title: 'user logs in' })
    expect(r.dataBlockRange).not.toBeNull()
    const dataBlock = parsed.source.slice(r.dataBlockRange.start, r.dataBlockRange.end)
    expect(dataBlock.startsWith('Data(')).toBe(true)
    expect(dataBlock).toContain(".Scenario('user logs in'")
    const inner = parsed.source.slice(r.range.start, r.range.end)
    expect(inner.startsWith('Scenario(')).toBe(true)
  })

  it('strips data-row suffix from title for matching', () => {
    const parsed = parseFile(fix('js/data-driven.scenario.js'))
    const r = locateTestByTitle(parsed, { title: 'user logs in | {"name":"alice"}' })
    expect(r.dataBlockRange).not.toBeNull()
  })
})

describe('locateTestByTitle (TS)', () => {
  beforeEach(() => clearCache())

  it('finds a Scenario in a TS file', () => {
    const parsed = parseFile(fix('ts/simple.scenario.ts'))
    const r = locateTestByTitle(parsed, { title: 'login works' })
    const block = parsed.source.slice(r.range.start, r.range.end)
    expect(block).toContain("Scenario('login works'")
    expect(block).toContain('Welcome')
  })
})
