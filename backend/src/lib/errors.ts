export class HttpError extends Error {
  readonly statusCode: number;
  readonly errors?: Record<string, string[]>;

  constructor(
    statusCode: number,
    message: string,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    if (errors) this.errors = errors;
  }
}

export const validationErrors = (
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join(".") || "_";
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
};
