import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Reflection } from '../../src/reflection.js'
import { StepReflection } from '../../src/step.js'
import { TestReflection } from '../../src/test.js'
import { SuiteReflection } from '../../src/suite.js'
import { Batch } from '../../src/batch.js'
import { clearCache } from '../../src/parser.js'
import { mockStep } from '../helpers/mock-step.js'
import { mockTest } from '../helpers/mock-test.js'
import { mockSuite } from '../helpers/mock-suite.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

describe('Reflection factory', () => {
  beforeEach(() => clearCache())

  it('forStep returns a StepReflection', () => {
    const sr = Reflection.forStep(
      mockStep({ file: fix('js/simple.scenario.js'), line: 5, column: 3 }),
    )
    expect(sr).toBeInstanceOf(StepReflection)
  })

  it('forStep accepts a test option', () => {
    const file = fix('js/simple.scenario.js')
    const sr = Reflection.forStep(
      mockStep({ file, line: 7, column: 3 }),
      { test: mockTest({ title: 'login works', file }) },
    )
    expect(sr.testTitle).toBe('login works')
  })

  it('forTest returns a TestReflection', () => {
    const tr = Reflection.forTest(mockTest({ title: 'login works', file: fix('js/simple.scenario.js') }))
    expect(tr).toBeInstanceOf(TestReflection)
  })

  it('forSuite returns a SuiteReflection', () => {
    const sr = Reflection.forSuite(mockSuite({ title: 'Auth', file: fix('js/simple.scenario.js') }))
    expect(sr).toBeInstanceOf(SuiteReflection)
  })

  it('batch returns a Batch bound to the given file', () => {
    const batch = Reflection.batch(fix('js/simple.scenario.js'))
    expect(batch).toBeInstanceOf(Batch)
    expect(batch.filePath).toContain('simple.scenario.js')
  })

  it('configure accepts tsFileMapping', () => {
    expect(() => Reflection.configure({ tsFileMapping: new Map() })).not.toThrow()
  })

  it('clearCache clears the parser cache', () => {
    Reflection.forTest(mockTest({ title: 'login works', file: fix('js/simple.scenario.js') })).read()
    expect(() => Reflection.clearCache()).not.toThrow()
  })
})
