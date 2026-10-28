import { HttpError } from "./http-error";

const MAX_INT = 2_147_483_647;

export const parseId = (value: unknown): number => {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !/^\d+$/.test(value))
  ) {
    throw new HttpError(400, "ID harus berupa bilangan bulat positif");
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > MAX_INT) {
    throw new HttpError(400, "ID harus berupa bilangan bulat positif dalam rentang Int");
  }
  return id;
};

export const parsePagination = (query: Record<string, unknown>) => {
  const positiveInteger = (value: unknown, fallback: number, field: string): number => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
      throw new HttpError(400, `${field} harus berupa bilangan bulat positif`);
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) {
      throw new HttpError(400, `${field} harus berupa bilangan bulat positif`);
    }
    return number;
  };

  const page = positiveInteger(query.page, 1, "page");
  const limit = Math.min(positiveInteger(query.limit, 10, "limit"), 100);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > MAX_INT) {
    throw new HttpError(400, "Offset pagination terlalu besar");
  }
  return { page, limit, skip };
};

export const parsePublished = (value: unknown): boolean | undefined => {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new HttpError(400, "published hanya boleh true atau false");
};

export const parseBody = (value: unknown): Record<string, unknown> => {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "Body harus berupa object JSON");
  }
  return value as Record<string, unknown>;
};

export const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${field} wajib diisi dengan string tidak kosong`);
  }
  return value.trim();
};

export const nullableText = (value: unknown, field: string): string | null => {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} harus berupa string atau null`);
  }
  return value;
};

// ===== Challenge 6: validasi input user =====
// Setiap fungsi check mengembalikan pesan error (string), atau null kalau valid.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const checkEmail = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return "Email wajib diisi";
  const email = value.trim();
  if (email.length > 254) return "Email maksimal 254 karakter";
  if (!EMAIL_PATTERN.test(email)) return "Format email tidak valid, contoh: nama@domain.com";
  return null;
};

export const checkPassword = (value: unknown): string | null => {
  if (typeof value !== "string" || value.length === 0) return "Password wajib diisi";
  if (value.length < 8) return "Password minimal 8 karakter";
  // bcrypt hanya membaca 72 byte pertama, sisanya terpotong diam-diam
  if (Buffer.byteLength(value, "utf8") > 72) return "Password maksimal 72 byte";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "Password harus mengandung huruf dan angka";
  return null;
};

export const checkName = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "Name harus berupa string atau null";
  if (value.trim().length > 100) return "Name maksimal 100 karakter";
  return null;
};

// Kumpulkan semua error sekaligus, lalu lempar satu HttpError 400 kalau ada yang gagal
export const throwIfInvalid = (checks: Record<string, string | null>): void => {
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(checks)) {
    if (message !== null) errors[field] = message;
  }
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, "Validasi gagal, periksa kembali input kalian", errors);
  }
};