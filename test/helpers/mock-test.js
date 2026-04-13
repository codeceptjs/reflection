export function mockTest({
  title,
  file,
  tags = [],
  opts = {},
  meta = {},
  parent = { title: 'Feature' },
} = {}) {
  return { title, file, tags, opts, meta, parent }
}

export function mockDataTest({ title, file, row, parent = { title: 'Feature' } } = {}) {
  return {
    title: `${title} | ${JSON.stringify(row)}`,
    file,
    tags: [],
    opts: { data: row },
    meta: {},
    parent,
  }
}
