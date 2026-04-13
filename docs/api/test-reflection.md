# `TestReflection`

Reflects a test (a CodeceptJS `Scenario`, including `xScenario`, `Scenario.only`, `Scenario.skip`, and `Data().Scenario`).

## Construction

```js
Reflection.forTest(test)
```

`test` must have `title` and `file`. `opts.data`, `meta`, and `tags` are read if present.

## Properties

| Name | Type | Description |
|---|---|---|
| `fileName` | `string` | Absolute path to the source file, with `.temp.mjs → .ts` resolution applied. |
| `title` | `string` | The raw title from the test object. Data-driven tests include a `\| {...}` suffix. |
| `cleanTitle` | `string` | Title with any data-row suffix stripped. |
| `tags` | `string[]` | |
| `meta` | `object` | |
| `data` | `unknown` | `test.opts.data`, if set. |
| `isDataDriven` | `boolean` | `true` when `opts.data` is present OR the title has a data-row suffix. |
| `dependencies` | `string[]` | Names destructured from the scenario callback's first parameter — e.g. `['I', 'loginPage']` for `async ({ I, loginPage }) => {...}`. Non-destructured params (like `async (ctx) => {...}`) appear as `*name` so consumers can tell them apart. Returns `[]` for `async () => {...}`. |

## Methods

### `read()`
Returns the full `Scenario(...)` source range.

For non-data tests this is the whole `Scenario('title', async ({ I }) => { ... })` call.

For `Data([...]).Scenario(...)` tests, returns the inner `Scenario(...)` portion. Use `readDataBlock()` to get the full `Data(...).Scenario(...)` wrapper.

### `readDataBlock()`
Returns the full `Data(...).Scenario(...)` block. Throws `ReflectionError` if the test is not data-driven.

### `replace(newCode)`
Returns an [`Edit`](./edit.md) that replaces the test's source range with `newCode`.

For data-driven tests, `replace()` targets the full `Data(...).Scenario(...)` block, so you can rewrite both the fixture and the scenario in one edit if you want.

## Errors

- `NotFoundError` — no `Scenario` with the matching title found in the file.
- `AmbiguousLocateError` — multiple `Scenario`s share the same title in the same file without a line hint.
