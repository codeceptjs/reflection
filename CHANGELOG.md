# Changelog

## 0.6.0 — Unreleased

Added single-file discovery without a config or a runtime Mocha suite object.

- `Reflection.scanFile(filePath)` returns `{ suites, tests }` for a file — every `Feature(...)` and `Scenario(...)` with its parent suite, byte range, and line. Reuses the same walker `ProjectReflection` uses internally.
- `Reflection.forSuite({ file })` now auto-detects the suite title when the file has exactly one `Feature(...)`. Throws `AmbiguousLocateError` if multiple exist, `NotFoundError` if none. `forSuite` also accepts a bare path string (`Reflection.forSuite('./auth.js')`) as a shorthand.

## 0.5.0 — Unreleased

Added hook reflection to `SuiteReflection` for `Before`, `After`, `BeforeSuite`, and `AfterSuite`.

- `sur.hooks` — list of `{ kind, line, range }` entries scoped to the current suite.
- `sur.findHook(kind)` — filter by kind.
- `sur.addHook(kind, code, { position })` — append after existing hooks (or right after `Feature(...)` if none); scoped to the current suite.
- `sur.removeHook(kind, { index })` — delete a hook; throws `AmbiguousLocateError` when multiple match and no index is given.
- `sur.replaceHook(kind, code, { index })` — replace a hook body with the same disambiguation semantics.

## 0.4.0 — Unreleased

Added `ProjectReflection` — a project-level discovery layer that reads a CodeceptJS config and enumerates suites, tests, steps, and page objects without running anything.

- `Reflection.project(configPath | opts)` / `ProjectReflection.load(pathOrOpts)`.
- `listTestFiles()`, `listSuites()`, `listTests()`, `listTestsBySuite()`, `listSteps(testRef)`, `listPageObjects({ includeActor })`.
- `getSuite(title, file?)` / `getTest(title, file?)` / `getPageObject(name)` — hand off to the specialized reflectors.
- Static "dry-run" step listing via AST walk — no CodeceptJS boot required.
- Config loader supports `export const config = {...}`, `export default {...}`, `module.exports = {...}`, and `.json`.
- New runtime dep: `glob` for test-file discovery.

## 0.3.0 — Unreleased

Added `PageObjectReflection` for source-level introspection and editing of CodeceptJS Page Objects.

- `Reflection.forPageObject(filePath, { name })` returns a `PageObjectReflection`.
- Supports both class-based (`class LoginPage { ... } export default LoginPage`) and plain-object (`module.exports = { ... }`, `export default { ... }`) Page Objects, in JS and TS.
- `.kind`, `.className`, `.dependencies`, `.members`, `.methods`, `.properties`, `.findMember(name)`.
- `.read()` returns the full container text; `.readMember(name)` returns an individual member.
- `.addMember(code)`, `.replaceMember(name, code)`, `.removeMember(name)` — class fields and methods, plain-object properties and method shorthands. All return an `Edit`.
- `.addDependency(name)` / `.removeDependency(name)` — maintain the `const { ... } = inject()` destructuring at the top of the file.
- Trailing commas and surrounding whitespace are managed automatically on add/remove.

## 0.2.0 — Unreleased

Added programmatic suite editing and dependency introspection.

- `SuiteReflection.tests` — list of Scenarios belonging to the suite, in source order.
- `SuiteReflection.dependencies` — aggregated destructured param names across all scenarios in the suite.
- `SuiteReflection.addTest(code, { position })` — insert a new Scenario at the end (or start) of the suite.
- `SuiteReflection.removeTest(title)` — delete a Scenario by title, scoped to this suite.
- `TestReflection.dependencies` — destructured param names of a single scenario's callback.
- `Edit` now supports zero-width inserts via `magic-string.appendLeft` when `start === end`, and plain deletion via empty-string replacement.

## 0.1.0 — Unreleased

Initial release.

- `Reflection.forStep(step, { test, extraFrameworkPatterns })` returns a `StepReflection`.
- `Reflection.forTest(test)` returns a `TestReflection`.
- `Reflection.forSuite(suite)` returns a `SuiteReflection`.
- `Reflection.batch(filePath)` returns a `Batch` for composing multi-edit atomic writes.
- AST-based source parsing via `acorn` (JS/MJS/CJS) and optional `typescript` peer (TS/TSX).
- `.read()`, `.readFunction()`, `.readTest()`, `.replace()` for steps.
- `.read()`, `.readDataBlock()`, `.replace()` for tests (with `Data(...).Scenario(...)` handling).
- `.read()`, `.replace()` for suites. Gherkin `.feature` files throw `UnsupportedSourceError`.
- `Edit` with `.preview()`, `.diff()`, `.apply({ ignoreStale })`. Stale-file detection via sha1 snapshot.
- `Batch` with overlap detection via `magic-string`.
- Atomic writes (tmp + rename, with Windows `EBUSY` fallback).
- CRLF/LF EOL normalization, UTF-8 BOM preservation.
- `.temp.mjs → .ts` source path resolution via injected or lazy `store.tsFileMapping`.
