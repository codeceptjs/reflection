import { parseFile } from './parser.js'
import { resolveSourceFile } from './source-path.js'
import { locateTestByTitle } from './locate/test.js'
import { extractScenarioDepsJS, extractScenarioDepsTS } from './locate/deps.js'
import { Edit } from './edit.js'
import { ReflectionError } from './errors.js'

const DATA_TITLE_RE = /\s*\|\s*\{[\s\S]*\}\s*$/

function stripDataTitle(title) {
  return title.replace(DATA_TITLE_RE, '')
}

export class TestReflection {
  constructor(test) {
    if (!test) throw new ReflectionError('TestReflection requires a test')
    this._test = test
    this._parsedCache = null
    this._locateCache = null
  }

  get fileName() {
    if (!this._test.file) {
      throw new ReflectionError('test.file is not set — cannot resolve source file', {})
    }
    return resolveSourceFile(this._test.file)
  }

  get title() {
    return this._test.title
  }

  get cleanTitle() {
    return stripDataTitle(this._test.title || '')
  }

  get tags() {
    return this._test.tags || []
  }

  get meta() {
    return this._test.meta || {}
  }

  get data() {
    return this._test.opts?.data
  }

  get isDataDriven() {
    if (this._test.opts?.data !== undefined) return true
    return DATA_TITLE_RE.test(this._test.title || '')
  }

  _parsed() {
    if (!this._parsedCache) this._parsedCache = parseFile(this.fileName)
    return this._parsedCache
  }

  _locate() {
    if (!this._locateCache) {
      this._locateCache = locateTestByTitle(this._parsed(), { title: this.cleanTitle })
    }
    return this._locateCache
  }

  get dependencies() {
    const parsed = this._parsed()
    const { node } = this._locate()
    const extract = parsed.engine === 'acorn' ? extractScenarioDepsJS : extractScenarioDepsTS
    return extract(node)
  }

  read() {
    const parsed = this._parsed()
    const { range } = this._locate()
    return parsed.source.slice(range.start, range.end)
  }

  readDataBlock() {
    if (!this.isDataDriven) {
      throw new ReflectionError('readDataBlock() called on a non-data-driven test', {
        filePath: this.fileName,
      })
    }
    const parsed = this._parsed()
    const { dataBlockRange, range } = this._locate()
    const r = dataBlockRange || range
    return parsed.source.slice(r.start, r.end)
  }

  replace(newCode) {
    const parsed = this._parsed()
    const { range, dataBlockRange } = this._locate()
    const target = this.isDataDriven && dataBlockRange ? dataBlockRange : range
    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start: target.start,
      end: target.end,
      replacement: newCode,
      eol: parsed.eol,
    })
  }
}
