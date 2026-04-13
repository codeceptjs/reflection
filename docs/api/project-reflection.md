# `ProjectReflection`

A thin discovery layer that reads a CodeceptJS `codecept.conf.js` and enumerates everything in the project — suites, tests, steps, and page objects — without running anything.

Use this when an agent, healer, or MCP tool needs the map of a project before it knows which test, suite, or page object to reflect in detail. Each of the list methods is a static "dry run" — it walks the AST but never executes user code.

## Construction

```js
// From a config path (async, because config files can be ESM)
const project = await Reflection.project('./codecept.conf.js')

// From an inline config object (sync)
const project = Reflection.project({
  basePath: '/path/to/project',
  config: {
    tests: './test/**/*.scenario.js',
    include: {
      I: './steps_file.js',
      loginPage: './pages/LoginPage.js',
    },
  },
})

// Explicit split
const project = await ProjectReflection.load({ configPath: './codecept.conf.js' })
```

`config` is the CodeceptJS config object. Only `tests` and `include` are read; everything else is ignored.

## Properties

| Name | Type | Description |
|---|---|---|
| `config` | `object \| null` | The loaded config object. |
| `basePath` | `string` | Directory used to resolve relative paths (defaults to the config file's directory, or `process.cwd()` when constructed inline). |

## File discovery

### `listTestFiles()`
Resolves the `tests` glob against `basePath`, returns absolute file paths sorted alphabetically.

```js
project.listTestFiles()
// [ '/proj/test/auth.scenario.js', '/proj/test/dashboard.scenario.js' ]
```

`tests` may be a string or an array of strings. Globs are expanded by `glob`.

## Suite and test listing

### `listSuites()`
Lists every `Feature(...)` call across all test files.

```js
project.listSuites()
// [
//   { title: 'Auth',      file: '/proj/test/auth.scenario.js',      line: 1 },
//   { title: 'Dashboard', file: '/proj/test/dashboard.scenario.js', line: 1 },
// ]
```

### `listTests()`
Lists every `Scenario(...)` across all test files, tagged with the suite it belongs to.

```js
project.listTests()
// [
//   { title: 'user signs in',  suite: 'Auth', file: '...', range: {...} },
//   { title: 'user signs out', suite: 'Auth', file: '...', range: {...} },
//   ...
// ]
```

### `listTestsBySuite()`
Returns a `Map<suiteTitle, tests[]>` grouped by suite title.

```js
const bySuite = project.listTestsBySuite()
bySuite.get('Auth')
// [ { title: 'user signs in', range: {...}, file: '...' }, ... ]
```

### `getSuite(title, file?)` / `getSuite({ title, file })`
Returns a `SuiteReflection`. Throws `NotFoundError` if no match. Pass `file` to disambiguate when the same suite title appears in multiple files.

### `getTest(title, file?)` / `getTest({ title, file })`
Returns a `TestReflection`. Throws `NotFoundError` if no match.

## Step listing (static dry-run)

### `listSteps(testRef)`

Walks a scenario callback and returns every `receiver.method(...)` call — `I.click('Sign in')`, `loginPage.open()`, `this.fields.email`, etc.

Accepts:
- A `TestReflection` instance
- A test-like `{ title, file }` object
- A string `title` plus optional `file`

```js
project.listSteps('user signs in')
// [
//   { code: 'loginPage.open()',                        receiver: 'loginPage', method: 'open',     args: [],                 line: 4, column: 3, range: {...} },
//   { code: "loginPage.sendForm('...', '...')",         receiver: 'loginPage', method: 'sendForm', args: ["'...'", "'...'"], line: 5, column: 3, range: {...} },
//   { code: "I.see('Welcome')",                         receiver: 'I',         method: 'see',      args: ["'Welcome'"],       line: 6, column: 3, range: {...} },
// ]
```

Because this is static AST analysis, steps generated inside `for` / `forEach` / helpers are only listed once per *source* occurrence — not once per runtime iteration. For accurate runtime step capture, attach to CodeceptJS's `event.step.started` dispatcher instead.

## Page Object listing

### `listPageObjects({ includeActor })`

Reads `config.include` and returns one entry per declared PO. The actor file (`I`) is excluded by default; pass `{ includeActor: true }` to include it.

```js
project.listPageObjects()
// [
//   { name: 'loginPage',     file: '/proj/pages/LoginPage.js',     kind: 'class', className: 'LoginPage' },
//   { name: 'dashboardPage', file: '/proj/pages/DashboardPage.js', kind: 'class', className: 'DashboardPage' },
// ]
```

Entries where the file does not exist on disk are silently skipped.

### `getPageObject(name)`

Returns a `PageObjectReflection` by the name declared in `config.include`.

```js
const po = project.getPageObject('loginPage')
po.dependencies                  // ['I']
po.methods.map(m => m.name)      // ['open', 'sendForm']
po.addMember(`reset() { /* ... */ }`).apply()
```

Throws `NotFoundError` if the name isn't in the include map or the file doesn't exist.

## Errors

- `NotFoundError` — config file missing, suite/test/PO not found.
- `ReflectionError` — malformed config, missing required args.
