import { parseFile } from './parser.js'
import { resolveSourceFile } from './source-path.js'
import { locateSuiteByTitle, collectSuiteStatements } from './locate/suite.js'
import { extractScenarioDepsJS, extractScenarioDepsTS } from './locate/deps.js'
import { Edit } from './edit.js'
import { ReflectionError, NotFoundError } from './errors.js'

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
    const eol = parsed.eol
    let start = match.range.start
    let end = match.range.end
    // Eat one trailing newline so the surrounding blank line becomes the new separator
    if (parsed.source.slice(end, end + eol.length) === eol) end += eol.length
    // If there was a preceding blank line, eat that too
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
