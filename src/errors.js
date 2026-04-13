export class ReflectionError extends Error {
  constructor(message, { filePath, cause } = {}) {
    super(message)
    this.name = 'ReflectionError'
    this.code = 'REFLECTION_ERROR'
    this.filePath = filePath
    if (cause) this.cause = cause
  }
}

export class UnsupportedSourceError extends ReflectionError {
  constructor(message, opts = {}) {
    super(message, opts)
    this.name = 'UnsupportedSourceError'
    this.code = 'UNSUPPORTED_SOURCE'
  }
}

export class MissingPeerError extends ReflectionError {
  constructor(message, opts = {}) {
    super(message, opts)
    this.name = 'MissingPeerError'
    this.code = 'MISSING_PEER'
  }
}

export class LocateError extends ReflectionError {
  constructor(message, opts = {}) {
    super(message, opts)
    this.name = 'LocateError'
    this.code = 'LOCATE_ERROR'
  }
}

export class NotFoundError extends LocateError {
  constructor(message, opts = {}) {
    super(message, opts)
    this.name = 'NotFoundError'
    this.code = 'NOT_FOUND'
  }
}

export class AmbiguousLocateError extends LocateError {
  constructor(message, { candidates, ...opts } = {}) {
    super(message, opts)
    this.name = 'AmbiguousLocateError'
    this.code = 'AMBIGUOUS_LOCATE'
    this.candidates = candidates || []
  }
}

export class StaleEditError extends ReflectionError {
  constructor(message, opts = {}) {
    super(message, opts)
    this.name = 'StaleEditError'
    this.code = 'STALE_EDIT'
  }
}

export class OverlappingEditError extends ReflectionError {
  constructor(message, opts = {}) {
    super(message, opts)
    this.name = 'OverlappingEditError'
    this.code = 'OVERLAPPING_EDIT'
  }
}
