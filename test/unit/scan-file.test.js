import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Reflection } from '../../src/reflection.js'
import { SuiteReflection } from '../../src/suite.js'
import { clearCache } from '../../src/parser.js'
import { NotFoundError, AmbiguousLocateError, UnsupportedSourceError } from '../../src/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

function tmp(contents, ext = '.js') {
  const p = path.join(os.tmpdir(), `reflection-scan-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  fs.writeFileSync(p, contents)
  return p
}

describe('Reflection.scanFile', () => {
  beforeEach(() => clearCache())

  it('returns suites and tests for a single-Feature file', () => {
    const { suites, tests } = Reflection.scanFile(fix('js/simple.scenario.js'))
    expect(suites).toHaveLength(1)
    expect(suites[0].title).toBe('Auth')
    expect(suites[0].line).toBeGreaterThan(0)
    expect(suites[0].range.start).toBeLessThan(suites[0].range.end)

    expect(tests.map(t => t.title)).toEqual(['login works', 'logout works'])
    for (const t of tests) {
      expect(t.suite).toBe('Auth')
      expect(t.file).toBe(suites[0].file)
    }
  })

  it('assigns each test to its parent suite in multi-Feature files', () => {
    const { suites, tests } = Reflection.scanFile(fix('js/multi-suite.scenario.js'))
    expect(suites.map(s => s.title)).toEqual(['First', 'Second'])
    const bySuite = new Map()
    for (const t of tests) {
      if (!bySuite.has(t.suite)) bySuite.set(t.suite, [])
      bySuite.get(t.suite).push(t.title)
    }
    expect(bySuite.get('First')).toEqual(['a1', 'a2'])
    expect(bySuite.get('Second')).toEqual(['b1'])
  })

  it('returns empty suites and tests for a file with neither', () => {
    const file = tmp('const x = 1\n')
    try {
      const { suites, tests } = Reflection.scanFile(file)
      expect(suites).toEqual([])
      expect(tests).toEqual([])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('works on .ts scenario files', () => {
    const { suites, tests } = Reflection.scanFile(fix('ts/simple.scenario.ts'))
    expect(suites.map(s => s.title)).toEqual(['Auth'])
    expect(tests.map(t => t.title)).toEqual(['login works', 'typed logout'])
  })

  it('propagates UnsupportedSourceError for Gherkin .feature files', () => {
    expect(() => Reflection.scanFile(fix('gherkin/login.feature'))).toThrow(UnsupportedSourceError)
  })
})

describe('Reflection.forSuite auto-title', () => {
  beforeEach(() => clearCache())

  it('auto-detects the single Feature when only one exists in the file', () => {
    const sur = Reflection.forSuite({ file: fix('js/simple.scenario.js') })
    expect(sur).toBeInstanceOf(SuiteReflection)
    expect(sur.title).toBe('Auth')
    const block = sur.read()
    expect(block).toBe("Feature('Auth')")
  })

  it('accepts a bare file path string as shorthand', () => {
    const sur = Reflection.forSuite(fix('js/simple.scenario.js'))
    expect(sur.title).toBe('Auth')
  })

  it('lists hooks and tests after auto-detection', () => {
    const file = tmp(
      `Feature('Auto')

BeforeSuite(async () => {})

Scenario('first', async ({ I }) => { I.amOnPage('/') })
Scenario('second', async ({ I, loginPage }) => { loginPage.open() })
`,
    )
    try {
      const sur = Reflection.forSuite({ file })
      expect(sur.title).toBe('Auto')
      expect(sur.tests.map(t => t.title)).toEqual(['first', 'second'])
      expect(sur.hooks.map(h => h.kind)).toEqual(['BeforeSuite'])
      expect(sur.dependencies.sort()).toEqual(['I', 'loginPage'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('throws AmbiguousLocateError when the file has multiple Features', () => {
    const file = fix('js/multi-suite.scenario.js')
    const sur = Reflection.forSuite({ file })
    let thrown
    try { sur.title } catch (e) { thrown = e }
    expect(thrown).toBeInstanceOf(AmbiguousLocateError)
    expect(thrown.candidates).toHaveLength(2)
    expect(thrown.candidates.map(c => c.title).sort()).toEqual(['First', 'Second'])
  })

  it('disambiguates with an explicit title when multiple Features exist', () => {
    const sur = Reflection.forSuite({ title: 'Second', file: fix('js/multi-suite.scenario.js') })
    expect(sur.title).toBe('Second')
    expect(sur.tests.map(t => t.title)).toEqual(['b1'])
  })

  it('throws NotFoundError for a file with no Feature', () => {
    const file = tmp('const x = 1\n')
    try {
      const sur = Reflection.forSuite({ file })
      expect(() => sur.title).toThrow(NotFoundError)
    } finally {
      fs.unlinkSync(file)
    }
  })
})
