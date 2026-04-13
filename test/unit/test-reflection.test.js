import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TestReflection } from '../../src/test.js'
import { clearCache } from '../../src/parser.js'
import { ReflectionError } from '../../src/errors.js'
import { mockTest, mockDataTest } from '../helpers/mock-test.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

describe('TestReflection', () => {
  beforeEach(() => clearCache())

  it('reads the Scenario source block', () => {
    const tr = new TestReflection(
      mockTest({ title: 'login works', file: fix('js/simple.scenario.js') }),
    )
    const src = tr.read()
    expect(src).toContain("Scenario('login works'")
    expect(src).toContain('Welcome')
  })

  it('fileName returns resolved source path', () => {
    const tr = new TestReflection(mockTest({ title: 'login works', file: fix('js/simple.scenario.js') }))
    expect(tr.fileName.endsWith('simple.scenario.js')).toBe(true)
  })

  it('throws when test.file is missing', () => {
    const tr = new TestReflection(mockTest({ title: 'x' }))
    expect(() => tr.fileName).toThrow(ReflectionError)
  })

  it('isDataDriven is false for normal tests', () => {
    const tr = new TestReflection(mockTest({ title: 'plain', file: fix('js/simple.scenario.js') }))
    expect(tr.isDataDriven).toBe(false)
  })

  it('isDataDriven is true when opts.data is present', () => {
    const tr = new TestReflection(
      mockDataTest({ title: 'user logs in', file: fix('js/data-driven.scenario.js'), row: { name: 'alice' } }),
    )
    expect(tr.isDataDriven).toBe(true)
    expect(tr.data).toEqual({ name: 'alice' })
  })

  it('isDataDriven is true when title has data suffix', () => {
    const tr = new TestReflection({
      title: 'x | {"a":1}',
      file: fix('js/simple.scenario.js'),
    })
    expect(tr.isDataDriven).toBe(true)
  })

  it('cleanTitle strips data suffix', () => {
    const tr = new TestReflection({
      title: 'user logs in | {"name":"alice"}',
      file: fix('js/data-driven.scenario.js'),
    })
    expect(tr.cleanTitle).toBe('user logs in')
  })

  it('readDataBlock returns the full Data(...).Scenario(...) block', () => {
    const tr = new TestReflection(
      mockDataTest({ title: 'user logs in', file: fix('js/data-driven.scenario.js'), row: { name: 'alice' } }),
    )
    const block = tr.readDataBlock()
    expect(block.startsWith('Data(')).toBe(true)
    expect(block).toContain(".Scenario('user logs in'")
  })

  it('readDataBlock throws on non-data tests', () => {
    const tr = new TestReflection(mockTest({ title: 'login works', file: fix('js/simple.scenario.js') }))
    expect(() => tr.readDataBlock()).toThrow(ReflectionError)
  })

  it('replace returns an Edit whose preview contains the new code', () => {
    const tr = new TestReflection(mockTest({ title: 'login works', file: fix('js/simple.scenario.js') }))
    const edit = tr.replace("Scenario('login works', async ({ I }) => { I.amOnPage('/x') })")
    const preview = edit.preview()
    expect(preview).toContain("I.amOnPage('/x')")
    expect(preview).not.toContain('Welcome')
  })
})
