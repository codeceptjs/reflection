import { describe, it, expect, beforeEach } from 'vitest'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { Parser, clearCache, parseFile } from '../../src/parser.js'
import { UnsupportedSourceError, ReflectionError } from '../../src/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.resolve(__dirname, '../fixtures')

describe('Parser', () => {
  beforeEach(() => clearCache())

  it('parses a minimal JS file via acorn', () => {
    const p = new Parser()
    const parsed = p.parseFile(path.join(fixtures, 'js/simple.scenario.js'))
    expect(parsed.engine).toBe('acorn')
    expect(parsed.source).toContain("Scenario('login works'")
    expect(parsed.ast.type).toBe('Program')
    expect(parsed.hash).toMatch(/^[a-f0-9]{40}$/)
    expect(parsed.eol).toBe('\n')
  })

  it('caches parsed files by mtime and size', () => {
    const p = new Parser()
    const file = path.join(fixtures, 'js/simple.scenario.js')
    const a = p.parseFile(file)
    const b = p.parseFile(file)
    expect(a).toBe(b)
  })

  it('invalidates cache when file changes', () => {
    const tmp = path.join(os.tmpdir(), `reflection-parser-${Date.now()}.js`)
    fs.writeFileSync(tmp, 'const a = 1\n')
    try {
      const p = new Parser()
      const a = p.parseFile(tmp)
      // ensure mtime differs
      const future = new Date(Date.now() + 2000)
      fs.writeFileSync(tmp, 'const a = 2\n')
      fs.utimesSync(tmp, future, future)
      const b = p.parseFile(tmp)
      expect(b).not.toBe(a)
      expect(b.source).toContain('const a = 2')
    } finally {
      fs.unlinkSync(tmp)
    }
  })

  it('throws UnsupportedSourceError on .feature files', () => {
    const p = new Parser()
    expect(() => p.parseFile(path.join(fixtures, 'gherkin/login.feature'))).toThrow(
      UnsupportedSourceError,
    )
  })

  it('throws UnsupportedSourceError on unknown extensions', () => {
    const tmp = path.join(os.tmpdir(), `reflection-weird-${Date.now()}.xyz`)
    fs.writeFileSync(tmp, 'whatever')
    try {
      const p = new Parser()
      expect(() => p.parseFile(tmp)).toThrow(UnsupportedSourceError)
    } finally {
      fs.unlinkSync(tmp)
    }
  })

  it('strips UTF-8 BOM before parsing', () => {
    const p = new Parser()
    const parsed = p.parseFile(path.join(fixtures, 'edge/bom.scenario.js'))
    expect(parsed.hasBOM).toBe(true)
    expect(parsed.source.charCodeAt(0)).not.toBe(0xfeff)
    expect(parsed.ast.type).toBe('Program')
  })

  it('detects CRLF line endings', () => {
    const p = new Parser()
    const parsed = p.parseFile(path.join(fixtures, 'edge/crlf.scenario.js'))
    expect(parsed.eol).toBe('\r\n')
  })

  it('parses a minimal TS file via typescript (when installed)', () => {
    const p = new Parser()
    const parsed = p.parseFile(path.join(fixtures, 'ts/simple.scenario.ts'))
    expect(parsed.engine).toBe('typescript')
    expect(parsed.ast.fileName).toContain('simple.scenario.ts')
    expect(typeof parsed.ast.getStart).toBe('function')
  })

  it('throws ReflectionError on malformed JS', () => {
    const tmp = path.join(os.tmpdir(), `reflection-bad-${Date.now()}.js`)
    fs.writeFileSync(tmp, 'const = ')
    try {
      const p = new Parser()
      expect(() => p.parseFile(tmp)).toThrow(ReflectionError)
    } finally {
      fs.unlinkSync(tmp)
    }
  })

  it('throws ReflectionError on missing file', () => {
    expect(() => parseFile('/nonexistent/path.js')).toThrow(ReflectionError)
  })

  it('parseFile module-level export uses the default parser', () => {
    const parsed = parseFile(path.join(fixtures, 'js/simple.scenario.js'))
    expect(parsed.engine).toBe('acorn')
  })
})
