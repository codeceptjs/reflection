import path from 'node:path'
import fs from 'node:fs'
import { globSync } from 'glob'
import { parseFile } from './parser.js'
import { scanFile } from './locate/file-scan.js'
import { listStepsInScenario } from './locate/steps-in-test.js'
import { TestReflection } from './test.js'
import { SuiteReflection } from './suite.js'
import { PageObjectReflection } from './pageobject.js'
import { loadConfigFile } from './config.js'
import { ReflectionError, NotFoundError } from './errors.js'

export class ProjectReflection {
  /**
   * @param {object} opts
   * @param {object} [opts.config]     An inline CodeceptJS config object
   * @param {string} [opts.configPath] Path to a CodeceptJS config file
   * @param {string} [opts.basePath]   Base path for resolving relative paths
   */
  constructor({ config, configPath, basePath } = {}) {
    if (!config && !configPath) {
      throw new ReflectionError('ProjectReflection requires { config } or { configPath }')
    }
    this._config = config || null
    this._configPath = configPath || null
    this._basePath = basePath || (configPath ? path.dirname(path.resolve(configPath)) : process.cwd())
    this._ready = config ? Promise.resolve() : null
    this._testFilesCache = null
    this._fileScanCache = new Map()
  }

  static async load(opts) {
    if (opts && typeof opts === 'string') {
      const { config, configPath, basePath } = await loadConfigFile(opts)
      return new ProjectReflection({ config, configPath, basePath })
    }
    if (opts && opts.configPath && !opts.config) {
      const loaded = await loadConfigFile(opts.configPath)
      return new ProjectReflection({
        config: loaded.config,
        configPath: loaded.configPath,
        basePath: opts.basePath || loaded.basePath,
      })
    }
    return new ProjectReflection(opts)
  }

  get config() {
    return this._config
  }

  get basePath() {
    return this._basePath
  }

  resolvePath(p) {
    if (!p) return p
    if (path.isAbsolute(p)) return p
    return path.resolve(this._basePath, p)
  }

  // -------------------- Test file discovery --------------------

  listTestFiles() {
    if (this._testFilesCache) return this._testFilesCache
    const testsGlob = this._config?.tests
    if (!testsGlob) {
      this._testFilesCache = []
      return []
    }
    const patterns = Array.isArray(testsGlob) ? testsGlob : [testsGlob]
    const files = new Set()
    for (const pattern of patterns) {
      const normalized = pattern.replace(/^\.\//, '')
      const matches = globSync(normalized, {
        cwd: this._basePath,
        absolute: true,
        nodir: true,
      })
      for (const m of matches) files.add(m)
    }
    this._testFilesCache = Array.from(files).sort()
    return this._testFilesCache
  }

  // -------------------- Suites --------------------

  listSuites() {
    const suites = []
    for (const file of this.listTestFiles()) {
      const scan = this._scanFile(file)
      if (!scan) continue
      for (const f of scan.features) {
        suites.push({
          title: f.title,
          file,
          line: f.line,
        })
      }
    }
    return suites
  }

  getSuite(titleOrOpts, maybeFile) {
    const opts =
      typeof titleOrOpts === 'string'
        ? { title: titleOrOpts, file: maybeFile }
        : titleOrOpts || {}
    if (!opts.title) throw new ReflectionError('getSuite requires a title')
    const match = this.listSuites().find(
      s => s.title === opts.title && (!opts.file || this._samePath(s.file, opts.file)),
    )
    if (!match) {
      throw new NotFoundError(
        `No suite titled "${opts.title}"${opts.file ? ` in ${opts.file}` : ''}`,
        { filePath: opts.file },
      )
    }
    return new SuiteReflection({ title: match.title, file: match.file })
  }

  // -------------------- Tests --------------------

  listTests() {
    const out = []
    for (const suite of this.listSuites()) {
      const sur = new SuiteReflection({ title: suite.title, file: suite.file })
      for (const t of sur.tests) {
        out.push({
          title: t.title,
          suite: suite.title,
          file: suite.file,
          range: t.range,
        })
      }
    }
    return out
  }

  listTestsBySuite() {
    const map = new Map()
    for (const suite of this.listSuites()) {
      const sur = new SuiteReflection({ title: suite.title, file: suite.file })
      map.set(suite.title, sur.tests.map(t => ({ title: t.title, range: t.range, file: suite.file })))
    }
    return map
  }

  getTest(titleOrOpts, maybeFile) {
    const opts =
      typeof titleOrOpts === 'string'
        ? { title: titleOrOpts, file: maybeFile }
        : titleOrOpts || {}
    if (!opts.title) throw new ReflectionError('getTest requires a title')
    const match = this.listTests().find(
      t => t.title === opts.title && (!opts.file || this._samePath(t.file, opts.file)),
    )
    if (!match) {
      throw new NotFoundError(
        `No test titled "${opts.title}"${opts.file ? ` in ${opts.file}` : ''}`,
        { filePath: opts.file },
      )
    }
    return new TestReflection({
      title: match.title,
      file: match.file,
      parent: { title: match.suite },
    })
  }

  // -------------------- Steps --------------------

  /**
   * Static "dry run" — walks the scenario callback body and returns every
   * MemberExpression-style call (I.*, loginPage.*, this.*, etc.).
   *
   * Accepts a TestReflection, a { title, file } object, or (title, file).
   */
  listSteps(testOrTitle, maybeFile) {
    let tr
    if (testOrTitle instanceof TestReflection) {
      tr = testOrTitle
    } else if (typeof testOrTitle === 'string') {
      tr = this.getTest(testOrTitle, maybeFile)
    } else if (testOrTitle && typeof testOrTitle === 'object') {
      tr = new TestReflection(testOrTitle)
    } else {
      throw new ReflectionError('listSteps requires a test reference')
    }
    const parsed = parseFile(tr.fileName)
    const loc = tr._locate()
    return listStepsInScenario(parsed, loc.node)
  }

  // -------------------- Page Objects --------------------

  listPageObjects({ includeActor = false } = {}) {
    const include = this._config?.include || {}
    const out = []
    for (const [name, rawPath] of Object.entries(include)) {
      if (!includeActor && name === 'I') continue
      if (typeof rawPath !== 'string') continue
      const file = this.resolvePath(rawPath)
      if (!fs.existsSync(file)) continue
      const info = this._tryDescribePageObject(file)
      out.push({
        name,
        file,
        kind: info?.kind || null,
        className: info?.className || null,
      })
    }
    return out
  }

  getPageObject(name) {
    const include = this._config?.include || {}
    const raw = include[name]
    if (!raw) {
      throw new NotFoundError(`Page Object "${name}" is not declared in config.include`, {})
    }
    const file = this.resolvePath(raw)
    if (!fs.existsSync(file)) {
      throw new NotFoundError(`Page Object file for "${name}" does not exist: ${file}`, {
        filePath: file,
      })
    }
    return new PageObjectReflection(file)
  }

  // -------------------- internals --------------------

  _scanFile(file) {
    const resolved = path.resolve(file)
    if (this._fileScanCache.has(resolved)) return this._fileScanCache.get(resolved)
    let parsed
    try {
      parsed = parseFile(resolved)
    } catch {
      this._fileScanCache.set(resolved, null)
      return null
    }
    const scanned = scanFile(parsed)
    this._fileScanCache.set(resolved, scanned)
    return scanned
  }

  _tryDescribePageObject(file) {
    try {
      const po = new PageObjectReflection(file)
      return { kind: po.kind, className: po.className }
    } catch {
      return null
    }
  }

  _samePath(a, b) {
    if (!a || !b) return false
    return path.resolve(a) === path.resolve(b)
  }
}
