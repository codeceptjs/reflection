import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SuiteReflection } from '../../src/suite.js'
import { clearCache } from '../../src/parser.js'
import { ReflectionError, UnsupportedSourceError } from '../../src/errors.js'
import { mockSuite } from '../helpers/mock-suite.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

describe('SuiteReflection', () => {
  beforeEach(() => clearCache())

  it('reads a Feature block', () => {
    const sr = new SuiteReflection(mockSuite({ title: 'Auth', file: fix('js/simple.scenario.js') }))
    expect(sr.read()).toBe("Feature('Auth')")
  })

  it('replace returns an Edit', () => {
    const sr = new SuiteReflection(mockSuite({ title: 'Auth', file: fix('js/simple.scenario.js') }))
    const edit = sr.replace("Feature('Authentication')")
    expect(edit.preview()).toContain("Feature('Authentication')")
  })

  it('throws when suite.file is missing', () => {
    const sr = new SuiteReflection(mockSuite({ title: 'Auth' }))
    expect(() => sr.fileName).toThrow(ReflectionError)
  })

  it('throws UnsupportedSourceError on Gherkin files', () => {
    const sr = new SuiteReflection(mockSuite({ title: 'Login', file: fix('gherkin/login.feature') }))
    expect(() => sr.read()).toThrow(UnsupportedSourceError)
  })
})
