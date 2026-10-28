import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

const db = vi.hoisted(() => {
  const model = () => ({
    create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(),
    update: vi.fn(), delete: vi.fn(), count: vi.fn(),
    aggregate: vi.fn(), groupBy: vi.fn(),
  });
  return {
    user: model(), post: model(), comment: model(),
    $transaction: vi.fn(), $queryRaw: vi.fn(),
  };
});

// Hanya batas database yang di-mock; request tetap melewati Express/router/controller.
vi.mock("../src/config/prisma", () => ({ default: db }));
import app from "../src/app";

const user = { id: 1, email: "budi@example.com", name: "Budi" };
const post = { id: 2, title: "Belajar Express", content: null, authorId: 1, published: false, views: 0 };
const comment = { id: 3, content: "Materinya menarik", userId: 1, postId: 2, user, post: { id: 2, title: post.title } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.$transaction.mockImplementation((queries: Promise<unknown>[]) => Promise.all(queries));
  db.user.findUnique.mockResolvedValue(user);
  db.user.findMany.mockResolvedValue([user]);
  db.post.findUnique.mockResolvedValue(post);
  db.post.findMany.mockResolvedValue([post]);
  db.post.count.mockResolvedValue(1);
  db.comment.findUnique.mockResolvedValue(comment);
  db.comment.findMany.mockResolvedValue([comment]);
});
afterEach(() => vi.restoreAllMocks());

describe("Dasar API dan error handling", () => {
  it("menampilkan informasi server", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
  });

  it.each(["pizza", "cookie", "donut"])("menyediakan route food %s", async (food) => {
    expect((await request(app).get(`/api/food/${food}`)).status).toBe(200);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`GET /api/food/${food} -> 200`));
  });

  it("memeriksa database melalui health", async () => {
    db.$queryRaw.mockResolvedValue([{ value: 1 }]);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("mengirim JSON 404 untuk endpoint yang tidak ada", async () => {
    const res = await request(app).get("/tidak-ada");
    expect(res.status).toBe(404);
    expect(res.body.status).toBe(false);
  });

  it("menolak JSON rusak", async () => {
    const res = await request(app).post("/api/comments").set("Content-Type", "application/json").send('{"content":');
    expect(res.status).toBe(400);
    expect(res.body.status).toBe(false);
  });

  it.each([
    ["P2002", 409], ["P2025", 404], ["P2003", 400],
  ])("memetakan error Prisma %s menjadi %i", async (code, status) => {
    db.comment.delete.mockRejectedValue({ code });
    const res = await request(app).delete("/api/comments/3");
    expect(res.status).toBe(status);
    expect(res.body.status).toBe(false);
  });

  it("tidak membocorkan detail error internal", async () => {
    db.post.findMany.mockRejectedValue(new Error("database password=secret"));
    const res = await request(app).get("/api/posts");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(res.body.status).toBe(false);
  });

  it("menyediakan statistik harian post", async () => {
    db.$queryRaw.mockResolvedValue([
      { day: "2026-10-28", totalPosts: 2, totalViews: 45 },
      { day: "2026-10-29", totalPosts: 1, totalViews: 12 },
    ]);
    const res = await request(app).get("/api/posts/stats/daily");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { day: "2026-10-28", totalPosts: 2, totalViews: 45 },
      { day: "2026-10-29", totalPosts: 1, totalViews: 12 },
    ]);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
  });

  it("membuat post secara bulk", async () => {
    db.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    db.post.createMany.mockResolvedValue({ count: 2 });
    const payload = [
      { title: "Judul 1", authorId: 1, content: "Isi 1", published: true },
      { title: "Judul 2", authorId: 2, content: "Isi 2" },
    ];
    const res = await request(app).post("/api/posts/bulk").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ count: 2, posts: payload });
    expect(db.post.createMany).toHaveBeenCalledWith({ data: payload });
  });
});

describe("CRUD User dari modul", () => {
  it("membuat user dengan password di-hash, tanpa mengembalikannya", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(user);
    const res = await request(app).post("/api/users").send({ ...user, password: "rahasia123" });
    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty("password");
    const args = db.user.create.mock.calls[0]![0];
    expect(await bcrypt.compare("rahasia123", args.data.password)).toBe(true);
    expect(args.select.password).not.toBe(true);
    expect(args.data).not.toHaveProperty("id");
  });

  it("menolak email duplikat", async () => {
    const res = await request(app).post("/api/users").send({ email: user.email, password: "rahasia123" });
    expect(res.status).toBe(409);
  });

  it.each([undefined, {}, { email: 4, password: "secret" }, { email: "a@b.com", password: {} }])("menolak data user tidak valid: %j", async (body) => {
    const res = await request(app).post("/api/users").send(body);
    expect(res.status).toBe(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("mengambil daftar user tanpa memilih password", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([user]);
    expect(db.user.findMany.mock.calls[0]![0].select.password).not.toBe(true);
  });

  it("mengambil detail user", async () => {
    const res = await request(app).get("/api/users/1");
    expect(res.status).toBe(200);
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 }, select: expect.any(Object) }));
  });

  it("mengembalikan 404 untuk user tidak ada", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect((await request(app).get("/api/users/999")).status).toBe(404);
  });

  it("mengubah sebagian data user, termasuk name null", async () => {
    db.user.update.mockResolvedValue({ ...user, name: null });
    const res = await request(app).patch("/api/users/1").send({ name: null });
    expect(res.status).toBe(200);
    expect(db.user.update.mock.calls[0]![0].data).toEqual({ name: null });
  });

  it("menolak patch user kosong", async () => {
    expect((await request(app).patch("/api/users/1").send({})).status).toBe(400);
  });

  it("menghapus user", async () => {
    db.user.delete.mockResolvedValue(user);
    expect((await request(app).delete("/api/users/1")).status).toBe(200);
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

describe("CRUD Post dari modul", () => {
  it("membuat post dengan author yang valid", async () => {
    db.post.create.mockResolvedValue(post);
    const res = await request(app).post("/api/posts").send({ title: post.title, authorId: 1 });
    expect(res.status).toBe(201);
    expect(db.post.create.mock.calls[0]![0].data).toMatchObject({ title: post.title, authorId: 1 });
    expect(db.post.create.mock.calls[0]![0].include.author.select.password).not.toBe(true);
  });

  it.each([{}, { title: " " , authorId: 1 }, { title: "Judul", authorId: true }, { title: "Judul", authorId: 1, content: 4 }])("menolak data post tidak valid: %j", async (body) => {
    expect((await request(app).post("/api/posts").send(body)).status).toBe(400);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("menolak author yang tidak ada", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect((await request(app).post("/api/posts").send({ title: "Judul", authorId: 9 })).status).toBe(404);
  });

  it("mencari judul sekaligus filter published dan pagination", async () => {
    const res = await request(app).get("/api/posts?search=express&published=true&page=2&limit=5");
    expect(res.status).toBe(200);
    const args = db.post.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ title: { contains: "express", mode: "insensitive" }, published: true });
    expect(args).toMatchObject({ skip: 5, take: 5 });
    expect(db.post.count).toHaveBeenCalledWith({ where: args.where });
    expect(res.body.metadata).toEqual({ currentPage: 2, limit: 5, totalItems: 1, totalPages: 1 });
  });

  it("menyediakan statistik dasar sebelum route ID", async () => {
    db.post.aggregate.mockResolvedValue({ _count: { id: 1 }, _sum: { views: 0 } });
    db.post.groupBy.mockResolvedValue([{ authorId: 1, _count: { id: 1 } }]);
    const res = await request(app).get("/api/posts/stats");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("overall");
    expect(res.body.data).toHaveProperty("perAuthor");
  });

  it("mengambil detail post", async () => {
    expect((await request(app).get("/api/posts/2")).body.data.id).toBe(2);
  });

  it("mengembalikan 404 untuk post yang tidak ada", async () => {
    db.post.findUnique.mockResolvedValue(null);
    expect((await request(app).get("/api/posts/999")).status).toBe(404);
  });

  it("menerima published false dan mengosongkan content lewat PATCH", async () => {
    db.post.update.mockResolvedValue({ ...post, published: false, content: null });
    const res = await request(app).patch("/api/posts/2").send({ published: false, content: null });
    expect(res.status).toBe(200);
    expect(db.post.update.mock.calls[0]![0].data).toEqual({ published: false, content: null });
  });

  it.each([{}, { title: "" }, { published: "false" }, { content: {} }])("menolak patch post tidak valid: %j", async (body) => {
    expect((await request(app).patch("/api/posts/2").send(body)).status).toBe(400);
  });

  it("menghapus post", async () => {
    db.post.delete.mockResolvedValue(post);
    expect((await request(app).delete("/api/posts/2")).status).toBe(200);
    expect(db.post.delete).toHaveBeenCalledWith({ where: { id: 2 } });
  });
});

describe("Challenge 20 nomor 1: CRUD Comment", () => {
  it("membuat komentar yang terhubung ke user dan post", async () => {
    db.comment.create.mockResolvedValue(comment);
    const res = await request(app).post("/api/comments").send({ content: comment.content, userId: 1, postId: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(comment);
    expect(db.comment.create.mock.calls[0]![0]).toMatchObject({
      data: { content: comment.content, userId: 1, postId: 2 },
      include: { user: { select: { id: true, name: true, email: true } }, post: { select: { id: true, title: true } } },
    });
  });

  it.each([
    undefined, {}, { content: " ", userId: 1, postId: 2 },
    { content: 123, userId: 1, postId: 2 }, { content: "Komentar", userId: 0, postId: 2 },
    { content: "Komentar", userId: 1, postId: 1.5 }, { content: "Komentar", userId: [], postId: 2 },
  ])("menolak komentar tidak valid: %j", async (body) => {
    expect((await request(app).post("/api/comments").send(body)).status).toBe(400);
    expect(db.comment.create).not.toHaveBeenCalled();
  });

  it.each(["user", "post"] as const)("mengembalikan 404 ketika %s tidak ada", async (model) => {
    db[model].findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/comments").send({ content: "Komentar", userId: 1, postId: 2 });
    expect(res.status).toBe(404);
    expect(db.comment.create).not.toHaveBeenCalled();
  });

  it("mengambil semua komentar", async () => {
    const res = await request(app).get("/api/comments");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([comment]);
  });

  it("mengambil satu komentar", async () => {
    const res = await request(app).get("/api/comments/3");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(3);
    expect(db.comment.findUnique.mock.calls[0]![0].where).toEqual({ id: 3 });
  });

  it("mengembalikan 404 untuk komentar yang tidak ada", async () => {
    db.comment.findUnique.mockResolvedValue(null);
    expect((await request(app).get("/api/comments/999")).status).toBe(404);
  });

  it("mengedit isi komentar tanpa mengubah relasinya", async () => {
    db.comment.update.mockResolvedValue({ ...comment, content: "Isi baru" });
    const res = await request(app).patch("/api/comments/3").send({ content: "Isi baru", userId: 99 });
    expect(res.status).toBe(200);
    expect(db.comment.update.mock.calls[0]![0].data).toEqual({ content: "Isi baru" });
  });

  it.each([{}, { content: " " }, { content: false }, { content: null }])("menolak patch komentar: %j", async (body) => {
    expect((await request(app).patch("/api/comments/3").send(body)).status).toBe(400);
  });

  it("menghapus komentar", async () => {
    db.comment.delete.mockResolvedValue(comment);
    expect((await request(app).delete("/api/comments/3")).status).toBe(200);
    expect(db.comment.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });

  it.each(["abc", "0", "-1", "1.5", "2147483648"])("menolak ID komentar %s", async (id) => {
    expect((await request(app).get(`/api/comments/${id}`)).status).toBe(400);
    expect(db.comment.findUnique).not.toHaveBeenCalled();
  });
});

describe("Challenge 20 nomor 2: post milik user", () => {
  it("menerapkan authorId, published false dan pagination ke data serta count", async () => {
    db.post.count.mockResolvedValue(7);
    const res = await request(app).get("/api/users/1/posts?page=2&limit=3&published=false");
    expect(res.status).toBe(200);
    const args = db.post.findMany.mock.calls[0]![0];
    expect(args).toMatchObject({ where: { authorId: 1, published: false }, skip: 3, take: 3 });
    expect(args.orderBy).toBeDefined();
    expect(db.post.count).toHaveBeenCalledWith({ where: { authorId: 1, published: false } });
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(res.body.metadata).toEqual({ currentPage: 2, limit: 3, totalItems: 7, totalPages: 3 });
  });

  it("tanpa filter mengembalikan semua status dengan default page/limit", async () => {
    const res = await request(app).get("/api/users/1/posts");
    expect(res.status).toBe(200);
    expect(db.post.findMany.mock.calls[0]![0]).toMatchObject({ where: { authorId: 1 }, skip: 0, take: 10 });
    expect(res.body.metadata.currentPage).toBe(1);
    expect(res.body.metadata.limit).toBe(10);
  });

  it("menerapkan published true", async () => {
    await request(app).get("/api/users/1/posts?published=true");
    expect(db.post.count).toHaveBeenCalledWith({ where: { authorId: 1, published: true } });
  });

  it("membatasi limit maksimal 100", async () => {
    const res = await request(app).get("/api/users/1/posts?limit=999");
    expect(res.status).toBe(200);
    expect(db.post.findMany.mock.calls[0]![0].take).toBe(100);
    expect(res.body.metadata.limit).toBe(100);
  });

  it("mengembalikan array kosong untuk user tanpa post", async () => {
    db.post.findMany.mockResolvedValue([]);
    db.post.count.mockResolvedValue(0);
    const res = await request(app).get("/api/users/1/posts");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.metadata.totalPages).toBe(0);
  });

  it("halaman melewati total tetap sukses dengan array kosong", async () => {
    db.post.findMany.mockResolvedValue([]);
    db.post.count.mockResolvedValue(7);
    const res = await request(app).get("/api/users/1/posts?page=9&limit=3");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.metadata.totalItems).toBe(7);
  });

  it("membedakan user tidak ada dari user tanpa post", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect((await request(app).get("/api/users/999/posts")).status).toBe(404);
    expect(db.post.findMany).not.toHaveBeenCalled();
  });

  it.each([
    "page=0", "page=-1", "page=1.5", "page=abc", "limit=0", "limit=NaN",
    "limit=1.5", "published=yes", "published=", "published=true&published=false",
    "page=1&page=2", "page=9007199254740992", "page=2147483647&limit=100",
  ])("menolak query tidak valid: %s", async (query) => {
    expect((await request(app).get(`/api/users/1/posts?${query}`)).status).toBe(400);
    expect(db.post.findMany).not.toHaveBeenCalled();
  });

  it("menolak user ID non-angka", async () => {
    expect((await request(app).get("/api/users/abc/posts")).status).toBe(400);
  });
});

describe("Challenge 20 nomor 6: validasi input user", () => {
  it("mengembalikan semua error field sekaligus", async () => {
    const res = await request(app).post("/api/users").send({ email: "budi", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe(false);
    expect(res.body.errors).toEqual({
      email: "Format email tidak valid, contoh: nama@domain.com",
      password: "Password minimal 8 karakter",
    });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it.each([
    ["budi@", "Format email tidak valid, contoh: nama@domain.com"],
    ["budi @example.com", "Format email tidak valid, contoh: nama@domain.com"],
    ["", "Email wajib diisi"],
  ])("menolak email %j", async (email, message) => {
    const res = await request(app).post("/api/users").send({ email, password: "rahasia123" });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBe(message);
  });

  it.each([
    ["rahasia", "Password minimal 8 karakter"],
    ["rahasiaaa", "Password harus mengandung huruf dan angka"],
    ["12345678", "Password harus mengandung huruf dan angka"],
    ["a1".repeat(40), "Password maksimal 72 byte"],
  ])("menolak password %j", async (password, message) => {
    const res = await request(app).post("/api/users").send({ email: "a@b.com", password });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBe(message);
  });

  it("menyimpan email dalam lowercase dan tanpa spasi", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(user);
    const res = await request(app).post("/api/users").send({ email: "  Budi@Example.COM ", password: "rahasia123" });
    expect(res.status).toBe(201);
    expect(db.user.create.mock.calls[0]![0].data.email).toBe("budi@example.com");
  });

  it("memvalidasi email saat PATCH dan menolak email milik user lain", async () => {
    const invalid = await request(app).patch("/api/users/1").send({ email: "salah" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors.email).toBeDefined();

    db.user.findUnique.mockResolvedValue({ id: 2 });
    const taken = await request(app).patch("/api/users/1").send({ email: "andi@example.com" });
    expect(taken.status).toBe(409);
    expect(taken.body.message).toBe("Email sudah dipakai user lain");
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("menolak name yang terlalu panjang", async () => {
    const res = await request(app).post("/api/users").send({ email: "a@b.com", password: "rahasia123", name: "x".repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.errors.name).toBe("Name maksimal 100 karakter");
  });
});