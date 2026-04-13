# `Batch`

Composes multiple edits against the same file into a single atomic write. Use this when a healer or AI agent wants to rewrite several things in one scenario file without parsing and writing three times.

## Construction

```js
const batch = Reflection.batch(filePath)
```

The file is parsed and snapshotted at construction time.

## Methods

### `add(edit)`
Adds an [`Edit`](./edit.md) to the batch.

- Throws `ReflectionError` if `edit.filePath` does not match the batch's file.
- Throws `OverlappingEditError` if the new edit's byte range overlaps a previously added one. `magic-string` detects overlaps for us.

Returns `this` for chaining.

### `size`
Number of edits currently in the batch.

### `preview()`
Full new source with all edits applied. Does not write.

### `diff()`
Unified diff of the full batch.

### `apply(options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `ignoreStale` | `boolean` | `false` | When `false`, throws `StaleEditError` if the file's sha1 has changed since `Reflection.batch(filePath)` was called. |

Writes once. Atomicity is "all or nothing" — either every edit makes it to disk together, or none do.

Returns `{ filePath, applied }`.
