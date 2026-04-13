import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import * as acorn from 'acorn'
import MagicString from 'magic-string'
import { UnsupportedSourceError, MissingPeerError, ReflectionError } from './errors.js'
import { resolveSourceFile } from './source-path.js'

const require = createRequire(import.meta.url)

let tsLib = null
function loadTypeScript() {
  if (tsLib) return tsLib
  try {
    tsLib = require('typescript')
    return tsLib
  } catch (cause) {
    throw new MissingPeerError(
      'TypeScript support requires installing the "typescript" package as a peer dependency',
      { cause },
    )
  }
}

export function __resetTypeScriptCache() {
  tsLib = null
}

const JS_EXTS = new Set(['.js', '.mjs', '.cjs'])
const TS_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts'])
const FEATURE_EXTS = new Set(['.feature'])

function detectEngine(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (JS_EXTS.has(ext)) return 'acorn'
  if (TS_EXTS.has(ext)) return 'typescript'
  if (FEATURE_EXTS.has(ext)) return 'gherkin'
  return null
}

function stripBOM(str) {
  if (str.charCodeAt(0) === 0xfeff) return str.slice(1)
  return str
}

function detectEOL(source) {
  const firstLF = source.indexOf('\n')
  if (firstLF === -1) return '\n'
  return source[firstLF - 1] === '\r' ? '\r\n' : '\n'
}

export class Parser {
  constructor() {
    this.cache = new Map()
  }

  parseFile(filePath) {
    const resolved = resolveSourceFile(filePath)
    const cached = this.cache.get(resolved)
    let stat
    try {
      stat = fs.statSync(resolved)
    } catch (cause) {
      throw new ReflectionError(`Cannot stat source file: ${resolved}`, { filePath: resolved, cause })
    }
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached
    }

    const engine = detectEngine(resolved)
    if (engine === null) {
      throw new UnsupportedSourceError(
        `Unsupported source file extension: ${path.extname(resolved) || '(none)'}`,
        { filePath: resolved },
      )
    }
    if (engine === 'gherkin') {
      throw new UnsupportedSourceError(
        'Gherkin .feature files are not supported. Reflect the step definition file instead.',
        { filePath: resolved },
      )
    }

    const raw = fs.readFileSync(resolved, 'utf8')
    const hasBOM = raw.charCodeAt(0) === 0xfeff
    const source = stripBOM(raw)
    const hash = crypto.createHash('sha1').update(raw).digest('hex')
    const eol = detectEOL(source)

    let ast
    if (engine === 'acorn') {
      try {
        ast = acorn.parse(source, {
          ecmaVersion: 'latest',
          sourceType: 'unambiguous',
          locations: true,
          ranges: true,
          allowHashBang: true,
          allowAwaitOutsideFunction: true,
          allowReturnOutsideFunction: true,
          allowImportExportEverywhere: true,
        })
      } catch (cause) {
        throw new ReflectionError(`Failed to parse JavaScript file: ${resolved} — ${cause.message}`, {
          filePath: resolved,
          cause,
        })
      }
    } else {
      const ts = loadTypeScript()
      const ext = path.extname(resolved).toLowerCase()
      const kind = ext === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      try {
        ast = ts.createSourceFile(resolved, source, ts.ScriptTarget.Latest, true, kind)
      } catch (cause) {
        throw new ReflectionError(`Failed to parse TypeScript file: ${resolved} — ${cause.message}`, {
          filePath: resolved,
          cause,
        })
      }
    }

    const magicString = new MagicString(source)

    const entry = {
      filePath: resolved,
      originalPath: filePath,
      source,
      rawSource: raw,
      ast,
      magicString,
      engine,
      hash,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      hasBOM,
      eol,
    }
    this.cache.set(resolved, entry)
    return entry
  }

  invalidate(filePath) {
    const resolved = resolveSourceFile(filePath)
    this.cache.delete(resolved)
  }

  clear() {
    this.cache.clear()
  }
}

const defaultParser = new Parser()
export function parseFile(filePath) {
  return defaultParser.parseFile(filePath)
}
export function invalidateFile(filePath) {
  defaultParser.invalidate(filePath)
}
export function clearCache() {
  defaultParser.clear()
}
export function getDefaultParser() {
  return defaultParser
}
