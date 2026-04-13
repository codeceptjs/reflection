import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StepReflection } from '../../src/step.js'
import { clearCache } from '../../src/parser.js'
import { ReflectionError } from '../../src/errors.js'
import { mockStep } from '../helpers/mock-step.js'
import { mockTest } from '../helpers/mock-test.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

describe('StepReflection', () => {
  beforeEach(() => clearCache())

  it('resolves fileName from step.stack', () => {
    const file = fix('js/simple.scenario.js')
    const sr = new StepReflection(mockStep({ file, line: 5, column: 3 }))
    expect(sr.fileName).toBe(file)
    expect(sr.line).toBe(5)
    expect(sr.column).toBe(3)
  })

  it('read() returns the step source', () => {
    const file = fix('js/simple.scenario.js')
    const sr = new StepReflection(mockStep({ file, line: 7, column: 3 }))
    expect(sr.read()).toContain("I.click('Sign in')")
  })

  it('readFunction() returns the enclosing scenario body', () => {
    const file = fix('js/simple.scenario.js')
    const sr = new StepReflection(mockStep({ file, line: 7, column: 3 }))
    const fn = sr.readFunction()
    expect(fn).toContain('I.amOnPage')
    expect(fn).toContain('I.see')
  })

  it('readTest() returns the full Scenario call', () => {
    const file = fix('js/simple.scenario.js')
    const sr = new StepReflection(mockStep({ file, line: 7, column: 3 }))
    const test = sr.readTest()
    expect(test.startsWith("Scenario('login works'")).toBe(true)
  })

  it('isSupportObject is false when metaStep is null', () => {
    const sr = new StepReflection(mockStep({ file: fix('js/simple.scenario.js'), line: 5, column: 3 }))
    expect(sr.isSupportObject).toBe(false)
  })

  it('isSupportObject is true when metaStep is set', () => {
    const sr = new StepReflection(
      mockStep({
        file: fix('js/simple.scenario.js'),
        line: 5,
        column: 3,
        metaStep: { name: 'login' },
      }),
    )
    expect(sr.isSupportObject).toBe(true)
  })

  it('testFileName comes from test.file when provided', () => {
    const file = fix('js/simple.scenario.js')
    const sr = new StepReflection(
      mockStep({ file, line: 5, column: 3 }),
      { test: mockTest({ title: 'login works', file }) },
    )
    expect(sr.testFileName).toBe(file)
    expect(sr.testTitle).toBe('login works')
  })

  it('testFileName is null without a test', () => {
    const sr = new StepReflection(mockStep({ file: fix('js/simple.scenario.js'), line: 5, column: 3 }))
    expect(sr.testFileName).toBeNull()
  })

  it('replace() returns a working Edit', () => {
    const file = fix('js/simple.scenario.js')
    const sr = new StepReflection(mockStep({ file, line: 7, column: 3 }))
    const edit = sr.replace("I.click('Submit')")
    const preview = edit.preview()
    expect(preview).toContain("I.click('Submit')")
    expect(preview).not.toContain("I.click('Sign in')")
  })

  it('throws when step is missing', () => {
    expect(() => new StepReflection(null)).toThrow(ReflectionError)
  })
})
