# Book-in Frontend

Frontend Book-in memakai React, Vite, dan TypeScript. Aplikasi mengambil data dari backend Express dan menggunakan Clerk untuk login; tidak ada mode `json-server`.

## Menjalankan lokal

Dari folder `frontend`:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Isi `VITE_CLERK_PUBLISHABLE_KEY` di `.env` dari Clerk Dashboard → **API Keys**. Atur `VITE_API_BASE_URL` ke alamat backend (default lokal: `http://localhost:4000`). Vite membuka aplikasi di `http://localhost:5173`.

## Script

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan Vite dalam mode pengembangan |
| `npm run build` | Type-check TypeScript dan membuat build produksi |
| `npm run lint` | Menjalankan ESLint |
| `npm test` | Menjalankan unit test Vitest |
| `npm run preview` | Menyajikan build produksi untuk preview |

## Struktur utama

- `src/lib/api.ts` — lapisan request API.
- `src/components/` — layout, route guard, kartu, kalender/timeline, dan dialog.
- `src/context/` — konteks profil worker.
- `src/hooks/` — pemuatan booking kalender.
- `src/lib/` — API client, filter, validasi, pemformatan, dan fungsi murni yang dites.
- `src/pages/` — Beranda, Ruang Rapat, Detail, Riwayat, dan halaman Admin.

## Environment

| Variabel | Fungsi |
|---|---|
| `VITE_API_BASE_URL` | Base URL API, default lokal `http://localhost:4000` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable key dari Clerk Dashboard → **API Keys** |

Lihat [README root](../README.md) untuk setup database, migrasi, seeder, dan autentikasi lengkap.
