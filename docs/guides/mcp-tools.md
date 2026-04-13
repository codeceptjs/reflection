# MCP tools

CodeceptJS ships an MCP server (`bin/mcp-server.js`) that exposes `list_tests`, `run_test`, `run_step_by_step`, etc. `@codeceptjs/reflection` lets you add source-editing tools on top of that.

## `read_test`

```js
import { Reflection } from '@codeceptjs/reflection'

export const readTestTool = {
  name: 'read_test',
  description: 'Read the source of a CodeceptJS scenario by title and file.',
  inputSchema: {
    type: 'object',
    required: ['title', 'file'],
    properties: {
      title: { type: 'string' },
      file: { type: 'string' },
    },
  },
  async handler({ title, file }) {
    const tr = Reflection.forTest({ title, file })
    return { content: [{ type: 'text', text: tr.read() }] }
  },
}
```

## `replace_step`

```js
export const replaceStepTool = {
  name: 'replace_step',
  description: 'Replace a step call in a CodeceptJS scenario file.',
  inputSchema: {
    type: 'object',
    required: ['file', 'line', 'column', 'replacement'],
    properties: {
      file: { type: 'string' },
      line: { type: 'number' },
      column: { type: 'number' },
      replacement: { type: 'string' },
      dryRun: { type: 'boolean' },
    },
  },
  async handler({ file, line, column, replacement, dryRun }) {
    // Synthesize a minimal step-like object from raw location
    const stack =
      `Error\n    at mcp (${file}:${line}:${column})\n`
    const sr = Reflection.forStep({ stack, metaStep: null })
    const edit = sr.replace(replacement)
    if (dryRun) {
      return { content: [{ type: 'text', text: edit.diff() }] }
    }
    edit.apply()
    return { content: [{ type: 'text', text: `applied to ${file}` }] }
  },
}
```

## `read_step_source`

```js
export const readStepSourceTool = {
  name: 'read_step_source',
  description: 'Read the source of a step and its enclosing function.',
  inputSchema: {
    type: 'object',
    required: ['file', 'line', 'column'],
    properties: {
      file: { type: 'string' },
      line: { type: 'number' },
      column: { type: 'number' },
    },
  },
  async handler({ file, line, column }) {
    const stack = `Error\n    at mcp (${file}:${line}:${column})\n`
    const sr = Reflection.forStep({ stack, metaStep: null })
    return {
      content: [
        { type: 'text', text: `Step: ${sr.read()}` },
        { type: 'text', text: `Function:\n${sr.readFunction()}` },
      ],
    }
  },
}
```

## Adding the tools to the MCP server

Modify `bin/mcp-server.js` to register these tools alongside the existing ones. The handlers use standard MCP content shapes so they're drop-in.
