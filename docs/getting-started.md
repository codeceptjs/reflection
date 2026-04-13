# Getting started

## Install

```bash
npm install @codeceptjs/reflection
```

If you want to reflect `.ts` / `.tsx` scenarios, also install `typescript` as a peer:

```bash
npm install --save-dev typescript
```

## Your first reflection

```js
import { Reflection } from '@codeceptjs/reflection'

// You have a live CodeceptJS test object. Typically you get this from an event handler:
//   event.dispatcher.on(event.test.after, test => { ... })
const tr = Reflection.forTest(test)

console.log(tr.fileName)      // /path/to/login.test.js
console.log(tr.read())        // Scenario('login works', async ({ I }) => { ... })
```

## Preview an edit

```js
const edit = tr.replace(
  `Scenario('login works', async ({ I }) => {
    I.amOnPage('/login')
    I.click('Sign in')
  })`,
)

console.log(edit.diff())      // unified diff
console.log(edit.preview())   // full new source, nothing written yet
```

## Apply

```js
edit.apply()                  // atomic write
```

If the file changed on disk since the `Edit` was created, `apply()` throws `StaleEditError`. Pass `{ ignoreStale: true }` to force-write using the current file contents.

## Replace a step

```js
import { Reflection } from '@codeceptjs/reflection'

// event.dispatcher.on(event.step.failed, (step, err) => { ... })
const sr = Reflection.forStep(step, { test }) // test is optional but recommended

console.log(sr.isSupportObject)  // true if the step was called from a Page Object
console.log(sr.read())           // "I.click('#broken-selector')"
console.log(sr.readFunction())   // the enclosing Scenario body or PO method
console.log(sr.readTest())       // the full enclosing Scenario(...) call

sr.replace("I.click('#fixed-selector')").apply()
```

## Batch edits

If you want to rewrite multiple things in the same file in one write:

```js
const batch = Reflection.batch(filePath)
batch.add(sr1.replace('I.click("a")'))
batch.add(sr2.replace('I.click("b")'))
batch.add(sr3.replace('I.click("c")'))

console.log(batch.diff())
batch.apply()
```

`magic-string` detects overlapping ranges automatically; `batch.add()` throws `OverlappingEditError` if two edits collide.

## Add or remove tests in a suite

`SuiteReflection` can insert and delete Scenarios while preserving everything else in the file:

```js
const sur = Reflection.forSuite(suite)

// List what's already there
console.log(sur.tests)            // [{ title: 'login works', range: {...} }, ...]
console.log(sur.dependencies)     // ['I', 'loginPage']

// Add a new scenario at the end of the suite
sur.addTest(
  `Scenario('password reset', async ({ I }) => {
    I.amOnPage('/reset')
    I.click('Send link')
  })`,
).apply()

// Remove a flaky scenario
sur.removeTest('flaky login').apply()
```

Insertion is scoped to the current suite, so the new Scenario will not land after a later `Feature(...)` in the same file.

### Edit suite hooks

`BeforeSuite`, `Before`, `After`, and `AfterSuite` are editable too:

```js
sur.hooks                        // [{ kind: 'BeforeSuite', line: 3, range: {...} }, ...]
sur.findHook('Before')           // just the Before hooks

sur.addHook('BeforeSuite', `BeforeSuite(async ({ I }) => { I.amOnPage('/seed') })`).apply()
sur.replaceHook('Before', `Before(async ({ I }) => { I.clearCookie() })`).apply()
sur.removeHook('After').apply()

// Multiple hooks of the same kind? Disambiguate with { index }
sur.removeHook('Before', { index: 1 }).apply()
```

## List dependencies

Both `TestReflection` and `SuiteReflection` expose a `dependencies` accessor that reads the destructured parameter list from the scenario callback:

```js
const tr = Reflection.forTest(test)
console.log(tr.dependencies)  // ['I', 'loginPage']
```

This lets agents answer questions like "which Page Objects does this test use?" without executing anything.

## Enumerate a whole project

If you start from a `codecept.conf.js` instead of a live runtime object, `Reflection.project(...)` gives you the map:

```js
const project = await Reflection.project('./codecept.conf.js')

project.listSuites()          // every Feature(...) across all test files
project.listTests()           // every Scenario(...) with its parent suite
project.listTestsBySuite()    // Map<suiteTitle, tests[]>
project.listSteps('user signs in')  // static dry-run of a scenario body
project.listPageObjects()     // [{ name, file, kind, className }, ...]

// And hand off to the specialized reflections for editing:
const po = project.getPageObject('loginPage')
po.addMember(`reset() { /* ... */ }`).apply()

const sur = project.getSuite('Auth')
sur.addTest(`Scenario('new flow', async ({ I }) => { /* ... */ })`).apply()
```

`listSteps` is a **static dry-run** — it walks the AST of the scenario's callback without executing anything. Loops unroll to their source occurrences; for accurate runtime step capture, subscribe to CodeceptJS's `event.step.started` dispatcher instead.

## Edit a Page Object

Page Objects in CodeceptJS can be class-based or plain-object. `PageObjectReflection` handles both, and also surfaces the dependencies declared via `const { ... } = inject()`:

```js
const po = Reflection.forPageObject('./pages/LoginPage.js')

console.log(po.kind)            // 'class'
console.log(po.className)       // 'LoginPage'
console.log(po.dependencies)    // ['I', 'registerPage']
console.log(po.methods.map(m => m.name))     // ['sendForm', 'register']
console.log(po.properties.map(m => m.name))  // ['fields', 'submitButton']

// Add a new method
po.addMember(
  `reset(email) {
    I.fillField(this.fields.email, email)
    I.click('Send reset link')
  }`,
).apply()

// Replace an existing one
po.replaceMember('sendForm', `sendForm(email, password) { /* ... */ }`).apply()

// Remove
po.removeMember('register').apply()

// Keep inject() in sync when a new method needs a new dependency
po.addDependency('loginPage').apply()
```

Everything returns an `Edit` — nothing touches disk until `apply()`.

## TypeScript support

TypeScript is first-class. Pass a `test` whose `file` points to a `.ts` (or a `.temp.mjs` that maps back to a `.ts` via `store.tsFileMapping`), and reflection works the same way.

If `typescript` is not installed, any attempt to reflect a `.ts` file throws `MissingPeerError` with a helpful message.

## Integration with CodeceptJS internals

If you want reflection to automatically understand CodeceptJS's `.temp.mjs → .ts` file mapping without relying on the peer import, you can inject the map directly:

```js
import { Reflection } from '@codeceptjs/reflection'
import store from 'codeceptjs/lib/store'

Reflection.configure({ tsFileMapping: store.tsFileMapping })
```
