// Select eksplisit dipakai juga pada relasi agar hash password tidak ikut terkirim.
export const userSummary = { id: true, name: true, email: true } as const;
export const authorSelect = { select: userSummary };
