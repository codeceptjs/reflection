# `SuiteReflection`

Reflects a CodeceptJS `Feature(...)` call and the `Scenario` siblings that belong to it in source order.

A suite's "members" are the top-level `Scenario` / `Data().Scenario` statements that appear between this `Feature` call and the next `Feature` in the same file (or EOF). Everything below operates on that range.

## Construction

```js
Reflection.forSuite(suite)                       // live runtime suite object
Reflection.forSuite({ title, file })             // suite-like object
Reflection.forSuite({ file: './test/auth.js' })  // auto-detect title
Reflection.forSuite('./test/auth.js')            // bare path shorthand
```

`file` is required. `title` is optional: if omitted and the file has exactly one `Feature(...)`, it's used automatically. If the file has multiple Features, `AmbiguousLocateError` is thrown.

## Properties

| Name | Type | Description |
|---|---|---|
| `fileName` | `string` | Absolute path to the source file, with `.temp.mjs → .ts` resolution applied. |
| `title` | `string` | |
| `tags` | `string[]` | |
| `meta` | `object` | |
| `tests` | `Array<{ title, range }>` | Scenarios that belong to this suite, in source order. `title` is the first string argument of each `Scenario(...)`. `range` is the byte range of the full statement. |
| `hooks` | `Array<{ kind, line, range }>` | `Before` / `After` / `BeforeSuite` / `AfterSuite` calls that belong to this suite, in source order. `kind` is the hook function name. |
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

## Hook editing

CodeceptJS suite hooks — `BeforeSuite`, `Before`, `After`, `AfterSuite` — are top-level sibling statements of `Feature` / `Scenario`. `SuiteReflection` locates them by walking the same suite range used for `tests`, so each hook operation is scoped to the current Feature.

### `findHook(kind)`
Returns all hooks of a given kind in this suite (in source order). Useful before calling `removeHook` / `replaceHook` to check for ambiguity.

```js
sur.findHook('Before')   // [{ kind: 'Before', line: 5, range: {...} }]
```

### `addHook(kind, code, opts?)`
Inserts a new hook and returns an [`Edit`](./edit.md).

| Option | Type | Default | Description |
|---|---|---|---|
| `position` | `'afterHooks' \| 'afterFeature'` | `'afterHooks'` | `'afterHooks'` appends after the last existing hook in this suite, or after `Feature(...)` if none exist. `'afterFeature'` always inserts right after `Feature(...)`. |

```js
sur.addHook(
  'BeforeSuite',
  `BeforeSuite(async ({ I }) => { I.amOnPage('/seed') })`,
).apply()
```

Insertion is scoped — the hook will never land past the next `Feature(...)` in the same file. Throws `ReflectionError` if `kind` is not one of the four supported hook names.

### `removeHook(kind, opts?)`
Deletes a hook of a given kind, scoped to this suite.

| Option | Type | Description |
|---|---|---|
| `index` | `number?` | Disambiguate when this suite has multiple hooks of the same kind. 0-based index into `findHook(kind)`. |

```js
sur.removeHook('Before').apply()
sur.removeHook('Before', { index: 1 }).apply()  // remove the second of two Before hooks
```

Throws `NotFoundError` if no hook of that kind exists (or `index` is out of range). Throws `AmbiguousLocateError` when there are multiple matching hooks and no `index` was given.

### `replaceHook(kind, code, opts?)`
Replaces the body of a hook. Accepts the same `{ index }` option as `removeHook` for disambiguation.

```js
sur.replaceHook(
  'Before',
  `Before(async ({ I }) => { I.amOnPage('/login') })`,
).apply()
```

## Gherkin

Gherkin `.feature` files are not supported: `read()` throws `UnsupportedSourceError`. For BDD-style CodeceptJS projects, reflect the step-definition JS/TS file instead.
