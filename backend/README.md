# Book-in Backend

REST API Book-in menggunakan Express, TypeScript, Prisma, PostgreSQL, dan Clerk. Prisma memakai generator `prisma-client` di `generated/prisma` serta adapter PostgreSQL.

## Menjalankan lokal

Dari folder `backend`:

```powershell
npm ci
Copy-Item .env.example .env
```

Isi variabel di `.env`, lalu jalankan:

```powershell
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
npm run db:seed
npm run dev
```

API lokal tersedia di `http://localhost:4000`; health check ada di `/health`. Seeder membutuhkan empat variabel `SEED_*`, dan `SEED_ADMIN_EMAIL` harus berbeda dari `SEED_WORKER_EMAIL`. Seeder memperbarui data pekerja/ruangan contoh dan membangun ulang booking dengan kode `BK-SEED*`; gunakan database pengembangan yang sesuai.

## Script

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan server dengan `tsx watch` |
| `npm run build` | Mengompilasi TypeScript ke `dist/` |
| `npm start` | Menjalankan hasil kompilasi |
| `npm test` | Menjalankan unit test Vitest `src/lib/booking-time.test.ts` |
| `npm run db:seed` | Menjalankan seeder melalui konfigurasi Prisma |
| `npm run postinstall` | Sinkronisasi skill Prisma best-effort (otomatis dipanggil package manager saat install; bukan langkah migrasi) |

Tidak ada script lint di package backend saat ini.

## Struktur utama

- `src/routes/` — route worker, rooms, slots, dan bookings.
- `src/middleware/` — autentikasi/otorisasi Clerk dan error handler.
- `src/lib/` — Prisma client, validasi, respons, error, dan fungsi waktu.
- `prisma/schema.prisma` — skema data; `prisma/migrations/` — migrasi yang disimpan di Git.
- `prisma/seed.ts` — data demo idempotent.
- `generated/prisma/` — client yang dihasilkan, tidak disimpan di Git.

## Environment

Lihat [.env.example](.env.example). Variabel yang digunakan: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `FRONTEND_ORIGIN`, `PORT`, `NODE_ENV`, serta `SEED_WORKER_EMAIL`, `SEED_WORKER_NAME`, `SEED_ADMIN_EMAIL`, dan `SEED_ADMIN_NAME` untuk seeder. `DATABASE_URL` harus memakai koneksi PostgreSQL langsung (`postgres://` atau `postgresql://`), bukan URL Prisma Accelerate `prisma+postgres://`. `sslmode=verify-full` dapat ditambahkan sesuai URL koneksi penyedia.

Dokumentasi lengkap ada di [API reference](../docs/api.md) dan [README root](../README.md).
