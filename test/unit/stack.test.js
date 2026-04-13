import { describe, it, expect } from 'vitest'
import { parseV8Stack, firstUserFrame, isFrameworkFrame } from '../../src/stack.js'

describe('parseV8Stack', () => {
  it('parses a linux V8 stack with function name', () => {
    const stack =
      `Error\n` +
      `    at foo (/home/user/project/test.js:10:15)\n` +
      `    at bar (/home/user/project/test.js:20:5)\n`
    const frames = parseV8Stack(stack)
    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({ functionName: 'foo', line: 10, column: 15 })
    expect(frames[0].file).toContain('test.js')
  })

  it('parses a frame without function name', () => {
    const frames = parseV8Stack('Error\n    at /tmp/x.js:3:8')
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ functionName: null, line: 3, column: 8 })
  })

  it('parses async frames', () => {
    const frames = parseV8Stack('Error\n    at async myFn (/tmp/x.js:5:1)')
    expect(frames).toHaveLength(1)
    expect(frames[0].functionName).toBe('myFn')
    expect(frames[0].line).toBe(5)
  })

  it('converts file:// URLs to paths', () => {
    const frames = parseV8Stack('Error\n    at fn (file:///home/user/x.mjs:1:1)')
    expect(frames[0].file).toBe('/home/user/x.mjs')
  })

  it('strips query strings from file paths', () => {
    const frames = parseV8Stack('Error\n    at fn (/home/user/x.mjs?v=1:1:1)')
    expect(frames[0].file).toBe('/home/user/x.mjs')
  })

  it('skips eval frames', () => {
    const stack =
      `Error\n` +
      `    at eval (eval at <anonymous>, <anonymous>:1:1)\n` +
      `    at real (/tmp/x.js:5:5)\n`
    const frames = parseV8Stack(stack)
    expect(frames).toHaveLength(1)
    expect(frames[0].functionName).toBe('real')
  })

  it('returns empty on null or empty stack', () => {
    expect(parseV8Stack(null)).toEqual([])
    expect(parseV8Stack('')).toEqual([])
    expect(parseV8Stack('no frames here')).toEqual([])
  })
})

describe('isFrameworkFrame', () => {
  it('identifies codeceptjs lib frames as framework', () => {
    expect(isFrameworkFrame({ file: '/x/codeceptjs/lib/step/base.js' })).toBe(true)
    expect(isFrameworkFrame({ file: '/x/node_modules/codeceptjs/lib/actor.js' })).toBe(true)
  })

  it('identifies user frames as non-framework', () => {
    expect(isFrameworkFrame({ file: '/project/test/myTest.js' })).toBe(false)
  })

  it('treats missing file as framework', () => {
    expect(isFrameworkFrame({ file: null })).toBe(true)
    expect(isFrameworkFrame(null)).toBe(true)
  })
})

describe('firstUserFrame', () => {
  it('returns the first user frame, skipping framework frames', () => {
    const stack =
      `Error\n` +
      `    at Step.setTrace (/x/codeceptjs/lib/step/base.js:84:15)\n` +
      `    at Proxy.click (/x/codeceptjs/lib/container.js:500:12)\n` +
      `    at Context.<anonymous> (/user/project/test.js:42:5)\n`
    const f = firstUserFrame(stack)
    expect(f).toMatchObject({ line: 42, column: 5 })
    expect(f.file).toContain('/user/project/test.js')
  })

  it('returns null if no user frame', () => {
    const stack = `Error\n    at internal (node:internal/x.js:1:1)\n`
    expect(firstUserFrame(stack)).toBeNull()
  })
})
