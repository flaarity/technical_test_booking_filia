# Book-in API

Dokumentasi ini mengikuti route Express saat ini. Base URL lokal: `http://localhost:4000`. Semua response aplikasi menggunakan envelope:

```json
{ "success": true, "message": "OK", "data": {} }
```

Untuk kegagalan:

```json
{
  "success": false,
  "message": "Validasi gagal",
  "errors": { "field": ["Pesan validasi"] }
}
```

## Autentikasi dan akses

Semua route selain `GET /health` memerlukan sesi Clerk. Kirim **session token** pada header `Authorization: Bearer {{token}}` (atau sesi cookie Clerk). `{{token}}` adalah variabel placeholder Postman—isi sendiri dengan session token yang valid, jangan memakai publishable key atau secret key sebagai bearer token.

Backend hanya mencocokkan email Clerk yang telah terverifikasi dengan `workers.email`. Profil dan role dibaca dari database. Akun tanpa worker yang cocok mendapat 403; operasi Admin dicek dengan role dari kolom `workers.role`.

| Akses | Berlaku untuk |
|---|---|
| Publik | Health check |
| Login | Worker atau Admin dengan akun worker yang valid |
| Worker | Hanya role `WORKER` |
| Admin | Hanya role `ADMIN` |

## Ringkasan endpoint

| Method | Path | Akses | Sukses | Keterangan |
|---|---|---|---|---|
| GET | `/health` | Publik | 200 | Status API |
| GET | `/workers/me` | Login | 200 | Profil worker dan role dari database |
| GET | `/rooms` | Login | 200 | Daftar ruangan |
| GET | `/rooms?date=&startTime=&endTime=` | Login | 200 | Daftar beserta `isAvailable` untuk rentang |
| GET | `/rooms/:id` | Login | 200 | Detail ruangan |
| POST | `/rooms` | Admin | 201 | Buat ruangan dan slot |
| PUT | `/rooms/:id` | Admin | 200 | Ubah ruangan dan sinkronkan slot |
| DELETE | `/rooms/:id` | Admin | 200 | Hapus ruangan tanpa booking |
| GET | `/slots?roomId=&date=` | Login | 200 | Slot 60 menit dan ketersediaan |
| GET | `/bookings?roomId=&from=&to=` | Login | 200 | Event kalender ruangan |
| GET | `/bookings/me?page=&limit=` | Worker | 200 | Riwayat worker dengan paginasi |
| POST | `/bookings` | Worker | 201 | Buat booking |

Login/sign-out ditangani oleh Clerk SDK; API ini tidak menyediakan endpoint login aplikasi.

## Health check

`GET /health` tidak memerlukan token.

```json
{
  "success": true,
  "message": "OK",
  "data": { "status": "ok" }
}
```

## Profil worker

`GET /workers/me` memerlukan akun worker terdaftar dan terverifikasi (berlaku untuk role Worker maupun Admin). Respons `data` berisi `workerCode`, `name`, `email`, `phone`, `position`, `role`, dan `photoUrl`.

## Ruangan

### Daftar dan detail

- `GET /rooms` mengembalikan array ruangan, diurutkan berdasarkan nama.
- `GET /rooms/:id` mengembalikan satu ruangan; ID harus bilangan bulat positif.
- Bentuk record mencakup `id`, `name`, `type`, `capacity`, `building`, `floor`, `location`, `facilities`, `image`, `notes`, `openTime`, `closeTime`, `createdAt`, dan `updatedAt`.
- Bila ID tidak ditemukan, respons 404 dengan pesan `Ruangan tidak ditemukan`.

Untuk ketersediaan, kirim ketiga query parameter bersama-sama:

```http
GET /rooms?date=2099-01-01&startTime=09:00&endTime=11:00
```

Tanggal harus `YYYY-MM-DD`, tidak lampau menurut `Asia/Jakarta`; jam harus tepat (`HH:00`) dan `endTime` lebih besar dari `startTime`. Setiap ruangan mendapat `isAvailable`. Nilainya `false` jika di luar jam operasional, slot yang dibutuhkan tidak lengkap, atau ada slot yang sudah dipesan.

### Membuat dan mengubah (Admin)

`POST /rooms` membuat ruangan dan slot jamannya dalam satu transaksi (201). `PUT /rooms/:id` memakai body dan validasi yang sama (200).

```json
{
  "name": "Ruang Kappa A",
  "type": "ONSITE",
  "building": "Gedung A",
  "floor": 2,
  "capacity": 8,
  "openTime": "09:00",
  "closeTime": "18:00",
  "facilities": ["Wi-Fi", "Whiteboard"],
  "image": null,
  "notes": null
}
```

Aturan utama:

- `name`: wajib, 2–100 karakter; `type`: `ONSITE` atau `ONLINE` (case-insensitive).
- Onsite memerlukan `building` (maksimum 50 karakter) dan `floor` integer 0–100. Untuk Online keduanya disimpan sebagai `null`.
- `capacity`: integer 1–500.
- `openTime` dan `closeTime`: format jam tepat `HH:00`, antara `00:00` dan `23:00`; waktu tutup harus sesudah waktu buka.
- `facilities`: array string tidak kosong bila item disertakan (default array kosong).
- `image`: URL valid maksimum 255 karakter bila diisi; `notes`: maksimum 200 karakter bila diisi.
- `location` dibentuk server: `Lantai {floor} {building}` atau `Online`. Jangan kirim `location` dari klien.
- Slot dibuat per 60 menit. Saat jam operasional berubah, slot yang diperlukan ditambahkan/diperbarui; slot di luar rentang hanya dihapus bila tidak pernah terkait booking.

PUT mengembalikan 404 bila ruangan tidak ada. Mengurangi kapasitas di bawah jumlah peserta pada booking mendatang menghasilkan 409 dengan pesan backend.

### Menghapus (Admin)

`DELETE /rooms/:id` mengembalikan 200 dengan `data: { "id": ... }`. Bila tidak ditemukan, 404. Bila ada booking kapan pun (mendatang maupun lampau), 409 dengan pesan:

```text
Ruangan memiliki booking dan tidak dapat dihapus
```

## Slot

`GET /slots?roomId=1&date=2099-01-01` memerlukan `roomId` bilangan bulat positif. `date` opsional dan, bila dikirim, harus tanggal valid `YYYY-MM-DD`. Tanpa tanggal semua slot ditandai tersedia; dengan tanggal, slot yang ditutup booking (termasuk slot lanjutan booking multi-jam) ditandai tidak tersedia.

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": 1,
      "roomId": 1,
      "time": "08:00-09:00",
      "startTime": "08:00",
      "endTime": "09:00",
      "isAvailable": true
    }
  ]
}
```

Ruangan tidak ada menghasilkan 404. Parameter atau tanggal tidak valid menghasilkan 422.

## Kalender booking

`GET /bookings?roomId=1&from=2099-01-01&to=2099-01-07` dapat digunakan Worker atau Admin yang terautentikasi. `roomId`, `from`, dan `to` wajib; rentang maksimal 31 hari dan `from` tidak boleh sesudah `to`. Ruangan tidak ditemukan menghasilkan 404.

Setiap event hanya memuat `id`, `roomId`, `date`, `startTime`, `endTime`, `bookedBy` (nama snapshot pemesan), dan `isMine`. Email dan nomor telepon tidak dikembalikan.

## Riwayat worker

`GET /bookings/me?page=1&limit=10` hanya untuk Worker. `page` minimal 1 (default 1); `limit` 1–100 (default 10). Data terbaru dikembalikan lebih dahulu. Respons `data` berbentuk:

```json
{
  "items": [
    {
      "id": 12,
      "code": "BK-7F3A9C",
      "roomName": "Ruang Alpha A",
      "date": "2099-01-01",
      "hari": "Kamis",
      "startTime": "09:00",
      "endTime": "11:00",
      "status": "Akan Datang",
      "description": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

Status dihitung dari tanggal/jam saat request dengan zona `Asia/Jakarta`: `Akan Datang`, `Sedang Berlangsung`, atau `Selesai`.

## Membuat booking

`POST /bookings` hanya menerima Worker. Contoh body:

```json
{
  "roomId": 1,
  "slotId": 3,
  "date": "2099-01-01",
  "durationMinutes": 120,
  "participants": 3,
  "description": "Rapat sprint"
}
```

`slotId` adalah slot awal. Durasi minimal 60 menit dan kelipatan 60. Tanggal berbentuk `YYYY-MM-DD` dan tidak boleh lampau; untuk tanggal hari ini, jam mulai harus belum lewat. `participants` wajib integer minimal 1 dan tidak boleh melebihi kapasitas ruangan. `description` opsional dan maksimal 200 karakter. Worker ID, nama, email, dan nomor telepon diambil dari akun worker di database; nilai kontak dari body tidak digunakan.

Respons 201 menyertakan `id`, `code`, `roomId`, `date`, `startTime`, `endTime`, `durationMinutes`, `participants`, dan `description`. Seluruh slot yang dicakup disimpan sebagai `booking_slots` dalam transaksi yang sama.

## Status error

| HTTP | Pemakaian |
|---|---|
| 401 | Token/sesi tidak ada, tidak valid, atau kedaluwarsa |
| 403 | Akun tidak terdaftar, atau role tidak berhak |
| 404 | Ruangan, slot, atau endpoint tidak ditemukan |
| 409 | Slot bentrok, peserta melebihi kapasitas, durasi melewati jam tutup, atau konflik kapasitas saat update ruangan |
| 422 | Validasi parameter/body; response menyertakan pesan per field dalam `errors` |
| 500 | Kesalahan tak terduga; detail internal hanya dicatat di log server |

Respons validasi memakai `errors: { namaField: ["pesan"] }`. Memilih slot yang bukan milik `roomId` pada pembuatan booking menghasilkan 422; room/slot yang tidak ada menghasilkan 404. Unique constraint pada slot dan tanggal mencegah booking tumpang tindih pada request bersamaan; konflik dikembalikan sebagai 409.

## Koleksi Postman

Impor [book-in.postman_collection.json](postman/book-in.postman_collection.json). Atur `baseUrl`, `token`, `roomId`, dan `slotId` pada Collection Variables. Variabel token disediakan kosong; koleksi tidak menyertakan token atau data pribadi.
