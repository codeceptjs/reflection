import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { atomicWriteFileSync } from '../../src/fs-atomic.js'
import { ReflectionError } from '../../src/errors.js'

const created = []

afterEach(() => {
  while (created.length) {
    const f = created.pop()
    try { fs.unlinkSync(f) } catch {}
  }
})

function tmp() {
  const p = path.join(os.tmpdir(), `reflection-atomic-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  created.push(p)
  return p
}

describe('atomicWriteFileSync', () => {
  it('writes file contents to a new path', () => {
    const file = tmp()
    atomicWriteFileSync(file, 'hello')
    expect(fs.readFileSync(file, 'utf8')).toBe('hello')
  })

  it('overwrites existing files', () => {
    const file = tmp()
    fs.writeFileSync(file, 'original')
    atomicWriteFileSync(file, 'new contents')
    expect(fs.readFileSync(file, 'utf8')).toBe('new contents')
  })

  it('throws ReflectionError when target directory does not exist', () => {
    const file = '/nonexistent-dir/xyz.txt'
    expect(() => atomicWriteFileSync(file, 'x')).toThrow(ReflectionError)
  })
})
