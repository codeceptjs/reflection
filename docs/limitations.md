# Limitations

`@codeceptjs/reflection` is deliberately scoped. This page lists what v1 does not do.

## Source

- **Gherkin `.feature` files are not editable.** `SuiteReflection.read()` on a `.feature` throws `UnsupportedSourceError`. Reflect the step-definition JS/TS file instead.
- **Only `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts` are supported.** Anything else throws `UnsupportedSourceError`.
- **`.temp.mjs` files are never the target.** CodeceptJS's TypeScript path transpiles `.ts` to `.temp.mjs` and injects an `esmGlobals` prelude. Byte offsets from the `.temp.mjs` AST are not valid against the original `.ts`. The package always resolves back to the source `.ts` and parses that.

## TypeScript

- Requires the `typescript` package as an optional peer. Missing it when you reflect a `.ts` throws `MissingPeerError`.
- `ts.createSourceFile` is used as a *range finder only*. The TypeScript printer is never called, so reformatting never happens.
- JSX is supported via `ScriptKind.TSX` (inferred from the `.tsx` extension).

## Editing

- **Replace-only.** v1 can only replace an existing range. It cannot insert new steps, new tests, or new suites.
- **Single-node.** Each `replace()` targets exactly one AST node.
- **No multi-file refactors.** Each `Reflection.batch(file)` operates on one file. A cross-file rename (e.g. renaming a PO method and its call sites) is out of scope.
- **No format preservation beyond the edit range.** Bytes outside the replaced range are preserved verbatim. Bytes inside the range become whatever you pass. If you need Prettier formatting on the result, run a formatter after `.apply()`.
- **No validation of the replacement.** v1 writes the bytes you give it. It does not parse the new code or verify it produces a valid step.

## Runtime

- **Step → test back-reference must come from the caller.** Pass `{ test }` explicitly to `Reflection.forStep(step, { test })`. v1 does not walk CodeceptJS internals to find the parent test.
- **Not worker-safe.** If two workers `apply()` edits to the same file concurrently, the last writer wins. Route healing through a single deferred channel (e.g. `event.all.result`) in multi-worker runs.
- **Locate is best-effort.** Steps in loops, steps in helpers bound in closures, and steps on lines with multiple identical calls may throw `AmbiguousLocateError`. Catch and skip.

## Performance

- `.ts` parsing via TypeScript compiler API is ~10–30× slower than acorn on equivalent JS. Cache the `parseFile()` result if you're reflecting the same file many times in a loop.
- The parser cache is per-process. Workers each maintain their own cache — this is deliberate.

## Deferred to v2

- Inserting new steps / tests / suites
- Multi-file refactors
- Gherkin editing
- Worker-safe concurrent edits (file locking)
- `.replace()` validating the new code parses
- `.replace()` accepting a function callback `(node) => newCode`
