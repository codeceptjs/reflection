import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFile, clearCache } from '../../src/parser.js'
import { locateSuiteByTitle } from '../../src/locate/suite.js'
import { NotFoundError } from '../../src/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

describe('locateSuiteByTitle (JS)', () => {
  beforeEach(() => clearCache())

  it('finds a Feature by title', () => {
    const parsed = parseFile(fix('js/simple.scenario.js'))
    const r = locateSuiteByTitle(parsed, { title: 'Auth' })
    const src = parsed.source.slice(r.range.start, r.range.end)
    expect(src).toBe("Feature('Auth')")
  })

  it('throws NotFoundError when Feature is missing', () => {
    const parsed = parseFile(fix('js/simple.scenario.js'))
    expect(() => locateSuiteByTitle(parsed, { title: 'NoSuch' })).toThrow(NotFoundError)
  })
})

describe('locateSuiteByTitle (TS)', () => {
  beforeEach(() => clearCache())

  it('finds a Feature in a TS file', () => {
    const parsed = parseFile(fix('ts/simple.scenario.ts'))
    const r = locateSuiteByTitle(parsed, { title: 'Auth' })
    const src = parsed.source.slice(r.range.start, r.range.end)
    expect(src).toContain("Feature('Auth')")
  })
})
