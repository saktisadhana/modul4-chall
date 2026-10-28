export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Opsional: daftar error per field, misal { email: "Format email tidak valid" }
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}