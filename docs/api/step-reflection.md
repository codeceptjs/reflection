# `StepReflection`

Reflects a single step. The step must have a V8 stack (CodeceptJS steps always do — `Error.captureStackTrace` runs in the `Step` constructor).

## Construction

```js
new StepReflection(step, { test, extraFrameworkPatterns })
// or
Reflection.forStep(step, { test })
```

## Properties

| Name | Type | Description |
|---|---|---|
| `fileName` | `string` | Absolute path to the source file where the step was *called*. For Page Object steps this is the PO file, not the scenario. |
| `testFileName` | `string \| null` | Path to the scenario file, from `test.file` (requires `opts.test`). |
| `line` | `number` | 1-based line number of the step call site. |
| `column` | `number` | 1-based column. |
| `isSupportObject` | `boolean` | `true` when `step.metaStep` is non-null, meaning the step was wrapped by `container.proxySupport` — i.e. it came through a Page Object method. |
| `testTitle` | `string \| null` | Title of the owning test, if `opts.test` was provided. |
| `meta` | `object \| null` | `test.meta`, if available. |

## Methods

### `read()`
Returns the exact source text of the step call, e.g. `"I.click('Sign in')"`.

### `readFunction()`
Returns the source of the enclosing function — the scenario body if the step is inline, or the PO method body if it came through a support object.

### `readTest()`
Returns the full enclosing `Scenario(...)` call text. Throws `ReflectionError` when no enclosing Scenario is found (for example, steps inside hooks or support objects that have no ancestor Scenario in the same file).

### `replace(newCode)`
Returns a new [`Edit`](./edit.md). Nothing is written until you call `edit.apply()`.

## Errors

- `ReflectionError` — missing step, unable to resolve source location.
- `NotFoundError` — no call expression at the resolved line/column (usually means the stack points somewhere unexpected, like a dynamically generated file).
- `AmbiguousLocateError` — multiple call expressions of the same size match; typically happens inside `forEach` callbacks.
