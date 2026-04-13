import { parseFile } from './parser.js'
import { resolveSourceFile } from './source-path.js'
import { locateSuiteByTitle, collectSuiteStatements, HOOK_KINDS } from './locate/suite.js'
import { extractScenarioDepsJS, extractScenarioDepsTS } from './locate/deps.js'
import { Edit } from './edit.js'
import { ReflectionError, NotFoundError, AmbiguousLocateError } from './errors.js'

export { HOOK_KINDS }

export class SuiteReflection {
  constructor(suite) {
    if (!suite) throw new ReflectionError('SuiteReflection requires a suite')
    this._suite = suite
    this._parsedCache = null
    this._locateCache = null
    this._statementsCache = null
  }

  get fileName() {
    if (!this._suite.file) {
      throw new ReflectionError('suite.file is not set — cannot resolve source file', {})
    }
    return resolveSourceFile(this._suite.file)
  }

  get title() {
    return this._suite.title
  }

  get tags() {
    return this._suite.tags || []
  }

  get meta() {
    return this._suite.meta || {}
  }

  _parsed() {
    if (!this._parsedCache) this._parsedCache = parseFile(this.fileName)
    return this._parsedCache
  }

  _locate() {
    if (!this._locateCache) {
      this._locateCache = locateSuiteByTitle(this._parsed(), { title: this.title })
    }
    return this._locateCache
  }

  _statements() {
    if (this._statementsCache) return this._statementsCache
    const parsed = this._parsed()
    const { node } = this._locate()
    this._statementsCache = collectSuiteStatements(parsed, node)
    return this._statementsCache
  }

  get tests() {
    const { scenarios } = this._statements()
    return scenarios.map(s => ({
      title: s.title,
      range: s.range,
    }))
  }

  get hooks() {
    const { hooks } = this._statements()
    return hooks.map(h => ({
      kind: h.kind,
      line: h.line,
      range: h.range,
    }))
  }

  findHook(kind) {
    return this.hooks.filter(h => h.kind === kind)
  }

  get dependencies() {
    const parsed = this._parsed()
    const { scenarios } = this._statements()
    const extract = parsed.engine === 'acorn' ? extractScenarioDepsJS : extractScenarioDepsTS
    const set = new Set()
    for (const s of scenarios) {
      for (const dep of extract(s.call)) set.add(dep)
    }
    return Array.from(set)
  }

  read() {
    const parsed = this._parsed()
    const { range } = this._locate()
    return parsed.source.slice(range.start, range.end)
  }

  replace(newCode) {
    const parsed = this._parsed()
    const { range } = this._locate()
    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start: range.start,
      end: range.end,
      replacement: newCode,
      eol: parsed.eol,
    })
  }

  addTest(code, { position = 'end' } = {}) {
    const parsed = this._parsed()
    const { featureStmt, scenarios, suiteEnd } = this._statements()
    const eol = parsed.eol

    let insertPos
    if (position === 'start') {
      insertPos = featureStmt ? featureStmt.end : this._locate().range.end
    } else if (scenarios.length > 0) {
      insertPos = scenarios[scenarios.length - 1].range.end
    } else {
      insertPos = featureStmt ? featureStmt.end : this._locate().range.end
    }
    // Clamp to within the suite's range (don't leak into the next Feature)
    if (insertPos > suiteEnd) insertPos = suiteEnd

    const trimmed = code.replace(/[\r\n]+$/, '')
    const replacement = eol + eol + trimmed + eol

    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start: insertPos,
      end: insertPos,
      replacement,
      eol,
    })
  }

  removeTest(title) {
    const parsed = this._parsed()
    const { scenarios } = this._statements()
    const match = scenarios.find(s => s.title === title)
    if (!match) {
      throw new NotFoundError(
        `No Scenario titled "${title}" in suite "${this.title}" in ${parsed.filePath}`,
        { filePath: parsed.filePath },
      )
    }
    return this._buildRemoveEdit(parsed, match)
  }

  addHook(kind, code, { position = 'afterHooks' } = {}) {
    if (!HOOK_KINDS.includes(kind)) {
      throw new ReflectionError(
        `addHook: unknown hook kind "${kind}". Expected one of: ${HOOK_KINDS.join(', ')}`,
      )
    }
    const parsed = this._parsed()
    const { featureStmt, hooks, suiteEnd } = this._statements()
    const eol = parsed.eol

    let insertPos
    if (position === 'afterFeature' || hooks.length === 0) {
      insertPos = featureStmt ? featureStmt.end : this._locate().range.end
    } else {
      insertPos = hooks[hooks.length - 1].range.end
    }
    if (insertPos > suiteEnd) insertPos = suiteEnd

    const trimmed = code.replace(/[\r\n]+$/, '')
    const replacement = eol + eol + trimmed + eol

    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start: insertPos,
      end: insertPos,
      replacement,
      eol,
    })
  }

  removeHook(kind, { index } = {}) {
    const parsed = this._parsed()
    const match = this._pickHook(kind, index, parsed.filePath)
    return this._buildRemoveEdit(parsed, match)
  }

  replaceHook(kind, code, { index } = {}) {
    const parsed = this._parsed()
    const match = this._pickHook(kind, index, parsed.filePath)
    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start: match.range.start,
      end: match.range.end,
      replacement: code.replace(/[\r\n]+$/, ''),
      eol: parsed.eol,
    })
  }

  _pickHook(kind, index, filePath) {
    if (!HOOK_KINDS.includes(kind)) {
      throw new ReflectionError(
        `Unknown hook kind "${kind}". Expected one of: ${HOOK_KINDS.join(', ')}`,
        { filePath },
      )
    }
    const { hooks } = this._statements()
    const matches = hooks.filter(h => h.kind === kind)
    if (matches.length === 0) {
      throw new NotFoundError(
        `No ${kind} hook found in suite "${this.title}" in ${filePath}`,
        { filePath },
      )
    }
    if (index != null) {
      if (index < 0 || index >= matches.length) {
        throw new NotFoundError(
          `${kind} hook index ${index} out of range (0..${matches.length - 1})`,
          { filePath },
        )
      }
      return matches[index]
    }
    if (matches.length > 1) {
      throw new AmbiguousLocateError(
        `Multiple ${kind} hooks in suite "${this.title}". Pass { index } to disambiguate.`,
        {
          filePath,
          candidates: matches.map(m => ({ start: m.range.start, end: m.range.end, line: m.line })),
        },
      )
    }
    return matches[0]
  }

  _buildRemoveEdit(parsed, match) {
    const eol = parsed.eol
    let start = match.range.start
    let end = match.range.end
    if (parsed.source.slice(end, end + eol.length) === eol) end += eol.length
    if (
      parsed.source.slice(start - eol.length, start) === eol &&
      parsed.source.slice(start - 2 * eol.length, start - eol.length) === eol
    ) {
      start -= eol.length
    }
    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start,
      end,
      replacement: '',
      eol,
    })
  }
}
