import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveSourceFile, configure, resetConfiguration } from '../../src/source-path.js'

describe('resolveSourceFile', () => {
  beforeEach(() => resetConfiguration())
  afterEach(() => resetConfiguration())

  it('returns non-.temp.mjs paths unchanged', () => {
    expect(resolveSourceFile('/a/b/test.js')).toBe('/a/b/test.js')
    expect(resolveSourceFile('/a/b/test.ts')).toBe('/a/b/test.ts')
  })

  it('maps .temp.mjs to .ts via injected mapping', () => {
    const map = new Map([
      ['/project/src/test.ts', '/project/.codeceptjs/test.temp.mjs'],
    ])
    configure({ tsFileMapping: map })
    expect(resolveSourceFile('/project/.codeceptjs/test.temp.mjs')).toBe('/project/src/test.ts')
  })

  it('returns .temp.mjs as-is when no mapping found', () => {
    configure({ tsFileMapping: new Map() })
    expect(resolveSourceFile('/nowhere/x.temp.mjs')).toBe('/nowhere/x.temp.mjs')
  })

  it('handles empty/null input', () => {
    expect(resolveSourceFile('')).toBe('')
    expect(resolveSourceFile(null)).toBe(null)
  })
})
