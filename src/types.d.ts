export interface StepLike {
  stack: string
  metaStep?: unknown
  args?: unknown[]
  toCode?(): string
}

export interface TestLike {
  title: string
  file?: string
  tags?: string[]
  opts?: { data?: unknown; [k: string]: unknown }
  meta?: Record<string, unknown>
  parent?: { title?: string }
}

export interface SuiteLike {
  title: string
  file?: string
  tags?: string[]
  meta?: Record<string, unknown>
}

export interface Range {
  start: number
  end: number
}

export interface ApplyResult {
  filePath: string
  applied?: number
}

export interface ApplyOptions {
  ignoreStale?: boolean
}

export declare class Edit {
  readonly filePath: string
  readonly range: Range
  readonly replacement: string
  preview(): string
  diff(): string
  apply(opts?: ApplyOptions): ApplyResult
}

export declare class Batch {
  readonly filePath: string
  readonly size: number
  add(edit: Edit): this
  preview(): string
  diff(): string
  apply(opts?: ApplyOptions): ApplyResult
}

export declare class StepReflection {
  constructor(step: StepLike, opts?: { test?: TestLike })
  readonly fileName: string
  readonly testFileName: string | null
  readonly line: number
  readonly column: number
  readonly isSupportObject: boolean
  readonly testTitle: string | null
  readonly meta: Record<string, unknown> | null
  read(): string
  readFunction(): string
  readTest(): string
  replace(newCode: string): Edit
}

export declare class TestReflection {
  constructor(test: TestLike)
  readonly fileName: string
  readonly title: string
  readonly cleanTitle: string
  readonly tags: string[]
  readonly meta: Record<string, unknown>
  readonly data: unknown
  readonly isDataDriven: boolean
  readonly dependencies: string[]
  read(): string
  readDataBlock(): string
  replace(newCode: string): Edit
}

export interface SuiteTestEntry {
  title: string | null
  range: Range
}

export interface AddTestOptions {
  position?: 'start' | 'end'
}

export declare class SuiteReflection {
  constructor(suite: SuiteLike)
  readonly fileName: string
  readonly title: string
  readonly tags: string[]
  readonly meta: Record<string, unknown>
  readonly tests: SuiteTestEntry[]
  readonly dependencies: string[]
  read(): string
  replace(newCode: string): Edit
  addTest(code: string, opts?: AddTestOptions): Edit
  removeTest(title: string): Edit
}

export interface ReflectionConfigureOptions {
  tsFileMapping?: Map<string, string>
}

export interface PageObjectMember {
  name: string
  kind: 'property' | 'method'
  range: Range
  params?: (string | null)[]
  static: boolean
}

export declare class PageObjectReflection {
  constructor(filePath: string, opts?: { name?: string })
  readonly fileName: string
  readonly kind: 'class' | 'plain-object'
  readonly className: string | null
  readonly dependencies: string[]
  readonly members: PageObjectMember[]
  readonly methods: PageObjectMember[]
  readonly properties: PageObjectMember[]
  findMember(name: string): PageObjectMember | null
  read(): string
  readMember(name: string): string
  addDependency(name: string): Edit
  removeDependency(name: string): Edit
  addMember(code: string): Edit
  replaceMember(name: string, code: string): Edit
  removeMember(name: string): Edit
}

export interface CodeceptConfigLike {
  tests?: string | string[]
  include?: Record<string, string>
  helpers?: Record<string, unknown>
  [k: string]: unknown
}

export interface SuiteEntry {
  title: string | null
  file: string
  line: number
}

export interface TestEntry {
  title: string | null
  suite: string | null
  file: string
  range: Range
}

export interface StepEntry {
  code: string
  receiver: string | null
  method: string | null
  args: string[]
  line: number
  column: number
  range: Range
}

export interface PageObjectEntry {
  name: string
  file: string
  kind: 'class' | 'plain-object' | null
  className: string | null
}

export declare class ProjectReflection {
  constructor(opts: { config?: CodeceptConfigLike; configPath?: string; basePath?: string })
  static load(opts: string | { configPath: string; basePath?: string }): Promise<ProjectReflection>
  readonly config: CodeceptConfigLike | null
  readonly basePath: string
  resolvePath(p: string): string
  listTestFiles(): string[]
  listSuites(): SuiteEntry[]
  listTests(): TestEntry[]
  listTestsBySuite(): Map<string, Array<{ title: string | null; range: Range; file: string }>>
  listSteps(
    testRef: TestReflection | TestLike | string,
    file?: string,
  ): StepEntry[]
  listPageObjects(opts?: { includeActor?: boolean }): PageObjectEntry[]
  getSuite(title: string, file?: string): SuiteReflection
  getSuite(opts: { title: string; file?: string }): SuiteReflection
  getTest(title: string, file?: string): TestReflection
  getTest(opts: { title: string; file?: string }): TestReflection
  getPageObject(name: string): PageObjectReflection
}

export declare const Reflection: {
  forStep(step: StepLike, opts?: { test?: TestLike }): StepReflection
  forTest(test: TestLike): TestReflection
  forSuite(suite: SuiteLike): SuiteReflection
  forPageObject(filePath: string, opts?: { name?: string }): PageObjectReflection
  project(opts: CodeceptConfigLike | { config?: CodeceptConfigLike; configPath?: string; basePath?: string } | string): ProjectReflection | Promise<ProjectReflection>
  batch(filePath: string): Batch
  configure(opts?: ReflectionConfigureOptions): void
  clearCache(): void
}

export declare class ReflectionError extends Error {
  code: string
  filePath?: string
}
export declare class UnsupportedSourceError extends ReflectionError {}
export declare class MissingPeerError extends ReflectionError {}
export declare class LocateError extends ReflectionError {}
export declare class NotFoundError extends LocateError {}
export declare class AmbiguousLocateError extends LocateError {
  candidates: Range[]
}
export declare class StaleEditError extends ReflectionError {}
export declare class OverlappingEditError extends ReflectionError {}
