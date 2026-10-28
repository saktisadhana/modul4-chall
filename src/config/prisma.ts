import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL belum diisi. Salin .env.example menjadi .env dan isi connection string pooled Neon.");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

export default prisma;
