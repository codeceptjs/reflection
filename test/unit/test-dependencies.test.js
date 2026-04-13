import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TestReflection } from '../../src/test.js'
import { clearCache } from '../../src/parser.js'
import { mockTest } from '../helpers/mock-test.js'

function tmp(contents, ext = '.js') {
  const p = path.join(os.tmpdir(), `reflection-deps-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  fs.writeFileSync(p, contents)
  return p
}

describe('TestReflection.dependencies', () => {
  beforeEach(() => clearCache())

  it('lists I from a simple scenario', () => {
    const file = tmp(
      `Feature('X')

Scenario('a', async ({ I }) => { I.amOnPage('/') })
`,
    )
    try {
      const tr = new TestReflection(mockTest({ title: 'a', file }))
      expect(tr.dependencies).toEqual(['I'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('lists multiple destructured deps', () => {
    const file = tmp(
      `Feature('X')

Scenario('a', async ({ I, loginPage, dashboardPage }) => {
  loginPage.login()
  dashboardPage.open()
})
`,
    )
    try {
      const tr = new TestReflection(mockTest({ title: 'a', file }))
      expect(tr.dependencies).toEqual(['I', 'loginPage', 'dashboardPage'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('handles Data().Scenario() deps including current', () => {
    const file = tmp(
      `Feature('X')

Data([{a: 1}]).Scenario('a', async ({ I, current }) => {
  I.amOnPage('/' + current.a)
})
`,
    )
    try {
      const tr = new TestReflection(mockTest({ title: 'a', file }))
      expect(tr.dependencies).toEqual(['I', 'current'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('handles non-destructured param as starred entry', () => {
    const file = tmp(
      `Feature('X')

Scenario('a', async (ctx) => {})
`,
    )
    try {
      const tr = new TestReflection(mockTest({ title: 'a', file }))
      expect(tr.dependencies).toEqual(['*ctx'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('returns [] when the scenario callback has no params', () => {
    const file = tmp(
      `Feature('X')

Scenario('a', async () => {})
`,
    )
    try {
      const tr = new TestReflection(mockTest({ title: 'a', file }))
      expect(tr.dependencies).toEqual([])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('works with a function (not arrow) scenario body', () => {
    const file = tmp(
      `Feature('X')

Scenario('a', async function ({ I, loginPage }) { I.amOnPage('/') })
`,
    )
    try {
      const tr = new TestReflection(mockTest({ title: 'a', file }))
      expect(tr.dependencies).toEqual(['I', 'loginPage'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('works in TypeScript files', () => {
    const file = tmp(
      `Feature('X')

Scenario('a', async ({ I, loginPage }: { I: CodeceptJS.I; loginPage: any }) => {
  I.amOnPage('/')
})
`,
      '.ts',
    )
    try {
      const tr = new TestReflection(mockTest({ title: 'a', file }))
      expect(tr.dependencies).toEqual(['I', 'loginPage'])
    } finally {
      fs.unlinkSync(file)
    }
  })
})
