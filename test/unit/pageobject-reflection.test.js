import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PageObjectReflection } from '../../src/pageobject.js'
import { Reflection } from '../../src/reflection.js'
import { clearCache, parseFile } from '../../src/parser.js'
import { NotFoundError, ReflectionError } from '../../src/errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = p => path.resolve(__dirname, '../fixtures', p)

function tmp(contents, ext = '.js') {
  const p = path.join(os.tmpdir(), `reflection-po-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  fs.writeFileSync(p, contents)
  return p
}

describe('PageObjectReflection (class-based JS)', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = fix('js/support/LoginPageClass.js')
  })

  it('detects class kind and className', () => {
    const po = new PageObjectReflection(file)
    expect(po.kind).toBe('class')
    expect(po.className).toBe('LoginPage')
  })

  it('lists dependencies from inject()', () => {
    const po = new PageObjectReflection(file)
    expect(po.dependencies).toEqual(['I', 'registerPage'])
  })

  it('lists members', () => {
    const po = new PageObjectReflection(file)
    const names = po.members.map(m => m.name)
    expect(names).toEqual(['fields', 'submitButton', 'sendForm', 'register'])
  })

  it('splits members into methods and properties', () => {
    const po = new PageObjectReflection(file)
    expect(po.methods.map(m => m.name)).toEqual(['sendForm', 'register'])
    expect(po.properties.map(m => m.name)).toEqual(['fields', 'submitButton'])
  })

  it('includes method parameter names', () => {
    const po = new PageObjectReflection(file)
    expect(po.findMember('sendForm').params).toEqual(['email', 'password'])
  })

  it('read() returns the full class text', () => {
    const po = new PageObjectReflection(file)
    const src = po.read()
    expect(src.startsWith('class LoginPage')).toBe(true)
    expect(src).toContain('sendForm')
  })

  it('readMember returns only that member', () => {
    const po = new PageObjectReflection(file)
    expect(po.readMember('submitButton')).toContain("'#new_user_basic")
    expect(po.readMember('sendForm')).toContain('I.fillField(this.fields.email')
  })
})

describe('PageObjectReflection add/replace/remove member (class-based)', () => {
  let file

  beforeEach(() => {
    clearCache()
    file = tmp(`const { I } = inject()

class LoginPage {
  fields = {
    email: '#email',
    password: '#pass',
  }

  sendForm(email, password) {
    I.fillField(this.fields.email, email)
    I.fillField(this.fields.password, password)
  }
}

export default LoginPage
`)
  })
  afterEach(() => { try { fs.unlinkSync(file) } catch {} })

  it('addMember inserts a new method at the end of the class', () => {
    const po = new PageObjectReflection(file)
    const edit = po.addMember(
      `reset(email) {
  I.fillField(this.fields.email, email)
  I.click('Reset')
}`,
    )
    edit.apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain('reset(email)')
    expect(after).toContain("I.click('Reset')")
    expect(after).toContain('sendForm(email, password)') // existing preserved
  })

  it('addMember inserts a new property', () => {
    const po = new PageObjectReflection(file)
    po.addMember(`submitButton = { css: 'button[type=submit]' }`).apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain('submitButton')
    expect(after).toContain("css: 'button[type=submit]'")
  })

  it('addMember throws when the name already exists', () => {
    const po = new PageObjectReflection(file)
    expect(() =>
      po.addMember(`sendForm(a, b) { I.click('x') }`),
    ).toThrow(ReflectionError)
  })

  it('replaceMember swaps an existing method', () => {
    const po = new PageObjectReflection(file)
    po.replaceMember(
      'sendForm',
      `sendForm(email, password) {
  I.say('overridden')
}`,
    ).apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain("I.say('overridden')")
    expect(after).not.toContain('I.fillField(this.fields.email, email)')
  })

  it('replaceMember swaps a class field', () => {
    const po = new PageObjectReflection(file)
    po.replaceMember(
      'fields',
      `fields = { email: '#new-email', password: '#new-pass' }`,
    ).apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain("#new-email")
    expect(after).not.toContain("'#email'")
  })

  it('removeMember deletes a method and re-parses cleanly', () => {
    const po = new PageObjectReflection(file)
    po.removeMember('sendForm').apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).not.toContain('sendForm')
    // Must still parse
    clearCache()
    const po2 = new PageObjectReflection(file)
    expect(po2.methods.map(m => m.name)).toEqual([])
  })

  it('removeMember deletes a property', () => {
    const po = new PageObjectReflection(file)
    po.removeMember('fields').apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).not.toContain('fields = {')
    expect(after).toContain('sendForm') // method untouched
  })

  it('removeMember throws NotFoundError for unknown name', () => {
    const po = new PageObjectReflection(file)
    expect(() => po.removeMember('nope')).toThrow(NotFoundError)
  })
})

describe('PageObjectReflection dependencies edit', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(`const { I } = inject()

class Page {
  open() { I.amOnPage('/') }
}

export default Page
`)
  })
  afterEach(() => { try { fs.unlinkSync(file) } catch {} })

  it('addDependency appends a new injected name', () => {
    const po = new PageObjectReflection(file)
    po.addDependency('loginPage').apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toMatch(/const \{ I\s*,\s*loginPage\s*\} = inject\(\)/)
    clearCache()
    const po2 = new PageObjectReflection(file)
    expect(po2.dependencies).toEqual(['I', 'loginPage'])
  })

  it('addDependency on an empty destructure pattern works', () => {
    const empty = tmp(`const {} = inject()\n\nclass X { foo() {} }\n\nexport default X\n`)
    try {
      const po = new PageObjectReflection(empty)
      po.addDependency('I').apply()
      const after = fs.readFileSync(empty, 'utf8')
      expect(after).toContain('{ I }')
      clearCache()
      expect(new PageObjectReflection(empty).dependencies).toEqual(['I'])
    } finally {
      fs.unlinkSync(empty)
    }
  })

  it('addDependency rejects duplicates', () => {
    const po = new PageObjectReflection(file)
    expect(() => po.addDependency('I')).toThrow(ReflectionError)
  })

  it('removeDependency deletes an injected name', () => {
    clearCache()
    const multi = tmp(`const { I, loginPage, dashboardPage } = inject()\n\nclass X { foo() {} }\n\nexport default X\n`)
    try {
      const po = new PageObjectReflection(multi)
      po.removeDependency('loginPage').apply()
      const after = fs.readFileSync(multi, 'utf8')
      expect(after).not.toContain('loginPage')
      expect(after).toContain('dashboardPage')
      expect(after).toContain('{ I')
    } finally {
      fs.unlinkSync(multi)
    }
  })

  it('removeDependency throws NotFoundError when name is absent', () => {
    const po = new PageObjectReflection(file)
    expect(() => po.removeDependency('nope')).toThrow(NotFoundError)
  })

  it('addDependency throws when there is no inject() call', () => {
    const noInject = tmp(`class X { foo() {} }\n\nexport default X\n`)
    try {
      // No inject() → locate throws because no PO found? Actually class is found; inject is null
      const po = new PageObjectReflection(noInject)
      expect(() => po.addDependency('I')).toThrow(ReflectionError)
    } finally {
      fs.unlinkSync(noInject)
    }
  })
})

describe('PageObjectReflection (plain-object JS)', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = fix('js/support/loginPage.js')
  })

  it('detects plain-object kind', () => {
    const po = new PageObjectReflection(file)
    expect(po.kind).toBe('plain-object')
  })

  it('lists members', () => {
    const po = new PageObjectReflection(file)
    const names = po.members.map(m => m.name)
    expect(names).toContain('loginFields')
    expect(names).toContain('login')
    expect(names).toContain('logout')
  })

  it('distinguishes methods from properties', () => {
    const po = new PageObjectReflection(file)
    expect(po.methods.map(m => m.name).sort()).toEqual(['login', 'logout'])
    expect(po.properties.map(m => m.name)).toEqual(['loginFields'])
  })

  it('lists dependencies from inject()', () => {
    const po = new PageObjectReflection(file)
    expect(po.dependencies).toEqual(['I'])
  })
})

describe('PageObjectReflection add/replace/remove (plain-object)', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(`const { I } = inject()

module.exports = {
  fields: {
    email: '#email',
  },

  login(email) {
    I.fillField(this.fields.email, email)
  },
}
`)
  })
  afterEach(() => { try { fs.unlinkSync(file) } catch {} })

  it('addMember inserts a new method shorthand', () => {
    const po = new PageObjectReflection(file)
    po.addMember(`logout() {
  I.click('Logout')
}`).apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain('logout()')
    expect(after).toContain("I.click('Logout')")
    // Must still parse
    clearCache()
    const po2 = new PageObjectReflection(file)
    expect(po2.methods.map(m => m.name).sort()).toEqual(['login', 'logout'])
  })

  it('addMember inserts a new property with trailing comma discipline', () => {
    const po = new PageObjectReflection(file)
    po.addMember(`submitButton: 'button[type=submit]'`).apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain('submitButton')
    clearCache()
    const po2 = new PageObjectReflection(file)
    expect(po2.findMember('submitButton')).not.toBeNull()
  })

  it('removeMember deletes a plain-object method', () => {
    const po = new PageObjectReflection(file)
    po.removeMember('login').apply()
    clearCache()
    const po2 = new PageObjectReflection(file)
    expect(po2.findMember('login')).toBeNull()
    expect(po2.findMember('fields')).not.toBeNull()
  })
})

describe('PageObjectReflection (class-based TS)', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = fix('ts/support/DashboardPage.ts')
  })

  it('detects class kind and className in TS', () => {
    const po = new PageObjectReflection(file)
    expect(po.kind).toBe('class')
    expect(po.className).toBe('DashboardPage')
  })

  it('lists TS dependencies', () => {
    const po = new PageObjectReflection(file)
    expect(po.dependencies).toEqual(['I'])
  })

  it('lists TS class members', () => {
    const po = new PageObjectReflection(file)
    const names = po.members.map(m => m.name)
    expect(names).toContain('header')
    expect(names).toContain('stats')
    expect(names).toContain('open')
    expect(names).toContain('grabStats')
  })

  it('returns parameter names for TS methods', () => {
    const po = new PageObjectReflection(file)
    expect(po.findMember('open').params).toEqual([])
    expect(po.findMember('grabStats').params).toEqual([])
  })
})

describe('Reflection.forPageObject factory', () => {
  it('returns a PageObjectReflection', () => {
    const po = Reflection.forPageObject(fix('js/support/LoginPageClass.js'))
    expect(po).toBeInstanceOf(PageObjectReflection)
    expect(po.className).toBe('LoginPage')
  })
})
