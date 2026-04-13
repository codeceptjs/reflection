import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProjectReflection } from '../../src/project.js'
import { Reflection } from '../../src/reflection.js'
import { TestReflection } from '../../src/test.js'
import { SuiteReflection } from '../../src/suite.js'
import { PageObjectReflection } from '../../src/pageobject.js'
import { clearCache } from '../../src/parser.js'
import { NotFoundError, ReflectionError } from '../../src/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(__dirname, '../fixtures/project')
const configPath = path.join(projectDir, 'codecept.conf.js')

function makeProject() {
  return new ProjectReflection({
    basePath: projectDir,
    config: {
      tests: './test/*.scenario.js',
      include: {
        I: './steps_file.js',
        loginPage: './pages/LoginPage.js',
        dashboardPage: './pages/DashboardPage.js',
      },
    },
  })
}

describe('ProjectReflection: constructor and config', () => {
  it('rejects empty opts', () => {
    expect(() => new ProjectReflection({})).toThrow(ReflectionError)
  })

  it('accepts inline config', () => {
    const project = makeProject()
    expect(project.config.tests).toBe('./test/*.scenario.js')
    expect(project.basePath).toBe(projectDir)
  })

  it('resolves relative paths against basePath', () => {
    const project = makeProject()
    expect(project.resolvePath('./pages/LoginPage.js')).toBe(
      path.join(projectDir, 'pages/LoginPage.js'),
    )
    expect(project.resolvePath('/absolute/x')).toBe('/absolute/x')
  })

  it('loads config from a file via ProjectReflection.load', async () => {
    const project = await ProjectReflection.load(configPath)
    expect(project.config.tests).toBe('./test/*.scenario.js')
    expect(project.basePath).toBe(projectDir)
  })

  it('Reflection.project with a string path returns a promise', async () => {
    const p = Reflection.project(configPath)
    expect(p).toBeInstanceOf(Promise)
    const project = await p
    expect(project).toBeInstanceOf(ProjectReflection)
  })

  it('Reflection.project with inline opts returns sync instance', () => {
    const project = Reflection.project({
      basePath: projectDir,
      config: { tests: './test/*.scenario.js' },
    })
    expect(project).toBeInstanceOf(ProjectReflection)
  })
})

describe('ProjectReflection.listTestFiles', () => {
  beforeEach(() => clearCache())

  it('resolves the tests glob to an absolute sorted list', () => {
    const project = makeProject()
    const files = project.listTestFiles()
    expect(files).toHaveLength(2)
    expect(files[0].endsWith('auth.scenario.js')).toBe(true)
    expect(files[1].endsWith('dashboard.scenario.js')).toBe(true)
    expect(path.isAbsolute(files[0])).toBe(true)
  })

  it('accepts an array of glob patterns', () => {
    const project = new ProjectReflection({
      basePath: projectDir,
      config: { tests: ['./test/auth.scenario.js', './test/dashboard.scenario.js'] },
    })
    expect(project.listTestFiles()).toHaveLength(2)
  })

  it('returns [] when tests glob is missing', () => {
    const project = new ProjectReflection({ basePath: projectDir, config: {} })
    expect(project.listTestFiles()).toEqual([])
  })
})

describe('ProjectReflection.listSuites', () => {
  beforeEach(() => clearCache())

  it('lists Features across all test files', () => {
    const project = makeProject()
    const suites = project.listSuites()
    expect(suites.map(s => s.title).sort()).toEqual(['Auth', 'Dashboard'])
    for (const s of suites) {
      expect(path.isAbsolute(s.file)).toBe(true)
      expect(s.line).toBeGreaterThan(0)
    }
  })
})

describe('ProjectReflection.listTests + listTestsBySuite', () => {
  beforeEach(() => clearCache())

  it('lists tests across all suites', () => {
    const project = makeProject()
    const tests = project.listTests()
    expect(tests.map(t => t.title).sort()).toEqual([
      'user sees welcome',
      'user signs in',
      'user signs out',
    ])
    for (const t of tests) {
      expect(t.suite).toBeDefined()
      expect(t.file).toBeDefined()
      expect(t.range.start).toBeLessThan(t.range.end)
    }
  })

  it('groups tests by suite title', () => {
    const project = makeProject()
    const map = project.listTestsBySuite()
    expect(map.get('Auth').map(t => t.title)).toEqual(['user signs in', 'user signs out'])
    expect(map.get('Dashboard').map(t => t.title)).toEqual(['user sees welcome'])
  })
})

describe('ProjectReflection.listSteps', () => {
  beforeEach(() => clearCache())

  it('lists all step-like calls in a scenario body', () => {
    const project = makeProject()
    const steps = project.listSteps('user signs in')
    const codes = steps.map(s => s.code)
    expect(codes).toContain('loginPage.open()')
    expect(codes).toContain("loginPage.sendForm('user@example.com', 'secret')")
    expect(codes).toContain("I.see('Welcome')")
  })

  it('tags receiver and method for each step', () => {
    const project = makeProject()
    const steps = project.listSteps('user signs in')
    const entry = steps.find(s => s.method === 'sendForm')
    expect(entry.receiver).toBe('loginPage')
    expect(entry.args).toEqual(["'user@example.com'", "'secret'"])
    expect(entry.line).toBeGreaterThan(0)
  })

  it('accepts a TestReflection directly', () => {
    const project = makeProject()
    const tr = project.getTest('user signs out')
    const steps = project.listSteps(tr)
    expect(steps.map(s => s.method)).toEqual(['amOnPage', 'click', 'see'])
  })

  it('accepts a { title, file } object', () => {
    const project = makeProject()
    const files = project.listTestFiles()
    const steps = project.listSteps({ title: 'user signs out', file: files[0] })
    expect(steps.length).toBeGreaterThan(0)
  })
})

describe('ProjectReflection.getSuite / getTest', () => {
  beforeEach(() => clearCache())

  it('getSuite returns a SuiteReflection', () => {
    const project = makeProject()
    const sur = project.getSuite('Auth')
    expect(sur).toBeInstanceOf(SuiteReflection)
    expect(sur.title).toBe('Auth')
    expect(sur.tests.map(t => t.title)).toEqual(['user signs in', 'user signs out'])
  })

  it('getSuite throws NotFoundError for unknown titles', () => {
    const project = makeProject()
    expect(() => project.getSuite('Nope')).toThrow(NotFoundError)
  })

  it('getTest returns a TestReflection', () => {
    const project = makeProject()
    const tr = project.getTest('user signs in')
    expect(tr).toBeInstanceOf(TestReflection)
    expect(tr.title).toBe('user signs in')
    expect(tr.dependencies).toEqual(['I', 'loginPage'])
  })

  it('getTest throws NotFoundError for unknown titles', () => {
    const project = makeProject()
    expect(() => project.getTest('nope')).toThrow(NotFoundError)
  })
})

describe('ProjectReflection: TypeScript support', () => {
  beforeEach(() => clearCache())

  function makeTSProject() {
    return new ProjectReflection({
      basePath: projectDir,
      config: {
        tests: './test/*.scenario.ts',
        include: {
          I: './steps_file.js',
          loginPage: './pages/LoginPage.js',
        },
      },
    })
  }

  it('lists suites in a .ts scenario file', () => {
    const project = makeTSProject()
    const suites = project.listSuites()
    expect(suites.map(s => s.title)).toEqual(['Typed'])
  })

  it('lists tests in a .ts scenario file', () => {
    const project = makeTSProject()
    const tests = project.listTests()
    expect(tests.map(t => t.title)).toEqual(['typed scenario'])
  })

  it('listSteps walks the TS scenario body', () => {
    const project = makeTSProject()
    const steps = project.listSteps('typed scenario')
    const methods = steps.map(s => s.method)
    expect(methods).toContain('amOnPage')
    expect(methods).toContain('see')
  })
})

describe('ProjectReflection: config loading edge cases', () => {
  it('rejects a missing config file', async () => {
    await expect(ProjectReflection.load('/nonexistent/codecept.conf.js')).rejects.toThrow(
      ReflectionError,
    )
  })

  it('loads a JSON config', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const tmp = path.join(
      os.tmpdir(),
      `reflection-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    )
    fs.writeFileSync(tmp, JSON.stringify({ tests: './*.js', include: {} }))
    try {
      const project = await ProjectReflection.load(tmp)
      expect(project.config.tests).toBe('./*.js')
    } finally {
      fs.unlinkSync(tmp)
    }
  })

  it('rejects a malformed config that exports nothing recognizable', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const tmp = path.join(
      os.tmpdir(),
      `reflection-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
    )
    fs.writeFileSync(tmp, 'export const unrelated = 42\n')
    try {
      await expect(ProjectReflection.load(tmp)).rejects.toThrow(ReflectionError)
    } finally {
      fs.unlinkSync(tmp)
    }
  })
})

describe('ProjectReflection.listPageObjects + getPageObject', () => {
  beforeEach(() => clearCache())

  it('lists page objects from the include map (excluding the I actor)', () => {
    const project = makeProject()
    const pos = project.listPageObjects()
    const names = pos.map(p => p.name).sort()
    expect(names).toEqual(['dashboardPage', 'loginPage'])
    const login = pos.find(p => p.name === 'loginPage')
    expect(login.kind).toBe('class')
    expect(login.className).toBe('LoginPage')
  })

  it('can include the I actor when asked', () => {
    const project = makeProject()
    const pos = project.listPageObjects({ includeActor: true })
    expect(pos.map(p => p.name).sort()).toEqual(['I', 'dashboardPage', 'loginPage'])
  })

  it('getPageObject returns a PageObjectReflection by include-map name', () => {
    const project = makeProject()
    const po = project.getPageObject('loginPage')
    expect(po).toBeInstanceOf(PageObjectReflection)
    expect(po.className).toBe('LoginPage')
    expect(po.methods.map(m => m.name).sort()).toEqual(['open', 'sendForm'])
    expect(po.dependencies).toEqual(['I'])
  })

  it('getPageObject throws NotFoundError for unknown names', () => {
    const project = makeProject()
    expect(() => project.getPageObject('nope')).toThrow(NotFoundError)
  })

  it('getPageObject throws NotFoundError when the file is missing', () => {
    const project = new ProjectReflection({
      basePath: projectDir,
      config: { include: { ghost: './does-not-exist.js' } },
    })
    expect(() => project.getPageObject('ghost')).toThrow(NotFoundError)
  })
})
