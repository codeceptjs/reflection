# @codeceptjs/reflection

AST-based reflection for CodeceptJS tests, suites, and steps. Safely read and edit scenario source without regex.

## Why

CodeceptJS test runners, healers, AI agents, and MCP servers need to read and rewrite scenario source code. Doing that with regex is fragile. `@codeceptjs/reflection` gives you a principled, AST-driven API to locate a step, test, or suite in its source file, read the exact range, and replace it while preserving formatting, comments, and metadata.

## Core ideas

- **Duck-typed.** You pass the same runtime objects CodeceptJS already gives you: `Step`, `Mocha.Test`, `Mocha.Suite`. No imports from CodeceptJS internals, nothing to patch.
- **Point edits, not rewrites.** `replace()` returns an `Edit` object that patches a single byte range. Everything outside the range is preserved verbatim, including comments, imports, and surrounding code.
- **Never regex.** Locates use `acorn` (for JS) or the TypeScript compiler API (for TS). Splices use `magic-string`.
- **Preview first, apply later.** `edit.preview()`, `edit.diff()`, and `edit.apply()` — the caller decides when bytes hit disk.
- **Atomic writes.** `apply()` writes via `tmp + rename`, with a stale-file check against a sha1 snapshot.

## Install

```bash
npm install @codeceptjs/reflection
```

Optional peers:
- `codeceptjs` — for `.temp.mjs` → `.ts` source-path resolution. You can also inject the mapping directly via `Reflection.configure({ tsFileMapping })`.
- `typescript` — required only if you reflect `.ts` / `.tsx` files.

## Read the rest

- [Getting started](./getting-started.md)
- [API reference](./api/)
  - [Reflection factory](./api/reflection.md)
  - [StepReflection](./api/step-reflection.md)
  - [TestReflection](./api/test-reflection.md)
  - [SuiteReflection](./api/suite-reflection.md)
  - [PageObjectReflection](./api/page-object-reflection.md)
  - [Edit](./api/edit.md)
  - [Batch](./api/batch.md)
- [Heal plugin integration](./guides/heal-plugin-integration.md)
- [AI-assisted editing](./guides/ai-assisted-editing.md)
- [Limitations](./limitations.md)
