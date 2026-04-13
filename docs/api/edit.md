# `Edit`

Returned by `StepReflection.replace()`, `TestReflection.replace()`, and `SuiteReflection.replace()`. Represents a staged change; nothing is written until `apply()` is called.

## Properties

| Name | Type | Description |
|---|---|---|
| `filePath` | `string` | Target file. |
| `range` | `{ start, end }` | Byte range (0-indexed, end-exclusive) that will be replaced. |
| `replacement` | `string` | The new text. |

## Methods

### `preview()`
Returns the full new source as a string. Does not write to disk.

### `diff()`
Returns a unified diff string (via the `diff` package).

### `apply(options?)`
Writes the new file contents atomically (tmp + rename, with a Windows fallback to copyFile+unlink+retry).

| Option | Type | Default | Description |
|---|---|---|---|
| `ignoreStale` | `boolean` | `false` | When `false`, throws `StaleEditError` if the file's sha1 has changed since the `Edit` was created. When `true`, applies the edit to the *current* file contents instead of the snapshot. |

Returns `{ filePath }` on success.

## Preservation guarantees

- Bytes outside `range` are preserved exactly, including comments, imports, and trailing newlines.
- CRLF files stay CRLF — `replacement` strings containing LF are normalized to the file's detected EOL before splicing.
- UTF-8 BOMs are preserved.

## Errors

- `StaleEditError` — file changed between parse and apply.
- `ReflectionError` — file disappeared, permission denied, atomic-write failed.
