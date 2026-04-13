# `Reflection`

The top-level factory. Does not hold state except for what `configure()` injects.

## `Reflection.forStep(step, opts?)`

Returns a [`StepReflection`](./step-reflection.md).

| Param | Type | Description |
|---|---|---|
| `step` | `StepLike` | Any object with a `stack` property (V8 string). `metaStep` is read to detect Page Object origin. |
| `opts.test` | `TestLike?` | Optional parent test. Needed for `testFileName` and `testTitle`. |
| `opts.extraFrameworkPatterns` | `RegExp[]?` | Extra file-path patterns to treat as framework frames. Useful when running inside test harnesses whose helpers should be skipped when locating user call sites. |

## `Reflection.forTest(test)`

Returns a [`TestReflection`](./test-reflection.md).

| Param | Type | Description |
|---|---|---|
| `test` | `TestLike` | Object with `title`, `file`, and optional `opts.data`, `meta`, `tags`. |

## `Reflection.forSuite(suiteOrPath)`

Returns a [`SuiteReflection`](./suite-reflection.md). Accepts any of:

```js
Reflection.forSuite(suite)                       // live runtime suite object { title, file, ... }
Reflection.forSuite({ title, file })             // suite-like object
Reflection.forSuite({ file: './test/auth.js' })  // no title — auto-detected
Reflection.forSuite('./test/auth.js')            // bare path — shorthand for { file: ... }
```

When the `title` is omitted, the suite is auto-detected from the file: if there's exactly one `Feature(...)` call, it's used. If there are multiple, `AmbiguousLocateError` is thrown with the list of candidate titles. If there are none, `NotFoundError`.

## `Reflection.scanFile(filePath)`

Parses a file and returns every `Feature(...)` and `Scenario(...)` it contains, without constructing any reflection objects. Useful for lightweight discovery when you don't need a full `ProjectReflection`.

```js
Reflection.scanFile('./test/auth.js')
// {
//   suites: [{ title: 'Auth', file: '...', line: 1, range: {...} }, ...],
//   tests:  [{ title: 'login works', suite: 'Auth', file: '...', line: 3, range: {...} }, ...],
// }
```

Each test entry is tagged with the `suite` whose `Feature(...)` precedes it in source order. Throws `UnsupportedSourceError` on Gherkin `.feature` files.

## `Reflection.batch(filePath)`

Returns a [`Batch`](./batch.md) that can compose multiple edits against the same file into a single atomic write.

## `Reflection.configure(opts)`

Configure global behavior.

| Option | Type | Description |
|---|---|---|
| `tsFileMapping` | `Map<string, string>` | Mapping from original `.ts` paths to CodeceptJS-transpiled `.temp.mjs` paths. If not provided, reflection will lazily try to read it from `codeceptjs/lib/store` (works for in-tree installations). |

## `Reflection.clearCache()`

Clears the parser cache. Useful in long-running processes that edit files externally.
