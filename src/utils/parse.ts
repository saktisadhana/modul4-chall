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
