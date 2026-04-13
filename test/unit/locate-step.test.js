import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFile, clearCache } from '../../src/parser.js'
import { locateStepByPosition } from '../../src/locate/step.js'
import { NotFoundError, AmbiguousLocateError } from '../../src/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

describe('locateStepByPosition (JS)', () => {
  beforeEach(() => clearCache())

  it('locates a step inside a Scenario arrow body', () => {
    const parsed = parseFile(fix('js/simple.scenario.js'))
    // I.click('Sign in') is at line 7 in simple.scenario.js
    const r = locateStepByPosition(parsed, { line: 7, column: 3 })
    const stepSource = parsed.source.slice(r.stepRange.start, r.stepRange.end)
    expect(stepSource).toContain("I.click('Sign in')")
    // enclosing function should cover the whole arrow body
    expect(r.functionRange).not.toBeNull()
    const fn = parsed.source.slice(r.functionRange.start, r.functionRange.end)
    expect(fn).toContain('I.amOnPage')
    expect(fn).toContain('I.see')
    // enclosing test should be the Scenario call
    const test = parsed.source.slice(r.testRange.start, r.testRange.end)
    expect(test.startsWith("Scenario('login works'")).toBe(true)
  })

  it('locates a step in an async function scenario', () => {
    const parsed = parseFile(fix('js/arrow-and-function.scenario.js'))
    const r = locateStepByPosition(parsed, { line: 8, column: 3 })
    const src = parsed.source.slice(r.stepRange.start, r.stepRange.end)
    expect(src).toContain("I.amOnPage('/')")
  })

  it('throws NotFoundError when line has no call', () => {
    const parsed = parseFile(fix('js/simple.scenario.js'))
    expect(() => locateStepByPosition(parsed, { line: 100, column: 1 })).toThrow(NotFoundError)
  })

  it('disambiguates multiple steps on same line via column', () => {
    const parsed = parseFile(fix('js/multiple-steps-line.scenario.js'))
    // Source: "  I.click('a'); I.click('b')" on line 4
    // 1-based column for I.click('b') starts around column 19
    const firstCall = locateStepByPosition(parsed, { line: 4, column: 4 })
    const src1 = parsed.source.slice(firstCall.stepRange.start, firstCall.stepRange.end)
    expect(src1).toBe("I.click('a')")

    const secondCall = locateStepByPosition(parsed, { line: 4, column: 20 })
    const src2 = parsed.source.slice(secondCall.stepRange.start, secondCall.stepRange.end)
    expect(src2).toBe("I.click('b')")
  })
})

describe('locateStepByPosition (TS)', () => {
  beforeEach(() => clearCache())

  it('locates a step in a TS scenario', () => {
    const parsed = parseFile(fix('ts/simple.scenario.ts'))
    // "I.click('Sign in')" is on line 6 in ts fixture
    const r = locateStepByPosition(parsed, { line: 6, column: 3 })
    const src = parsed.source.slice(r.stepRange.start, r.stepRange.end)
    expect(src).toContain("I.click('Sign in')")
    expect(r.testRange).not.toBeNull()
  })
})
