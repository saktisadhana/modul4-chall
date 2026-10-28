import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generate/validate tidak memerlukan koneksi; migrate tetap membutuhkan URL direct.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? "" },
});
