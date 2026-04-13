# @codeceptjs/reflection

AST-based reflection for CodeceptJS tests, suites, and steps. Safely read and edit scenario source without regex.

## Install

```bash
npm install @codeceptjs/reflection
```

## Why

CodeceptJS test runners, healers, AI agents, and MCP servers need to read and rewrite scenario source code. Doing that with regex is fragile and unsafe. This package gives you a principled, AST-driven API to locate a step, test, or suite in its source file, read the exact range, and replace it while preserving formatting, comments, and metadata.

## Quick start

```js
import { Reflection } from '@codeceptjs/reflection'

// You have a live CodeceptJS test object (from event.test.before, event.test.after, etc.)
const tr = Reflection.forTest(test)

console.log(tr.read())              // full Scenario(...) source
console.log(tr.fileName)            // path to the source file

// Build an edit — nothing is written yet
const edit = tr.replace(`Scenario('login works', async ({ I }) => { I.amOnPage('/') })`)

console.log(edit.diff())            // unified diff preview
console.log(edit.preview())         // full new source
edit.apply()                        // atomic write to disk
```

## Reflection classes

```js
Reflection.forStep(step, { test })           // StepReflection
Reflection.forTest(test)                     // TestReflection
Reflection.forSuite(suite)                   // SuiteReflection — addTest/removeTest
Reflection.forPageObject(filePath, { name }) // PageObjectReflection — add/replace/remove members
```

Each exposes the same shape: `fileName`, `read()`, `replace()`, plus type-specific accessors. `SuiteReflection` and `PageObjectReflection` also support programmatic add/remove of children.

## Batching

Replace multiple things in one file, one write:

```js
const batch = Reflection.batch(filePath)
batch.add(sr1.replace('I.click("a")'))
batch.add(sr2.replace('I.click("b")'))
batch.apply()
```

## Documentation

- [Getting started](./docs/getting-started.md)
- [API reference](./docs/api/)
- [Heal plugin integration](./docs/guides/heal-plugin-integration.md)
- [AI-assisted editing](./docs/guides/ai-assisted-editing.md)
- [Limitations](./docs/limitations.md)

## Requirements

- Node.js 18+
- CodeceptJS 3.x or 4.x (optional peer — only needed at runtime by consumers)
- `typescript` package (optional peer — only needed if you reflect `.ts` / `.tsx` files)

## License

MIT
