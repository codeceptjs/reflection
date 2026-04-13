import { parseFile } from './parser.js'
import { firstUserFrame } from './stack.js'
import { resolveSourceFile } from './source-path.js'
import { locateStepByPosition } from './locate/step.js'
import { Edit } from './edit.js'
import { ReflectionError } from './errors.js'

export class StepReflection {
  constructor(step, { test, extraFrameworkPatterns = [] } = {}) {
    if (!step) throw new ReflectionError('StepReflection requires a step')
    this._step = step
    this._test = test
    this._extraFrameworkPatterns = extraFrameworkPatterns
    this._locationCache = null
    this._parsedCache = null
  }

  get isSupportObject() {
    return this._step.metaStep != null
  }

  get testTitle() {
    return this._test?.title || null
  }

  get meta() {
    return this._test?.meta || null
  }

  _location() {
    if (this._locationCache) return this._locationCache
    const frame = firstUserFrame(this._step.stack, {
      extraFrameworkPatterns: this._extraFrameworkPatterns,
    })
    if (!frame) {
      throw new ReflectionError('Unable to resolve step source location from stack', {})
    }
    const resolvedFile = resolveSourceFile(frame.file)
    this._locationCache = {
      file: resolvedFile,
      line: frame.line,
      column: frame.column,
    }
    return this._locationCache
  }

  get fileName() {
    return this._location().file
  }

  get line() {
    return this._location().line
  }

  get column() {
    return this._location().column
  }

  get testFileName() {
    if (!this._test?.file) return null
    return resolveSourceFile(this._test.file)
  }

  _parsed() {
    if (this._parsedCache) return this._parsedCache
    this._parsedCache = parseFile(this.fileName)
    return this._parsedCache
  }

  _locate() {
    const parsed = this._parsed()
    return locateStepByPosition(parsed, { line: this.line, column: this.column })
  }

  read() {
    const parsed = this._parsed()
    const { stepRange } = this._locate()
    return parsed.source.slice(stepRange.start, stepRange.end)
  }

  readFunction() {
    const parsed = this._parsed()
    const loc = this._locate()
    if (!loc.functionRange) {
      throw new ReflectionError('No enclosing function found for step', { filePath: parsed.filePath })
    }
    return parsed.source.slice(loc.functionRange.start, loc.functionRange.end)
  }

  readTest() {
    const parsed = this._parsed()
    const loc = this._locate()
    if (!loc.testRange) {
      throw new ReflectionError(
        'No enclosing Scenario found for step (it may be inside a support object or hook)',
        { filePath: parsed.filePath },
      )
    }
    return parsed.source.slice(loc.testRange.start, loc.testRange.end)
  }

  replace(newCode) {
    const parsed = this._parsed()
    const { stepRange } = this._locate()
    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start: stepRange.start,
      end: stepRange.end,
      replacement: newCode,
      eol: parsed.eol,
    })
  }
}
