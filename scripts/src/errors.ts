export class ConfigValidationError extends Error {
  constructor(
    message: string,
    readonly filePath: string,
    readonly validationErrors: string[]
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}
