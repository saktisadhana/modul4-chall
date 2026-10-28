# Modul 4 — Express, Prisma, dan Neon

Implementasi materi Modul 4 serta **Challenge bagian 20 nomor 1 sampai 6**.

Sumber: [Modul 4 lab-kcks](https://github.com/lab-kcks/Modul-Pemrograman-Website-2026/tree/main/modul-4).

## Stack

- Node.js 24+, Express 5, TypeScript, dan `tsx`.
- Prisma ORM **7** dengan driver adapter Neon dan PostgreSQL.
- `bcryptjs` untuk hash password user.
- Vitest dan Supertest untuk pengujian HTTP.

## Menjalankan

Jalankan semua perintah dari folder `modul4_challenge`.

1. Instal dependensi:

   ```sh
   npm ci
   ```

2. Buat project PostgreSQL di [Neon Console](https://console.neon.tech), lalu buka **Connect**.
3. Salin `.env.example` menjadi `.env`. Isi:

   ```env
   DATABASE_URL="<connection string dengan Connection pooling aktif>"
   DATABASE_URL_UNPOOLED="<connection string dengan Connection pooling nonaktif>"
   PORT=3000
   ```

   `DATABASE_URL` dipakai aplikasi; `DATABASE_URL_UNPOOLED` dipakai Prisma CLI. Gunakan connection string Neon yang menyertakan `sslmode=require`. **Jangan commit `.env` atau membagikan connection string.**

4. Jalankan migrasi yang disertakan, lalu generate client:

   ```sh
   npm run db:migrate
   npm run db:generate
   ```

   Migrasi pertama membuat `User` dan `Post`; migrasi kedua menambahkan `Comment` untuk Challenge 1. `db:migrate` menjalankan `prisma migrate dev`; Prisma 7 tidak otomatis menjalankan `generate`. Jika hanya ingin menerapkan migrasi yang sudah tersedia tanpa membuat migrasi development, gunakan `npm run db:deploy`.

5. Periksa tipe dan nyalakan server:

   ```sh
   npm run typecheck
   npm run dev
   ```

6. Cek `GET http://localhost:3000/health`. Endpoint ini menjalankan `SELECT 1` ke database; sukses bila server **dan database** dapat diakses.

> Kredensial Neon tidak disertakan. Migrasi SQL dapat disiapkan tanpa akun Neon, tetapi penerapannya dan pengujian terhadap Neon harus dilakukan setelah `.env` diisi. Request pertama dapat lebih lambat karena cold start Neon.

## Endpoint materi utama

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/` | Informasi API |
| GET | `/health` | Cek koneksi database |
| GET | `/api/food/pizza`, `/api/food/cookie`, `/api/food/donut` | Latihan Router |
| POST | `/api/users` | Membuat user; password disimpan sebagai hash |
| GET | `/api/users` | Daftar user dan jumlah post |
| GET | `/api/users/:id` | Detail user beserta post |
| PATCH | `/api/users/:id` | Mengubah `email` dan/atau `name` |
| DELETE | `/api/users/:id` | Menghapus user serta data terkait secara cascade |
| POST | `/api/posts` | Membuat post dengan `title`, `authorId`, dan `content` opsional |
| GET | `/api/posts` | Daftar post, pencarian judul, filter published, pagination |
| GET | `/api/posts/stats` | Aggregate views dan jumlah post per author, sesuai materi dasar |
| GET | `/api/posts/:id` | Detail post |
| PATCH | `/api/posts/:id` | Mengubah `title`, `content`, dan/atau `published` |
| DELETE | `/api/posts/:id` | Menghapus post beserta komentarnya |

Password tidak dipilih dalam response user maupun relasi. API ini adalah **latihan tanpa login/otorisasi**, mengikuti modul, bukan API siap production. Jalankan lokal dengan data dummy; jangan expose ke internet atau gunakan untuk data pribadi.

## Challenge 20 nomor 1 — Comment

Model `Comment` mempunyai `id`, `content`, `userId`, `postId`, `createdAt`, dan `updatedAt`.
Relasi ke `User` dan `Post` menggunakan **`onDelete: Cascade`**. Menghapus user menghapus komentarnya, termasuk komentarnya di post user lain. Menghapus post juga menghapus semua komentar pada post itu.

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/comments` | Membuat komentar |
| GET | `/api/comments` | Daftar komentar dengan ringkasan user dan post |
| GET | `/api/comments/:id` | Detail komentar |
| PATCH | `/api/comments/:id` | Mengubah `content` saja; relasi tetap |
| DELETE | `/api/comments/:id` | Menghapus komentar |

Contoh body POST (buat user dan post terlebih dahulu; gunakan ID dari response):

```json
{
  "content": "Penjelasannya membantu!",
  "userId": 1,
  "postId": 1
}
```

Contoh PATCH:

```json
{ "content": "Komentar yang sudah diperbarui" }
```

Isi komentar wajib string tidak kosong. Referensi user/post yang tidak ada menghasilkan `404`; ID yang tidak valid menghasilkan `400`.

## Challenge 20 nomor 2 — Post milik satu user

```http
GET /api/users/1/posts?page=2&limit=3&published=false
```

| Query | Default | Aturan |
| --- | --- | --- |
| `page` | `1` | Bilangan bulat positif |
| `limit` | `10` | Bilangan bulat positif; nilai di atas 100 dibatasi menjadi 100 |
| `published` | Tidak difilter | Hanya `true` atau `false`; hilangkan query ini untuk kedua status |

Data dan total dihitung dengan filter `authorId` serta `published` yang sama di dalam transaksi. Urutan post: `createdAt` lalu `id`, keduanya descending, sehingga pagination deterministik saat timestamp sama.

Contoh bentuk response (isi `data` disingkat):

```json
{
  "status": true,
  "message": "Berhasil mengambil data posts user",
  "data": [{ "id": 4, "title": "Post saya", "authorId": 1, "published": false }],
  "metadata": {
    "currentPage": 2,
    "limit": 3,
    "totalItems": 4,
    "totalPages": 2
  }
}
```

- User tidak ada: `404`, bukan daftar kosong.
- User ada tetapi belum punya post: `200`, `data: []`, `totalPages: 0`.
- Halaman melewati data yang tersedia: `200`, `data: []`; total tetap benar.
- Query/ID tidak valid, parameter berulang, atau offset terlalu besar: `400`.
- `published=false` benar-benar menyaring draft, bukan dianggap tanpa filter.

## Challenge 20 nomor 3 dan 4

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/posts/stats/daily` | Jumlah post dan total views per hari, raw query `date_trunc` |
| POST | `/api/posts/bulk` | Menerima array post dan menyimpannya dengan `createMany` |

## Challenge 20 nomor 5: Eksperimen Neon branch

Branch Neon adalah salinan database (copy-on-write) yang terpisah dari branch utama `production`. Perubahan schema maupun data di branch tidak menyentuh `production`.

Langkah yang dilakukan:

1. Di branch `production`: jalankan `npm run db:deploy`, lalu buat user lewat API sebagai data pembanding.
2. Neon Console → **Create child branch**. Parent: `production`, nama: `eksperimen`, opsi **Branch data and schema**.
3. Neon Console → **Connect** → pilih branch `eksperimen`. Salin connection string pooled ke `DATABASE_URL` dan unpooled ke `DATABASE_URL_UNPOOLED` di `.env`. Host branch berbeda dengan host `production` (endpoint `ep-...` lain).
4. `npx prisma migrate status` di branch: kedua migrasi sudah ikut tersalin dari `production`.
5. Eksperimen migrasi: tambahkan sementara kolom `bio String?` pada `User`, lalu `npx prisma migrate dev --name eksperimen_branch`.
6. Restart server, buat user baru lewat API (lihat `requests.http`).
7. Kembalikan `.env` ke `production`, restart server, dan bandingkan.

Hasil observasi:

| | Branch `eksperimen` | Branch `production` |
| --- | --- | --- |
| Kolom `bio` di tabel `User` | Ada | Tidak ada |
| User `branch-test@example.com` | Ada | Tidak ada |
| Data user lama dari `production` | Ikut tersalin saat branch dibuat | Tetap utuh |

Migrasi eksperimen **tidak di-commit**: folder migrasinya dihapus dan `schema.prisma` dikembalikan, supaya riwayat migrasi tim tidak berubah. Opsi **Branch schema only** tidak dipakai karena baris di tabel `_prisma_migrations` tidak ikut tersalin, sehingga Prisma mengira belum ada migrasi dan mencoba membuat ulang tabel yang sudah ada.

## Challenge 20 nomor 6: Validasi input

Validasi ada di `src/utils/parse.ts` (`checkEmail`, `checkPassword`, `checkName`, `throwIfInvalid`) dan dipakai di `POST /api/users` serta `PATCH /api/users/:id`.

| Field | Aturan |
| --- | --- |
| `email` | Wajib, format `nama@domain.tld`, maksimal 254 karakter, disimpan lowercase dan di-trim |
| `password` | Wajib, minimal 8 karakter, maksimal 72 byte (batas bcrypt), harus ada huruf dan angka |
| `name` | Opsional, string atau `null`, maksimal 100 karakter |

Semua field dicek sekaligus, sehingga user langsung melihat semua kesalahan dalam satu response:

```json
{
  "status": false,
  "message": "Validasi gagal, periksa kembali input kalian",
  "errors": {
    "email": "Format email tidak valid, contoh: nama@domain.com",
    "password": "Password minimal 8 karakter"
  }
}
```

Email yang sudah terdaftar menghasilkan `409` (`Email sudah terdaftar` saat create, `Email sudah dipakai user lain` saat PATCH).

## Mencoba API

File [`requests.http`](requests.http) menyediakan urutan request: buat user → buat post → buat/edit/hapus komentar → cek post per user. Buka dengan HTTP client yang mendukung file `.http`, atau salin request-nya ke Postman. Isi variabel ID sesuai response, jangan mengasumsikan ID selalu mulai dari 1.

## Pengujian

```sh
npm run db:generate
npm run db:validate
npm run typecheck
npm test
npm run test:coverage
```

Generate dan validasi schema tidak membutuhkan koneksi database. Test HTTP menggunakan **mock hanya pada Prisma**, sehingga dapat dijalankan tanpa `.env` dan tanpa mengubah database Neon. Test melewati middleware, router, dan controller Express; ini **bukan** verifikasi koneksi/database end-to-end.

Pengujian otomatis meliputi CRUD, pemetaan error Prisma, JSON rusak, validasi ID/query, sanitasi response password, filter `published=true/false`, pagination, user tidak ditemukan, dan hasil kosong. Setelah tersambung ke Neon, uji cascade secara manual: buat dua user, post milik user pertama dan komentar oleh user kedua; hapus user kedua (komentar hilang, post tetap), lalu buat komentar lagi dan hapus post (komentar ikut hilang).