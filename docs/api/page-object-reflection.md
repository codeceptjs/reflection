# `PageObjectReflection`

Reflects a CodeceptJS Page Object source file — class-based or plain-object — and lets you add, replace, or remove properties and methods while keeping dependencies injected via `inject()` in sync.

See the CodeceptJS [Page Objects docs](https://codecept.io/pageobjects) for the two supported shapes.

## Construction

```js
Reflection.forPageObject(filePath, { name })
```

| Param | Type | Description |
|---|---|---|
| `filePath` | `string` | Absolute or relative path to the `.js` / `.ts` file. |
| `opts.name` | `string?` | Class name to disambiguate when the file declares more than one class. Ignored for plain-object POs. |

If no class or exported plain-object is found, the constructor throws `NotFoundError`.

## Properties

| Name | Type | Description |
|---|---|---|
| `fileName` | `string` | Resolved absolute path. |
| `kind` | `'class' \| 'plain-object'` | How the PO is declared in source. |
| `className` | `string \| null` | For class-based POs. `null` for plain-object `module.exports = {...}` / `export default {...}`. |
| `dependencies` | `string[]` | Names destructured from `const { ... } = inject()` at the top of the file. |
| `members` | `PageObjectMember[]` | All members in declaration order. |
| `methods` | `PageObjectMember[]` | Just the methods. |
| `properties` | `PageObjectMember[]` | Just the fields / non-function properties. |

A `PageObjectMember` looks like:

```ts
{
  name: string,
  kind: 'property' | 'method',
  range: { start: number, end: number },
  params?: (string | null)[],  // only on methods
  static: boolean,              // class fields/methods only
}
```

## Read methods

### `read()`
Returns the full class or object-literal source text.

### `readMember(name)`
Returns the source text of a single member. Throws `NotFoundError` if the name doesn't exist.

### `findMember(name)`
Returns the `PageObjectMember` entry or `null`. Useful for probing before editing.

## Dependency editing

### `addDependency(name)`
Inserts a new name into the `inject()` destructuring. Returns an `Edit`. Throws `ReflectionError` if the name is already present or if the file has no `inject()` call.

```js
po.addDependency('loginPage').apply()
// const { I, loginPage } = inject()
```

### `removeDependency(name)`
Removes a name from `inject()`. Returns an `Edit`. Throws `NotFoundError` if the name isn't in the destructure.

## Member editing

### `addMember(code)`
Inserts a new member at the end of the container (after the last existing member). The name is parsed out of `code` so you can track it later. Throws if the name already exists.

**Class-based**: pass code the way you'd write it inside a `class { }` body.

```js
po.addMember(
  `reset(email) {
    I.fillField(this.fields.email, email)
    I.click('Send reset link')
  }`,
).apply()
```

**Plain-object**: pass code the way you'd write it inside `{ }`. Trailing commas are auto-managed.

```js
po.addMember(`logout() {
  I.click('Logout')
}`).apply()
```

Class fields and plain-object properties work the same way:

```js
po.addMember(`submitButton = { css: 'button[type=submit]' }`).apply()
// or for plain-object:
po.addMember(`submitButton: 'button[type=submit]'`).apply()
```

### `replaceMember(name, code)`
Replaces the existing member with `code`. Returns an `Edit`. Throws `NotFoundError` if the name doesn't exist.

```js
po.replaceMember(
  'sendForm',
  `sendForm(email, password) {
    I.fillField(this.fields.email, email)
    I.fillField(this.fields.password, password)
    I.click(this.submitButton)
    I.waitForText('Welcome')
  }`,
).apply()
```

### `removeMember(name)`
Deletes the member and cleans up surrounding whitespace / trailing commas. Throws `NotFoundError` if the name doesn't exist.

```js
po.removeMember('deprecatedLogin').apply()
```

## Errors

- `NotFoundError` — no class or plain-object in the file; member or dependency not found.
- `ReflectionError` — duplicate member, duplicate dependency, malformed addMember code, missing `inject()` when calling `addDependency`.
