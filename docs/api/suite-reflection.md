# `SuiteReflection`

Reflects a CodeceptJS `Feature(...)` call and the `Scenario` siblings that belong to it in source order.

A suite's "members" are the top-level `Scenario` / `Data().Scenario` statements that appear between this `Feature` call and the next `Feature` in the same file (or EOF). Everything below operates on that range.

## Construction

```js
Reflection.forSuite(suite)
```

`suite` must have `title` and `file`.

## Properties

| Name | Type | Description |
|---|---|---|
| `fileName` | `string` | Absolute path to the source file, with `.temp.mjs → .ts` resolution applied. |
| `title` | `string` | |
| `tags` | `string[]` | |
| `meta` | `object` | |
| `tests` | `Array<{ title, range }>` | Scenarios that belong to this suite, in source order. `title` is the first string argument of each `Scenario(...)`. `range` is the byte range of the full statement. |
| `dependencies` | `string[]` | Unique destructured parameter names across all scenarios in this suite (e.g. `['I', 'loginPage']`). Non-destructured params appear as `*name` so you can tell them apart. |

## Methods

### `read()`
Returns the exact `Feature('title')` source text.

### `replace(newCode)`
Returns an [`Edit`](./edit.md) that replaces the `Feature(...)` call.

### `addTest(code, opts?)`
Returns an [`Edit`](./edit.md) that inserts a new Scenario statement into this suite. Nothing is written until you call `edit.apply()`.

| Option | Type | Default | Description |
|---|---|---|---|
| `position` | `'start' \| 'end'` | `'end'` | Insert at the end of the suite (after the last existing Scenario) or at the start (right after the `Feature(...)` call). |

The insertion is scoped to this suite, so the new scenario will never land after a later `Feature(...)` in the same file.

```js
const edit = sur.addTest(
  `Scenario('new login', async ({ I }) => {
    I.amOnPage('/login')
    I.click('Sign in')
  })`,
)
edit.apply()
```

Note: leading/trailing blank lines are inserted automatically. Pass `code` without outer whitespace.

### `removeTest(title)`
Returns an [`Edit`](./edit.md) that deletes the scenario statement with the matching title from this suite. The enclosing blank line is cleaned up. Throws `NotFoundError` if the title doesn't exist in this suite.

The lookup is scoped: if another suite in the same file has a scenario with the same title, it is left alone.

```js
sur.removeTest('flaky login').apply()
```

## Gherkin

Gherkin `.feature` files are not supported: `read()` throws `UnsupportedSourceError`. For BDD-style CodeceptJS projects, reflect the step-definition JS/TS file instead.
