import "dotenv/config";
import app from "./app";
import prisma from "./config/prisma";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT harus berupa bilangan bulat antara 1 dan 65535");
}

// API latihan tanpa autentikasi: hanya dengarkan koneksi lokal.
const server = app.listen(port, "127.0.0.1", (error?: Error) => {
  if (error) {
    console.error("Server gagal dijalankan:", error.message);
    void prisma.$disconnect().finally(() => { process.exitCode = 1; });
    return;
  }
  console.log(`Server berjalan di http://127.0.0.1:${port}`);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const timer = setTimeout(() => server.closeAllConnections(), 10_000);
  timer.unref();
  // Selesaikan request aktif sebelum melepaskan koneksi database.
  server.close(async (error) => {
    try {
      await prisma.$disconnect();
      process.exitCode = error ? 1 : 0;
    } catch {
      console.error("Gagal menutup koneksi database");
      process.exitCode = 1;
    } finally {
      clearTimeout(timer);
    }
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
