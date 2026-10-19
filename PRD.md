# PRD: Sistem Booking Ruang Meeting

**Jenis dokumen:** Product Requirements Document (Frontend + Backend)  
**Konteks:** Technical Test, batas waktu 3 hari sejak soal diterima  
**Pengumpulan:** Link repository GitHub (public) + dokumentasi

## 1. Ringkasan

Sebuah perusahaan membutuhkan aplikasi internal agar karyawan dapat melihat dan memesan ruang rapat kantor secara online tanpa biaya sewa. Proyek ini terdiri dari dua bagian yang berbagi satu kontrak API: **Frontend** (alur booking web) dan **Backend** (REST API + database relasional). Keduanya bisa dikerjakan terpisah; Frontend dikembangkan dulu di atas mock API `json-server`, lalu bisa dipindah ke Backend asli tanpa mengubah UI.

**Alur booking:**

Login Clerk → Galeri Ruang Rapat + Filter → Detail Ruangan/Kalender → Popup Booking → Konfirmasi → Sukses

## 2. Tujuan dan Non-Tujuan

**Tujuan**

- Karyawan dapat menemukan dan memesan ruang rapat kantor melalui galeri ruangan dan kalender jadwal.
- Backend menjamin tidak ada double booking dan data yang masuk selalu valid.
- Project mudah dijalankan oleh penilai hanya dengan membaca README.

**Non-tujuan (di luar scope)**

- Pembayaran, notifikasi email, dan manajemen user/role lewat UI (role diatur lewat database/seeder).
- Dashboard admin untuk melihat semua booking, pembatalan, dan reschedule booking.
- Multi-bahasa dan multi-timezone.

## 3. Kriteria Penilaian dan Pemetaannya

| Aspek | Yang dinilai | Dipenuhi lewat |
|---|---|---|
| Fungsionalitas | Alur / endpoint berjalan sesuai ketentuan | Bagian 6 dan 7 (FR) |
| Kualitas kode | Struktur rapi, penamaan jelas, mudah dibaca | Bagian 8 (struktur project) |
| Frontend: Desain & UX | Menarik, konsisten, responsif | Bagian 6.4 dan 6.5 |
| Backend: Validasi & data | Validasi, error handling, desain database | Bagian 7.2 sampai 7.5 |
| Dokumentasi | README jelas, mudah dijalankan | Bagian 9 |

## 4. Persona dan User Story

**Persona:** Budi, karyawan/freelancer yang perlu ruang meeting untuk 3 orang, memesan dari HP maupun laptop, cukup login dengan akun Google.

- Sebagai Worker, saya ingin melihat daftar ruangan beserta kapasitas, lokasi, jam operasional, dan fasilitas agar bisa memilih ruangan yang cocok.
- Sebagai Worker, saya ingin memfilter ruangan berdasarkan tanggal, waktu, durasi, kapasitas, gedung, fasilitas, dan tipe ruangan, lalu hanya memesan jadwal yang tersedia.
- Sebagai Worker, saya ingin data nama dan email terisi dari akun yang login serta mengisi detail rapat dengan validasi yang jelas.
- Sebagai Worker, saya ingin meninjau ringkasan rapat sebelum konfirmasi dan menerima kode booking setelah sukses.

## 5. Kontrak API (dipakai bersama)

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/rooms` | Daftar ruangan: `id, name, capacity, facilities, image, type, location, openTime, closeTime, notes` |
| GET | `/slots?roomId=1` | Slot jam per ruangan: `id, roomId, time, isAvailable` |
| POST | `/bookings` | Membuat booking baru |

Contoh body `POST /bookings`:

```json
{
  "roomId": 1,
  "slotId": 3,
  "date": "2026-10-20",
  "name": "Budi",
  "email": "budi@email.com",
  "phone": "081234567890",
  "participants": 3
}
```

**Asumsi kontrak (dicatat di README):**

1. Field di JSON memakai camelCase (`roomId`, `slotId`, `isAvailable`, `startTime`, `endTime`), kolom database memakai snake_case. Harga tidak termasuk dalam kontrak API.
2. `GET /slots` menerima parameter opsional `date` (`/slots?roomId=1&date=2026-10-20`) agar `isAvailable` dihitung per tanggal. Tanpa `date`, perilaku tetap sesuai kontrak asli. Mock `json-server` mengabaikan `date`.
3. Response `POST /bookings` yang sukses memuat field `code` (kode booking). Pada mock json-server, kode dibuat di sisi klien dengan format `BK-XXXXXX` lalu ikut dikirim di body sehingga dikembalikan apa adanya oleh json-server. Jika `code` tidak ada, UI menampilkan fallback `BK-` + id yang di-pad.
4. Frontend memakai satu lapisan API (`api.js`) yang membuka envelope `{ data }` jika ada, sehingga bisa membaca response json-server (array/objek langsung) maupun response Backend (envelope).

### 5.1 Autentikasi dan Role (tambahan)

Pengguna wajib login melalui **Clerk** sebelum mengakses aplikasi. Google dapat diaktifkan sebagai provider login di pengaturan Clerk. Clerk mengelola sesi dan identitas; backend tetap menyimpan role internal. Setiap akun punya satu status (role): **Admin** atau **Worker**.

| Aksi | Admin | Worker |
|---|---|---|
| Login dengan akun Google | Ya | Ya |
| Melihat galeri ruang rapat dan slot | Ya | Ya |
| Membuat booking ruang meeting | Tidak (asumsi) | **Ya** |
| Menambah ruang rapat (Create) | **Ya** | Tidak |
| Mengubah ruang rapat (Update) | **Ya** | Tidak |
| Menghapus ruang rapat (Delete) | **Ya** | Tidak |

**Aturan dan asumsi:**

- Hanya user berstatus **Admin** yang boleh menambah, mengubah, dan menghapus ruang rapat. Hak akses ditegakkan di **backend** (401/403); UI hanya menyembunyikan tombol sebagai kemudahan.
- Pengguna yang pertama kali masuk otomatis menjadi **Worker** kecuali ditetapkan sebagai Admin melalui seeder atau konfigurasi backend yang aman. Jangan mempercayai role dari data frontend/metadata yang dapat diubah pengguna.
- Admin tidak membuat booking, sesuai pembagian peran. Jika Admin juga perlu booking, cukup tambahkan role admin pada aturan `POST /bookings`.
- **Alur login:** frontend memakai Clerk SDK dan komponen Clerk untuk sign-in/sign-out. Frontend mengirim token sesi Clerk pada request API; backend Express memverifikasi token Clerk menggunakan mekanisme resmi Clerk sebelum membaca identitas dan menerapkan role. Aplikasi tidak membuat JWT sesi sendiri.
- **Mode mock (json-server):** data user dan role dapat disediakan melalui seed/demo lokal. Mock bukan pengganti autentikasi yang aman; proteksi otorisasi sebenarnya wajib diterapkan di backend Express. Jelaskan batasan ini di README.

### 5.2 Kontrak API tambahan

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| Clerk Sign-in | Ditangani Clerk | Publik | Login dan sesi ditangani Clerk SDK; bukan endpoint aplikasi sendiri |
| GET | `/auth/me` | Login | Profil user dari identitas Clerk yang telah diverifikasi dan role internal |
| GET | `/rooms` dan `/slots` | Login | Sama seperti kontrak awal, kini butuh login |
| GET | `/rooms/:id` | Login | Detail satu ruangan |
| POST | `/rooms` | Admin | Tambah ruangan (201) |
| PUT | `/rooms/:id` | Admin | Ubah ruangan |
| DELETE | `/rooms/:id` | Admin | Hapus ruangan |
| POST | `/bookings` | Worker | Sama seperti kontrak awal |

Status code tambahan: **401** (belum login atau token tidak valid) dan **403** (role tidak berhak).

**Field ruangan tambahan** (opsional dan kompatibel dengan kontrak awal; `capacity` ditampilkan sebagai "Maks. X orang"):

| Field | Tipe | Keterangan |
|---|---|---|
| `type` | `onsite` atau `online` | Default `onsite`; `online` untuk akun Zoom, Teams, Meet |
| `location` | string | Contoh "Lantai 2 Gedung A"; otomatis "Online" bila `type` online |
| `openTime`, `closeTime` | `HH:mm` | Jam operasional (contoh 08:00 dan 21:00), dasar pembuatan slot |
| `notes` | string, opsional | Catatan khusus, contoh "Penggunaan ruang membutuhkan izin khusus" |

---

# BAGIAN A: FRONTEND

## 6. Kebutuhan Frontend

### 6.1 Tech stack

- **React 19.3 (Latest Version) + Vite** (TypeScript), CSS Modules atau Tailwind CSS.
- Mock API: `npx json-server@0.17.4 --watch db.json --port 3001`.
- State alur booking memakai satu state terpusat (`useReducer` atau Context) agar pilihan tidak hilang saat tombol Kembali.
- Base URL API dari env: `VITE_API_URL` (default `http://localhost:3001`).

### 6.2 Mock data `db.json`

- Minimal **3 ruangan** dengan kapasitas, fasilitas, lokasi, tipe, dan gambar yang berbeda.
- Beberapa slot per ruangan (contoh 08:00-09:00 sampai 20:00-21:00), sebagian dengan `isAvailable: false` untuk menguji state non aktif.
- `"bookings": []`.

Contoh struktur:

```json
{
  "rooms": [
    { "id": 1, "name": "Ruang Alpha", "capacity": 6,
      "facilities": ["Proyektor", "Whiteboard", "AC"], "image": "https://..." }
  ],
  "slots": [
    { "id": 1, "roomId": 1, "time": "09:00-10:00", "isAvailable": true },
    { "id": 2, "roomId": 1, "time": "10:00-11:00", "isAvailable": false }
  ],
  "bookings": []
}
```

### 6.3 Functional Requirements

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FE-01 | Data ruangan diambil dengan `fetch()` dari `GET /rooms`. | Wajib |
| FE-02 | Data slot diambil dengan `fetch()` dari `GET /slots?roomId=`, dimuat ulang saat ruangan berganti. | Wajib |
| FE-03 | Booking dikirim dengan `fetch()` method `POST /bookings`, body sesuai kontrak. | Wajib |
| FE-04 | **Stepper** 4 langkah (Ruangan, Tanggal & Jam, Data Pemesan, Konfirmasi) dengan penanda langkah aktif dan selesai. | Wajib |
| FE-05 | Tombol **Kembali** dan **Lanjut** di setiap langkah; Kembali mempertahankan isian sebelumnya. | Wajib |
| FE-06 | Tombol **Lanjut non aktif** sampai pilihan langkah itu terisi (langkah 1: ruangan dipilih; langkah 2: tanggal dan slot dipilih; langkah 3: form valid). | Wajib |
| FE-07 | Slot dengan `isAvailable: false` tampil berbeda (disabled, abu-abu, label "Penuh") dan **tidak bisa dipilih** (klik maupun keyboard). | Wajib |
| FE-08 | Validasi form: nama wajib, email wajib dan format valid, nomor HP wajib dan format Indonesia valid, jumlah peserta wajib, bilangan bulat minimal 1 dan tidak melebihi kapasitas ruangan terpilih. | Wajib |
| FE-09 | Tampilkan **state loading** (skeleton/spinner) saat fetch rooms, fetch slots, dan submit booking; tombol submit non aktif saat loading untuk mencegah double submit. | Wajib |
| FE-10 | Tampilkan **state error** dengan pesan ramah dan tombol "Coba lagi" bila fetch gagal; error 409/422 dari API ditampilkan pada konteks yang tepat. | Wajib |
| FE-11 | Langkah Konfirmasi menampilkan ringkasan: ruangan, tanggal, jam, durasi, data pemesan, jumlah peserta, dan paket konsumsi; tidak menampilkan harga. | Wajib |
| FE-12 | Halaman **Sukses** menampilkan **kode booking dari respons API** plus ringkasan, dan tombol "Buat booking baru" yang mereset state. | Wajib |
| FE-13 | Date picker tidak mengizinkan tanggal yang sudah lewat. | Disarankan |
| FE-14 | Empty state bila ruangan atau slot kosong. | Disarankan |
| FE-15 | Jika backend mengembalikan 409 (slot sudah terisi), tampilkan pesan dan arahkan pengguna kembali ke langkah 2 dengan slot dimuat ulang. | Disarankan |

### 6.4 Aturan validasi form

| Field | Aturan | Contoh pesan error |
|---|---|---|
| name | wajib, 2 sampai 100 karakter | "Nama wajib diisi" |
| email | wajib, format email valid | "Format email tidak valid" |
| phone | wajib, regex `^(\+62\|62\|0)8[1-9][0-9]{6,11}$` | "Nomor HP tidak valid (contoh: 081234567890)" |
| participants | wajib, integer, 1 sampai capacity | "Maksimal 6 peserta untuk ruangan ini" |

Validasi berjalan saat blur dan saat submit; pesan error muncul di bawah field terkait, bukan hanya alert.

### 6.5 Desain, UX, dan Responsif

- Gaya konsisten: satu palet warna (primary, netral, status sukses/error), satu keluarga font, skala spasi 4/8 px, komponen tombol, input, dan card yang dipakai ulang.
- **Mobile-first**: layout satu kolom di mobile; di desktop kartu ruangan berbentuk grid 2 sampai 3 kolom dan ringkasan booking tampil sebagai panel samping.
- Breakpoint minimal: 360 px (mobile), 768 px (tablet), 1024 px ke atas (desktop). Tidak ada scroll horizontal.
- Stepper di mobile diringkas (nomor langkah + judul langkah aktif).
- Aksesibilitas dasar: label pada setiap input, fokus terlihat jelas, kontras warna cukup, `aria-disabled` pada slot penuh, `aria-live` untuk pesan error.
- Target sentuh minimal 44 px.

### 6.6 State alur (ringkas)

```
step: 1..5
selectedRoom, selectedDate, selectedSlot
form: { name, email, phone, participants }
status: idle | loading | error | success
bookingResult: { id, code, ... }
```

### 6.7 Struktur project Frontend

```
frontend/
  src/
    api/api.js            # fetch wrapper, base URL, unwrap envelope
    components/           # Stepper, RoomCard, SlotPicker, BookingForm, Summary, Loader, ErrorState
    pages/ atau steps/    # StepRoom, StepSchedule, StepForm, StepConfirm, Success
    hooks/                # useBookingFlow, useFetch
    utils/validators.js   # validasi email, HP, peserta
    styles/
  db.json
  .env.example
  README.md
```

### 6.8 Acceptance Criteria Frontend

- [ ] `json-server` jalan di port 3001 dan 3 ruangan tampil.
- [ ] Lanjut non aktif di setiap langkah sampai pilihan terisi.
- [ ] Slot `isAvailable: false` tidak bisa dipilih.
- [ ] Email/HP/peserta yang salah menampilkan pesan error dan memblokir Lanjut.
- [ ] Loading dan error terlihat jelas (uji dengan mematikan json-server).
- [ ] POST berhasil menambah data ke `bookings` di `db.json` dan halaman sukses menampilkan kode.
- [ ] Tampilan rapi di 360 px dan 1280 px.

### 6.9 Tambahan Frontend: Login, Role, Galeri Bento, dan Halaman Admin

**Alur baru:** Login Google → Galeri ruang rapat (semua ruangan tampil) → *Worker:* Pesan ruangan → Tanggal & Jam → Data Pemesan → Konfirmasi → Sukses. *Admin:* Galeri → Tambah / Edit / Hapus ruangan.

Galeri berfungsi sebagai langkah 1 ("Pilih Ruangan") pada stepper Worker, sehingga ketentuan stepper dan tombol Kembali/Lanjut pada soal tetap terpenuhi. Stepper tidak ditampilkan untuk Admin.

**Rute halaman:**

| Rute | Akses | Isi |
|---|---|---|
| `/login` | Publik | Tombol "Masuk dengan Google" |
| `/` | Login | Galeri ruang rapat (bento card) |
| `/book` | Worker | Wizard booking langkah 2 sampai Sukses |
| `/rooms/new` | Admin | Form tambah ruang rapat |
| `/rooms/:id/edit` | Admin | Form ubah ruang rapat |
| `/403` | Login | Halaman "Tidak punya akses" |

**Functional Requirements tambahan:**

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FE-16 | Halaman login dengan tombol **Masuk dengan Google**; pengguna yang belum login dialihkan ke `/login`. | Wajib |
| FE-17 | Setelah login, header menampilkan avatar, email, dan badge role (Admin/Worker), plus tombol Keluar. Sesi bertahan saat refresh. | Wajib |
| FE-18 | **Route guard**: `/rooms/new` dan `/rooms/:id/edit` hanya untuk Admin; Worker diarahkan ke `/403`. `/book` hanya untuk Worker. | Wajib |
| FE-19 | Setelah login, **seluruh ruang rapat langsung tampil** sebagai galeri bento card, lengkap dengan judul "Ruang Rapat", breadcrumb, dan teks "Total: N ruangan". | Wajib |
| FE-20 | Isi setiap card mengikuti referensi (lihat spesifikasi card di bawah). | Wajib |
| FE-21 | Tombol **Detail ruangan** membuka modal/drawer berisi gambar besar, kapasitas, jam operasional, lokasi, fasilitas, dan catatan. | Wajib |
| FE-22 | **Worker:** tombol **Pesan ruangan** memilih ruangan tersebut dan masuk ke langkah Tanggal & Jam. | Wajib |
| FE-23 | **Admin:** tombol **Tambah Ruangan** di header galeri; setiap card punya tombol **Edit** dan **Hapus** (dengan dialog konfirmasi) sebagai pengganti Pesan ruangan. | Wajib |
| FE-24 | **Halaman input ruang rapat (Admin)**: form tambah dan ubah ruangan dengan validasi dan pratinjau card (lihat bagian di bawah). | Wajib |
| FE-25 | Tombol dan menu disembunyikan sesuai role; respons 401 mengembalikan pengguna ke `/login`, respons 403 menampilkan pesan akses ditolak. | Wajib |
| FE-26 | Galeri punya state loading (skeleton card), error (dengan Coba lagi), dan empty ("Belum ada ruangan"; untuk Admin disertai tombol Tambah Ruangan). | Wajib |
| FE-41 | Layout galeri mengikuti mockup: sidebar kiri, header profil/tanggal, breadcrumb, judul dan jumlah ruangan, panel filter di atas grid tiga kartu per baris pada desktop. | Wajib |
| FE-42 | Filter tanggal, jam mulai, durasi, kapasitas, gedung, fasilitas multi-select, tipe ruangan, dan ketersediaan dapat digabungkan. | Wajib |
| FE-43 | Filter ketersediaan menghitung bentrok berdasarkan tanggal + jam mulai + durasi; tanpa jadwal terpilih, tidak menyatakan ruangan tersedia pada waktu tertentu. | Wajib |
| FE-44 | Tombol Reset Filter mengembalikan semua filter ke nilai awal dan menampilkan kembali hasil yang sesuai. | Wajib |

**Spesifikasi layout galeri sesuai mockup Book-in:**

- **Kerangka halaman:** sidebar ungu di sisi kiri dengan identitas aplikasi **Book-in** dan menu **Beranda**, **Ruang Rapat**, serta **Riwayat**. Area konten utama memiliki header berisi tanggal/waktu, email pengguna, role, dan avatar dari Clerk.
- **Judul dan breadcrumb:** tampilkan breadcrumb `Beranda > Ruang Rapat`, judul `Ruang Rapat`, dan jumlah hasil `Total: N ruangan`.
- **Panel filter:** letakkan di atas grid kartu. Filter mencakup **tanggal rapat**, **jam mulai**, **durasi**, **kapasitas/jumlah peserta**, **gedung**, **fasilitas**, **tipe ruangan**, serta pilihan **ketersediaan** (Semua / Tersedia saja). Kontrol dapat berupa dropdown, checkbox, atau date picker sesuai jenis datanya. Sertakan **Reset Filter**.
- **Perilaku filter jadwal:** ketersediaan dihitung berdasarkan tanggal + jam mulai + durasi yang dipilih. Jika tanggal/waktu belum dipilih, tampilkan semua ruangan dan jangan memberi klaim bahwa slot tertentu tersedia; filter atribut seperti kapasitas, gedung, fasilitas, dan tipe tetap dapat digunakan.
- **Filter kapasitas:** opsi kapasitas bermakna jumlah peserta yang dibutuhkan, dan hasil hanya menampilkan ruangan dengan `capacity` sama dengan atau lebih besar dari jumlah tersebut. Label kartu menampilkan kapasitas maksimal, misalnya `Maks. 8 orang`.
- **Filter fasilitas:** multi-select/checkbox; secara default, ruangan harus memiliki seluruh fasilitas yang dipilih. Fasilitas yang didukung contoh: Proyektor, Whiteboard, Video Conference, TV/Monitor, AC, dan Wi-Fi. Data aktual berasal dari `facilities` pada tiap ruangan.
- **Filter gedung:** pilihan berdasarkan gedung/lokasi yang tersedia pada data ruangan. Untuk ruangan online, gedung tidak relevan dan tidak perlu ditampilkan sebagai gedung fisik.
- **Tipe ruangan:** pilihan sesuai nilai yang didukung data. Nilai minimum `onsite`; `hybrid` hanya boleh ditampilkan jika implementasi memang mendukungnya. Jangan menyamakan tipe ruangan dengan provider rapat online.
- **Grid kartu:** desktop menampilkan 3 kartu per baris, tablet 2, dan mobile 1. Setiap kartu memiliki area gambar berbingkai di bagian atas; setelahnya nama ruangan, jam operasional, lantai/gedung, kapasitas maksimal, tabel/chip fasilitas, tombol **Detail Ruangan** dan **Pesan Ruangan**. Tidak ada harga atau informasi biaya.
- **Status kartu:** jika tanggal, jam, dan durasi sudah dipilih, beri label **Tersedia** atau **Tidak tersedia**. Tombol Pesan Ruangan dinonaktifkan untuk kombinasi jadwal yang bentrok. Status ini hanya berlaku pada jadwal terpilih, bukan status permanen ruangan.
- **Navigasi riwayat:** menu Riwayat membuka daftar booking milik Worker yang login; Admin dapat melihat data sesuai kebijakan akses yang ditetapkan. Jangan tampilkan data pribadi pemesan kepada pengguna yang tidak berwenang.

**Spesifikasi galeri bento card:**

- **Layout:** grid responsif, 1 kolom di mobile, 2 kolom di tablet, 3 kolom di desktop. Tinggi card mengikuti isinya (card dengan fasilitas lebih tinggi dari card tanpa fasilitas), sehingga tampak seperti susunan bento pada referensi.
- **Isi card, dari atas ke bawah:** gambar ruangan (rasio tetap, fallback placeholder bila gambar kosong atau gagal dimuat); nama ruangan; baris info dengan ikon (**Maks. X orang**, **08:00 s.d 21:00**, lokasi seperti "Lantai 2 Gedung A" atau "Online"); badge peringatan merah bila `notes` terisi; judul **Fasilitas Ruangan** dengan chip fasilitas (WIFI, WHITEBOARD, AC, dan sebagainya) atau teks "Tidak disebutkan"; dua tombol: **Detail ruangan** (sekunder) dan **Pesan ruangan** (primer, warna aksen).
- **Header halaman:** judul, breadcrumb, jumlah ruangan; tombol Tambah Ruangan hanya untuk Admin.
- **Navigasi:** sidebar atau top bar sederhana (Galeri Ruang Rapat, profil, keluar). Layout mengikuti susunan referensi, tetapi nama, logo, warna, dan aset gambar dibuat sendiri, tidak menyalin dari referensi.

**Halaman input ruang rapat (Admin):**

| Field | Aturan | Catatan |
|---|---|---|
| Nama ruangan | wajib, 2 sampai 100 karakter |  |
| Tipe | wajib, Onsite atau Online | Default Onsite |
| Kapasitas (Maks. orang) | wajib, integer 1 sampai 500 |  |
| Lokasi | wajib bila Onsite | Otomatis "Online" bila tipe Online |
| Jam buka dan jam tutup | wajib, format HH:mm, jam tutup lebih besar dari jam buka | Dasar pembuatan slot 30 menit |

| Fasilitas | opsional, input tag (tambah dan hapus chip) | Kosong tampil "Tidak disebutkan" |
| Gambar | opsional, URL gambar (upload file opsional) | Pratinjau gambar langsung |
| Catatan khusus | opsional, maksimal 200 karakter | Tampil sebagai badge merah |

Perilaku form: pratinjau card di samping atau di bawah form (live preview); tombol Simpan non aktif sampai form valid; state loading saat menyimpan; error API ditampilkan per field (422) atau sebagai banner; setelah berhasil tampil toast dan kembali ke galeri. Mode Edit memuat data lama; Hapus memakai dialog konfirmasi, dan pesan 409 dari backend (ada booking mendatang) ditampilkan apa adanya.

**Catatan mock json-server:** tambahkan koleksi `users` ke `db.json`. Karena json-server tidak membuat slot otomatis, saat Admin menyimpan ruangan baru, klien membuat slot per 30 menit (`POST /slots`) dari jam buka sampai jam tutup; di backend asli ini dilakukan server.

**File tambahan:** integrasi Clerk, `ProtectedRoute`/`RoleGuard`, `pages/Gallery`, `pages/RoomForm`, `components/RoomCard`, `components/RoomDetailModal`, `components/ConfirmDialog`, serta `.env.example` berisi variabel publishable key Clerk frontend.

**Acceptance Criteria tambahan:**

- [ ] Belum login: membuka `/` selalu mengarah ke `/login`.
- [ ] Login Google berhasil dan badge role tampil di header.
- [ ] Setelah login, semua ruangan muncul sebagai bento card dengan isi sesuai spesifikasi.
- [ ] Worker tidak melihat tombol Tambah/Edit/Hapus dan ditolak saat membuka `/rooms/new` lewat URL.
- [ ] Admin tidak melihat tombol Pesan ruangan; Admin berhasil menambah, mengubah, dan menghapus ruangan.
- [ ] Ruangan baru dari Admin langsung muncul di galeri dan bisa dipesan Worker.
- [ ] Galeri rapi di 360 px (1 kolom) dan 1280 px (3 kolom).

### 6.10 Tambahan Frontend: Halaman Detail dengan Kalender dan Popup Pemesanan

Bagian ini **menggantikan** alur Worker di 6.9 ("Pesan ruangan → langkah Tanggal & Jam" dan rute `/book`) serta memperjelas interaksi kartu, kalender, dan popup booking. Tidak ada harga atau perhitungan biaya pada aplikasi internal ini.

**Alur final (Worker):** Galeri → klik bento card → halaman **Detail Ruang Rapat** dengan kalender → klik tanggal (atau tombol **Pesan ruangan**) → popup **Pesan Ruang Rapat** → Konfirmasi → Sukses → kembali ke kalender dengan booking baru sudah tampil.

**Stepper:** stepper 4 langkah sesuai soal (Ruangan, Tanggal & Jam, Data Pemesan, Konfirmasi) lalu halaman Sukses. Langkah 1 (Ruangan) selesai saat bento card diklik dan halaman detail terbuka; langkah 2 sampai 4 berjalan di dalam popup dengan tombol Kembali/Lanjut. Field popup mengikuti form referensi, tetapi dibagi tiga langkah agar ketentuan stepper dan Lanjut non aktif dari soal tetap terpenuhi.

**Rute berubah:**

| Rute | Akses | Isi |
|---|---|---|
| `/rooms/:id` | Login | Detail ruangan + kalender jadwal; popup pemesanan terbuka di atas halaman ini |
| `/book` | - | Dihapus (diganti popup) |

Admin juga membuka `/rooms/:id` untuk melihat kalender, tetapi tanpa tombol Pesan ruangan dan tanpa popup pemesanan; yang tampil adalah tombol Edit dan Hapus.

**Functional Requirements tambahan:**

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FE-27 | Klik bento card (termasuk tombol Detail ruangan dan Pesan ruangan) membuka `/rooms/:id`. | Wajib |
| FE-28 | Layout detail: breadcrumb "Detail Ruang Rapat"; panel kiri berisi gambar, nama, Maks. X orang, jam operasional, lokasi, chip fasilitas, dan tombol Pesan ruangan (Worker); panel kanan berisi kalender berjudul "Jadwal Rapat {nama ruangan}". | Wajib |
| FE-29 | Kalender: judul bulan dan tahun, tombol bulan sebelumnya/berikutnya, tombol Today, tanggal hari ini disorot, nomor minggu (W5, W6, dan seterusnya), tanggal yang sudah lewat tidak bisa diklik. Tampilan Bulan wajib; Minggu, Hari, dan List disarankan. | Wajib |
| FE-30 | Booking ruangan tersebut tampil sebagai event di tanggalnya dengan format jam mulai + uraian (contoh "09:00 Rapat sprint"), diambil dari `GET /bookings?roomId=`. | Wajib |
| FE-31 | Dropdown filter jadwal: "Semua Jadwal" dan "Jadwal Saya" (booking milik user yang login). | Disarankan |
| FE-32 | Klik tanggal hari ini atau mendatang membuka popup dengan tanggal terisi. Klik event yang sudah ada membuka popup baca-saja (jam, durasi, uraian, nama pemesan). | Wajib |
| FE-33 | Popup "Pesan Ruang Rapat" punya stepper, tombol X dan Tutup, serta konfirmasi sebelum ditutup bila sudah ada isian. Di mobile tampil sebagai layar penuh (bottom sheet). | Wajib |
| FE-34 | **Langkah Tanggal & Jam:** tanggal terisi dari kalender (bisa diganti, tidak boleh lampau); jam mulai dipilih dari grid slot 30 menit, slot tidak tersedia disabled dan tidak bisa dipilih; durasi berupa input menit (minimal 30, kelipatan 30) dengan tombol cepat **30 Menit, 1 Jam, 1.5 Jam, 2 Jam**; tampil ringkasan rentang waktu (contoh 09:00 - 10:30). Pilihan durasi yang melewati jam tutup atau menabrak slot terisi berikutnya disabled. Lanjut aktif bila tanggal, jam mulai, dan durasi valid. | Wajib |
| FE-35 | **Langkah Detail & Pemesan:** Uraian kegiatan (wajib, textarea 5 sampai 200 karakter); Estimasi jumlah peserta untuk konsumsi (wajib, 1 sampai kapasitas, dengan teks bantu "Ruangan ini tersedia hingga maks. X orang"); Pilihan paket konsumsi (dropdown); Nama dan email terisi otomatis dari akun Google; Nomor HP (wajib, validasi 6.4). | Wajib |
| FE-36 | **Langkah Konfirmasi:** ringkasan ruangan, tanggal, jam mulai sampai selesai, durasi, uraian, peserta, paket konsumsi, dan pemesan. Tidak ada harga/biaya. Tombol **Simpan** mengirim `POST /bookings`. | Wajib |
| FE-37 | **Sukses:** menampilkan kode booking dari respons API; tombol "Kembali ke kalender" menutup popup, memuat ulang event, dan booking baru langsung tampil. | Wajib |
| FE-38 | Respons 409 ditampilkan di dalam popup, pengguna dikembalikan ke langkah Tanggal & Jam dan slot dimuat ulang. | Wajib |
| FE-39 | State loading dan error untuk kalender (skeleton, Coba lagi) dan untuk popup (grid slot, tombol Simpan). | Wajib |
| FE-40 | Responsif: di mobile kalender default tampilan List atau Hari, grid slot 3 kolom, popup layar penuh; di desktop panel kiri dan kanan berdampingan. | Wajib |

**Pilihan paket konsumsi** (nilai contoh, bisa disesuaikan; hanya "Paket C (Snack ringan)" yang terlihat di referensi):

| Kode | Label |
|---|---|
| `none` | Tanpa konsumsi (default) |
| `A` | Paket A (Makan berat) |
| `B` | Paket B (Snack dan minum) |
| `C` | Paket C (Snack ringan) |

**Catatan mock json-server:** slot dibuat per 30 menit di `db.json`. Ketersediaan per tanggal dihitung di klien dari `GET /bookings?roomId=` (slot mulai sampai slot terakhir sesuai durasi); klien juga memuat ulang booking tepat sebelum `POST` untuk mengecek bentrok, karena json-server tidak menolak double booking. Klien menambahkan `code`, `startTime`, dan `endTime` ke body POST.

**Library kalender (usulan):** FullCalendar (`dayGrid`, `timeGrid`, `list`), karena sudah menyediakan nomor minggu, tombol Today, dan pilihan tampilan Bulan/Minggu/Hari/List seperti referensi. Alternatif: kalender bulan buatan sendiri bila ingin lebih ringan.

**Acceptance Criteria tambahan:**

- [ ] Klik bento card membuka halaman detail dengan kalender ruangan tersebut.
- [ ] Booking yang sudah ada tampil di tanggalnya; booking baru langsung muncul setelah Sukses.
- [ ] Klik tanggal mendatang membuka popup dengan tanggal terisi; klik tanggal lampau tidak membuka apa pun.
- [ ] Slot terisi disabled; durasi yang melewati jam tutup atau menabrak booking lain tidak bisa dipilih.
- [ ] Tombol durasi cepat mengisi input menit; input di bawah 30 atau bukan kelipatan 30 menampilkan error.
- [ ] Lanjut non aktif sampai langkahnya valid; Kembali mempertahankan isian.
- [ ] Konfirmasi tidak menampilkan harga; Sukses menampilkan kode dari respons API.
- [ ] Popup dan kalender rapi di 360 px dan 1280 px.

---

# BAGIAN B: BACKEND

## 7. Kebutuhan Backend

### 7.1 Tech stack

- **Node.js + Express** dengan **PostgreSQL**. Migration dan seeder memakai **Prisma**. Menggunakan database storage Vercel yaitu "Prisma Postgres" agar database dapat di akses secara online.
- Validasi input memakai Zod.
- Konfigurasi lewat `.env` (`PORT`, `DATABASE_URL`), disediakan `.env.example`.

### 7.2 Desain database

**rooms**

| Kolom | Tipe | Catatan |
|---|---|---|
| id | PK, auto increment |  |
| name | varchar(100), not null |  |
| capacity | int, not null | check > 0 |

| facilities | JSON / text array | contoh `["Proyektor","AC"]` |
| image | varchar(255) | URL gambar |
| created_at, updated_at | timestamp |  |

**slots**

| Kolom | Tipe | Catatan |
|---|---|---|
| id | PK |  |
| room_id | FK ke rooms.id, on delete cascade | index |
| time | varchar(20), not null | contoh `09:00-10:00` |
| created_at, updated_at | timestamp |  |

**bookings**

| Kolom | Tipe | Catatan |
|---|---|---|
| id | PK |  |
| code | varchar(20), unique, not null | contoh `BK-7F3A9C` |
| room_id | FK ke rooms.id |  |
| slot_id | FK ke slots.id |  |
| date | date, not null |  |
| name | varchar(100), not null |  |
| email | varchar(150), not null |  |
| phone | varchar(20), not null |  |
| participants | int, not null |  |

| status | varchar(20), default `confirmed` |  |
| created_at, updated_at | timestamp |  |

**Constraint penting:** `UNIQUE (slot_id, date)` pada bookings sebagai pengaman terakhir terhadap double booking, termasuk saat dua request masuk bersamaan (race condition).

**Relasi:** satu room punya banyak slot; satu room punya banyak booking; satu slot bisa punya banyak booking pada tanggal berbeda.

**Seeder:** minimal 3 ruangan dan slot 30 menit per ruangan (08:00 sampai 21:00), plus 1 sampai 2 booking contoh agar skenario 409 bisa diuji.

### 7.3 Spesifikasi Endpoint

#### GET /rooms

- **200 OK**: daftar ruangan.

```json
{
  "success": true,
  "message": "OK",
  "data": [
    { "id": 1, "name": "Ruang Alpha", "capacity": 6,
      "facilities": ["Proyektor", "AC"], "image": "https://..." }
  ]
}
```

#### GET /slots?roomId=1[&date=YYYY-MM-DD]

- `roomId` wajib. Bila kosong atau bukan angka: **422**. Bila ruangan tidak ada: **404**.
- Tanpa `date`: `isAvailable` bernilai true untuk semua slot (kecuali jika ada aturan default). Dengan `date`: `isAvailable = false` untuk slot yang sudah punya booking pada tanggal tersebut.
- **200 OK**: `data` berisi array `{ id, roomId, time, isAvailable }`.

#### POST /bookings

- Body sesuai kontrak (Bagian 5).
- **201 Created**:

```json
{
  "success": true,
  "message": "Booking berhasil dibuat",
  "data": {
    "id": 12, "code": "BK-7F3A9C", "roomId": 1, "slotId": 3,
    "date": "2026-10-20", "name": "Budi", "email": "budi@email.com",
    "phone": "081234567890", "participants": 3,
    "status": "confirmed"
  }
}
```

- **422 Unprocessable Entity** (validasi gagal):

```json
{
  "success": false,
  "message": "Validasi gagal",
  "errors": {
    "email": ["Format email tidak valid"],
    "participants": ["Minimal 1 peserta"]
  }
}
```

- **404 Not Found**: `roomId` atau `slotId` tidak ditemukan.
- **409 Conflict**: slot sudah terisi pada tanggal yang sama, atau (sesuai ketentuan soal) peserta melebihi kapasitas. Pesan harus jelas, contoh: "Slot 10:00-11:00 pada 2026-10-20 sudah dipesan" dan "Jumlah peserta (8) melebihi kapasitas ruangan (6)".

**Catatan asumsi:** soal menempatkan kelebihan kapasitas dalam kalimat yang sama dengan 409. Implementasi mengikuti soal (409 dengan kode error `CAPACITY_EXCEEDED`). Format dan rentang dasar `participants` (integer, minimal 1) tetap 422. Keputusan ini dicatat di README.

### 7.4 Aturan Validasi `POST /bookings`

| Field | Aturan |
|---|---|
| roomId | wajib, integer, ruangan harus ada |
| slotId | wajib, integer, slot harus ada dan **milik roomId tersebut** |
| date | wajib, format `YYYY-MM-DD`, tanggal valid, tidak boleh sebelum hari ini |
| name | wajib, string 2 sampai 100 karakter, di-trim |
| email | wajib, format email valid, maksimal 150 karakter |
| phone | wajib, format nomor HP Indonesia (`^(\+62\|62\|0)8[1-9][0-9]{6,11}$`) |
| participants | wajib, integer, minimal 1 |

Urutan pemeriksaan: (1) validasi format, 422; (2) cek keberadaan room dan slot, 404; (3) cek kapasitas, 409; (4) cek slot terisi, 409.

### 7.5 Penanganan Error dan Format Respons

- Semua respons JSON dengan bentuk konsisten: `{ success, message, data }` untuk sukses dan `{ success, message, errors? }` untuk gagal.

| Status | Kapan dipakai |
|---|---|
| 200 | GET berhasil |
| 201 | Booking berhasil dibuat |
| 404 | Room/slot tidak ditemukan, atau route tidak ada |
| 409 | Slot sudah terisi pada tanggal tersebut / peserta melebihi kapasitas |
| 422 | Input tidak valid |
| 500 | Kesalahan server tak terduga (pesan generik, detail hanya di log) |

- Middleware global untuk error handler dan 404 route.
- Pembuatan booking dibungkus **transaksi database**; bila insert gagal karena unique constraint `(slot_id, date)`, dikonversi menjadi **409**, bukan 500.
- CORS diaktifkan agar Frontend (`localhost:5173`) bisa memanggil API.
- Kode booking dibuat unik di server (6 karakter alfanumerik uppercase dengan prefix `BK-`), dengan retry jika bentrok.

### 7.6 Struktur project Backend

```
backend/
  src/
    app.js, server.js
    config/               # env, koneksi database
    routes/               # rooms, slots, bookings
    controllers/
    services/             # logika booking (cek kapasitas, konflik, transaksi)
    validators/           # skema validasi
    middlewares/          # errorHandler, notFound
    utils/                # response helper, generator kode
  migrations/
  seeds/
  docs/                   # Postman collection / OpenAPI
  .env.example
  README.md
```

### 7.7 Acceptance Criteria Backend

- [ ] Migration membuat tabel `rooms`, `slots`, `bookings` dengan FK dan unique constraint; seeder mengisi data contoh.
- [ ] `GET /rooms` dan `GET /slots?roomId=` sesuai kontrak (200).
- [ ] `POST /bookings` valid memberi 201 dan kode booking.
- [ ] Input salah memberi 422 dengan pesan per field.
- [ ] Booking slot yang sama pada tanggal yang sama memberi 409; tanggal berbeda tetap boleh.
- [ ] Peserta melebihi kapasitas memberi 409.
- [ ] Room/slot tidak ada memberi 404.
- [ ] Dua request bersamaan ke slot yang sama hanya menghasilkan satu booking.
- [ ] Dokumentasi endpoint tersedia (README, Postman collection, atau Swagger).

### 7.8 Skenario Uji Minimal

| # | Skenario | Hasil |
|---|---|---|
| 1 | Body valid | 201 + `code` |
| 2 | Email tanpa `@` | 422, error di field `email` |
| 3 | Body kosong | 422, semua field wajib terdaftar |
| 4 | Slot sama, tanggal sama, dikirim dua kali | 201 lalu 409 |
| 5 | Slot sama, tanggal berbeda | 201 |
| 6 | participants lebih dari capacity | 409 |
| 7 | roomId = 999 | 404 |
| 8 | slotId milik ruangan lain | 404 atau 422 (tentukan dan dokumentasikan) |
| 9 | Tanggal kemarin | 422 |

### 7.9 Tambahan Backend: Autentikasi, Role, dan CRUD Ruangan

**Teknologi:** Clerk untuk autentikasi frontend dan verifikasi request di backend Express menggunakan SDK/mekanisme resmi Clerk, ditambah middleware `authenticate` dan `requireRole(...)`. Env backend berisi Clerk secret key dan konfigurasi yang dibutuhkan; frontend memakai Clerk publishable key. Jangan membuat atau menandatangani JWT aplikasi sendiri.

**Tabel baru** **`users`****:**

| Kolom | Tipe | Catatan |
|---|---|---|
| id | PK |  |
| clerk_user_id | varchar(255), unique, not null | ID user dari Clerk (`userId`) |
| email | varchar(150), unique, not null |  |
| name | varchar(100), not null |  |
| avatar | varchar(255) | URL foto profil |
| role | varchar(20), not null, default `worker` | nilai `admin` atau `worker` (check constraint) |
| created_at, updated_at | timestamp |  |

Perubahan tabel lain: `bookings.user_id` (FK ke `users.id`, diisi dari token, bukan dari body); `rooms` mendapat kolom `type`, `location`, `open_time`, `close_time`, `notes`. Seeder menambahkan data ruangan contoh (campuran onsite dan online) dan role Admin/Worker untuk demo. Pemetaan `clerk_user_id` ke user internal dilakukan saat user pertama kali teridentifikasi melalui token Clerk yang valid.

**Aturan akses:**

| Endpoint | Tanpa token | Worker | Admin |
|---|---|---|---|
| Clerk sign-in/session | ditangani Clerk | ditangani Clerk | ditangani Clerk |
| `GET /auth/me`, `GET /rooms`, `GET /rooms/:id`, `GET /slots` | 401 | 200 | 200 |
| `POST /bookings` | 401 | 201 | 403 |
| `POST /rooms`, `PUT /rooms/:id`, `DELETE /rooms/:id` | 401 | 403 | 201 / 200 |

**Spesifikasi endpoint baru:**

- `GET /auth/me` menggunakan token Clerk pada header `Authorization: Bearer <clerk-session-token>`. Backend memverifikasi token, mencocokkan/membuat user internal berdasarkan `clerk_user_id`, lalu mengembalikan profil dan role. Token invalid/kedaluwarsa menghasilkan **401**.
- `POST /rooms` (Admin) dengan body `{ name, type, capacity, location, openTime, closeTime, facilities, image, notes }`. **201** berisi ruangan baru; slot 30 menit dari `openTime` sampai `closeTime` dibuat otomatis dalam satu transaksi (contoh 08:00 sampai 21:00 menghasilkan 26 slot berdurasi 30 menit). **422** bila tidak valid, **403** bila bukan Admin.
- `PUT /rooms/:id` (Admin): validasi sama dengan create. Bila jam operasional berubah, slot yang belum pernah dibooking disesuaikan; slot yang sudah punya booking dipertahankan. **404** bila ruangan tidak ada.
- `DELETE /rooms/:id` (Admin): **200** bila berhasil; **404** bila tidak ada; **409** bila masih ada booking mendatang pada ruangan tersebut (pesan jelas, contoh "Ruangan masih memiliki 2 booking mendatang").

**Validasi ruangan (create dan update):** `name` wajib 2 sampai 100 karakter; `type` salah satu dari `onsite` atau `online`; `capacity` integer 1 sampai 500; `location` wajib bila onsite; `openTime` dan `closeTime` format `HH:mm` dengan `closeTime` lebih besar dari `openTime`; `facilities` array string; `image` URL valid bila diisi; `notes` maksimal 200 karakter.

**Format error auth:** `401` dengan `{ "success": false, "message": "Silakan login terlebih dahulu" }` dan `403` dengan `{ "success": false, "message": "Anda tidak memiliki akses untuk aksi ini" }`, mengikuti format respons yang sama dengan bagian 7.5.

**Skenario uji tambahan:**

| # | Skenario | Hasil |
|---|---|---|
| 10 | `GET /rooms` tanpa token | 401 |
| 11 | Token Worker memanggil `POST /rooms` | 403 |
| 12 | Token Admin memanggil `POST /rooms` valid | 201 dan slot otomatis terbentuk |
| 13 | Token Admin memanggil `POST /bookings` | 403 |
| 14 | Token Worker memanggil `POST /bookings` valid | 201 |
| 15 | `DELETE /rooms/:id` pada ruangan dengan booking mendatang | 409 |
| 16 | `POST /rooms` dengan `closeTime` lebih kecil dari `openTime` | 422 |
| 17 | Request API dengan token Clerk palsu/kedaluwarsa | 401 |

**Acceptance Criteria tambahan:**

- [ ] Token sesi Clerk diverifikasi di server; user internal dicocokkan/dibuat saat pertama kali teridentifikasi.
- [ ] Role Admin dan Worker ditegakkan di semua endpoint sesuai tabel akses.
- [ ] CRUD ruangan hanya bisa dilakukan Admin; slot otomatis terbentuk saat ruangan dibuat.
- [ ] Dokumentasi endpoint (README, Postman, atau Swagger) memuat endpoint auth dan rooms beserta cara mengirim token.

### 7.10 Tambahan Backend: Durasi, Detail Kegiatan, dan Data Kalender

Bagian ini **menggantikan** pembuatan slot per jam di 7.9 dan seeder di 7.2: slot berdurasi **30 menit** (08:00 sampai 21:00 menghasilkan 26 slot). Sistem tidak menghitung atau menyimpan biaya booking.

**Kontrak API tambahan:**

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/bookings?roomId=1&from=YYYY-MM-DD&to=YYYY-MM-DD` | Login | Booking satu ruangan untuk kalender: `id, roomId, date, startTime, endTime, durationMinutes, description, bookedBy` (nama) dan `isMine`. Email dan nomor HP pemesan tidak dikembalikan. |
| GET | `/slots?roomId=1&date=YYYY-MM-DD` | Login | `isAvailable` dihitung per tanggal dari seluruh slot yang tertutup booking |

**Field tambahan pada** **`POST /bookings`** (opsional agar body contoh pada soal tetap valid):

| Field | Aturan | Default |
|---|---|---|
| `durationMinutes` | integer, minimal 30, kelipatan 30 | 30 (satu slot) |
| `description` | string 5 sampai 200 karakter, di-trim | kosong |
| `consumptionPackage` | salah satu dari `none`, `A`, `B`, `C` | `none` |

`slotId` tetap menjadi **slot mulai**. Respons 201 menambahkan `startTime`, `endTime`, `durationMinutes`, `description`, dan `consumptionPackage`.

**Aturan bisnis durasi:**

- Booking memakai `durationMinutes / 30` slot berurutan dalam ruangan yang sama, dimulai dari `slotId`.
- Slot berurutan tidak cukup (melewati jam tutup): **409**, pesan "Durasi melebihi jam operasional ruangan".
- Salah satu slot yang dibutuhkan sudah terisi pada tanggal tersebut: **409**, pesan menyebut jam yang bentrok.
- `durationMinutes` bukan kelipatan 30 atau kurang dari 30, `description` di luar 5 sampai 200 karakter, atau `consumptionPackage` tidak dikenal: **422**.
- `participants` melebihi kapasitas tetap **409** sesuai soal; `userId` diambil dari token, bukan dari body.

**Perubahan database:**

- `bookings` mendapat kolom `description`, `duration_minutes`, `consumption_package`, `start_time`, dan `end_time`; `slot_id` berisi slot mulai.
- Tabel baru `booking_slots` (`id`, `booking_id` FK dengan on delete cascade, `slot_id` FK, `date`) dengan constraint **UNIQUE (slot_id, date)**. Constraint ini menjadi pengaman utama double booking, termasuk untuk booking multi-slot dan request bersamaan.
- Pembuatan booking dan semua baris `booking_slots` berada dalam **satu transaksi**; pelanggaran unique dikonversi menjadi 409, bukan 500.
- Seeder: slot 30 menit untuk setiap ruangan sesuai jam operasional, dan beberapa booking contoh (termasuk satu booking multi-slot) agar skenario 409 bisa diuji.

**Skenario uji tambahan:**

| # | Skenario | Hasil |
|---|---|---|
| 18 | Mulai 09:00 durasi 90 menit pada ruangan kosong | 201, `endTime` 10:30, 3 baris `booking_slots` |
| 19 | Mulai 09:30 durasi 60 menit saat slot 10:00 sudah terisi | 409 |
| 20 | Mulai 20:30 durasi 90 menit pada ruangan yang tutup 21:00 | 409 |
| 21 | `durationMinutes` 45 | 422 |
| 22 | `description` 2 karakter | 422 |
| 23 | `GET /bookings?roomId=1` oleh Worker | 200, tanpa email dan nomor HP pemesan lain |
| 24 | `GET /bookings` tanpa token | 401 |

**Acceptance Criteria tambahan:**

- [ ] Booking multi-slot menutup semua slot yang dicakup; `GET /slots?date=` menandainya tidak tersedia.
- [ ] Dua request bersamaan yang saling tumpang tindih hanya menghasilkan satu booking.
- [ ] `GET /bookings` cukup untuk mengisi kalender dan tidak membocorkan data kontak pemesan lain.
- [ ] Body contoh dari soal (tanpa field tambahan) tetap menghasilkan 201.

---

## 8. Revisi 2: Book-in (Clerk, Worker, Timeline Jam Tepat)

**Aturan prioritas:** bagian ini **menggantikan** isi Bagian 5.1, 6.9, 6.10, 7.9, dan 7.10 (termasuk sisi Admin, lihat 8.11) bila ada yang bertentangan. Bagian lain tetap berlaku.

### 8.1 Ringkasan perubahan

| Topik | Sebelumnya | Sekarang |
|---|---|---|
| Autentikasi | Login Google, user baru otomatis Worker | **Clerk** (Google hanya salah satu provider). Akun Clerk harus cocok dengan data worker di database |
| Harga | Dihilangkan | Tetap dihilangkan (UI, API, database). Ini fasilitas kantor untuk worker |
| Paket konsumsi | Ada (none/A/B/C) | **Dihapus** (tidak ada di mockup) |
| Data pemesan | Nama, email, HP diisi manual | **ID Work, nama, email, no. telp otomatis dari database worker** (read-only) |
| Pemilihan waktu | Grid slot 30 menit + popup | **Kalender + timeline per tanggal**, slot **jam tepat**, rentang bebas kelipatan 1 jam |
| Navigasi | Galeri + admin | Sidebar **Beranda, Ruang Rapat, Riwayat** |
| Durasi Start/End | Bagian form booking | **Filter** di halaman Ruang Rapat |
| Sisi Admin | Card galeri dengan tombol Edit/Hapus | Menu **Kelola Ruangan** khusus Admin (tabel + form), lihat 8.11 |

### 8.2 Autentikasi Clerk dan data worker

- Login dan sesi ditangani Clerk SDK. Frontend mengirim token sesi Clerk; backend Express memverifikasi token tersebut. Aplikasi tidak membuat JWT sendiri.
- Data worker disimpan di tabel `workers` dan diisi lewat seeder/HR, bukan dari UI:

| Kolom | Catatan |
|---|---|
| id | PK |
| worker_code | unik, contoh `INM-874867853` (ditampilkan sebagai "ID Work") |
| name | nama lengkap |
| email | unik, dipakai mencocokkan akun Clerk |
| phone | no. telp contact person |
| position | contoh "Web Developer Intern" |
| role | `admin` atau `worker` (tetap diatur di database, bukan metadata Clerk) |
| clerk_user_id | nullable, diisi saat login pertama untuk mempercepat pencocokan |

- **Pencocokan akun:** backend membaca email terverifikasi dari token Clerk lalu mencari baris `workers` dengan email yang sama. Tidak ketemu: **403** "Akun belum terdaftar sebagai worker". Ini menggantikan aturan "pengguna pertama otomatis Worker" di 5.1.
- Frontend: `ClerkProvider`, komponen sign-in/sign-out Clerk, `ProtectedRoute`. Header menampilkan email, role, dan avatar.
- Mode mock json-server: koleksi `workers` di `db.json` dan user demo lokal; batasannya dijelaskan di README.

### 8.3 Kerangka halaman dan rute

**Jam operasional default: 08:00 sampai 21:00** (`openTime` 08:00, `closeTime` 21:00). Timeline menampilkan baris 08:00 sampai 21:00; booking terakhir yang mungkin berakhir pukul 21:00 (mulai 20:00 untuk durasi 1 jam).

Sidebar ungu "Book-in" dengan menu **Beranda**, **Ruang Rapat**, **Riwayat**. Header: tanggal dan jam berjalan (zona Asia/Jakarta), email, role, avatar.

| Rute | Akses | Isi |
|---|---|---|
| `/sign-in` | Publik | Komponen Clerk |
| `/` | Login | Beranda |
| `/rooms` | Login | Daftar Ruang Rapat + filter |
| `/rooms/:id` | Login | Detail ruangan, kalender, timeline, popup pesan |
| `/history` | Worker | Riwayat Pemesanan milik sendiri |
| `/403` | Login | Tidak punya akses |
| `/admin/rooms`, `/admin/rooms/new`, `/admin/rooms/:id/edit` | Admin | Kelola Ruangan (lihat 8.11) |

Halaman dan endpoint Admin (Kelola Ruangan) diatur di **8.11**.

### 8.4 Beranda

- Sapaan sesuai waktu (Selamat Pagi/Siang/Sore/Malam) dan nama worker.
- Kartu profil: foto worker (placeholder bila kosong), **Nama**, **ID Work**, **Posisi**. Semua dari `GET /workers/me`.

### 8.5 Ruang Rapat dan filter

Judul "Ruang Rapat", breadcrumb, "Total: N ruangan", panel filter, lalu grid card (3 kolom desktop, 2 tablet, 1 mobile). Card tetap seperti 6.9 tanpa harga dan tanpa info konsumsi.

| Filter | Kontrol | Perilaku | Prioritas |
|---|---|---|---|
| Tanggal | Date picker, default hari ini, tidak boleh lampau | Dasar perhitungan ketersediaan | Wajib |
| **Durasi (Start - End)** | Tombol/dropdown yang membuka popup "Durasi" berisi dua dropdown Start dan End | Jam tepat, End > Start, minimal 1 jam, dalam jam operasional | Wajib |
| Kapasitas (jumlah orang) | Dropdown: 1-3, 4-6, 7-10, 11+ | Ruangan lolos bila `capacity` >= batas atas rentang (11+ berarti >= 11) | Wajib |
| Fasilitas | Checkbox: Semua, Proyektor, Whiteboard, TV/Monitor, AC, Wi-Fi | Ruangan harus punya semua fasilitas terpilih | Wajib |
| Ketersediaan | Semua / Tersedia saja | Dihitung dari tanggal + Start + End; tanpa jadwal terpilih tidak ada klaim tersedia | Wajib |
| Gedung | Dropdown dari data ruangan | Filter berdasarkan gedung | Wajib |
| Lantai | Dropdown dari data ruangan | Bergantung pada gedung terpilih | Disarankan |
| Cari nama ruangan | Input teks | Pencarian nama, tidak peka huruf besar/kecil | Disarankan |
| Urutkan | Dropdown: Nama A-Z, Kapasitas terkecil, Kapasitas terbesar | Mengatur urutan card | Disarankan |
| Tipe ruangan | Dropdown | Hanya tampil bila ada ruangan `online` pada data | Opsional |
| Reset Filter | Tombol | Mengembalikan semua filter ke nilai awal | Wajib |

- Card diberi label **Tersedia** / **Tidak tersedia** hanya bila tanggal dan durasi terpilih. Tombol Pesan Ruangan dinonaktifkan untuk yang bentrok.
- Klik **Pesan Ruangan** atau **Detail Ruangan** membuka `/rooms/:id`; tanggal dan jam dari filter ikut terisi di timeline bila ada.
- Filter berjalan di klien untuk atribut, dan memakai `GET /rooms?date=&startTime=&endTime=` untuk ketersediaan (lihat 8.9).

### 8.6 Detail ruangan: kalender dan timeline

Layout dua kolom: kiri panel info ruangan (gambar, nama, lokasi, jam operasional, fasilitas, tombol Detail Ruangan dan Pesan Ruangan); kanan **Kalender** di atas dan **Timeline** di bawah.

**Kalender**
- Tampilan bulan dengan navigasi `<` `>`, tanggal terpilih disorot ungu, tanggal lampau tidak bisa diklik.
- Tanggal yang sudah punya booking diberi penanda warna kecil.
- Klik tanggal memperbarui timeline.

**Timeline per tanggal (anti tabrakan jadwal)**
- Kolom = tanggal (tanggal terpilih + beberapa hari berikutnya, bisa digeser). Baris = jam tepat dari `openTime` sampai `closeTime` ruangan (08:00, 09:00, ...).
- Blok berwarna = booking pemesan lain (tidak bisa dipilih). Hover/tap blok menampilkan nama pemesan dan jam; email dan no. telp tidak ditampilkan.
- Memilih waktu: klik atau drag pada kolom tanggal untuk menentukan rentang. Blok pilihan tampil ungu berlabel "Pesan".
- Panel bawah "Waktu yang dipesan" berisi dropdown **Start** dan **End** yang selalu sinkron dengan blok di timeline, plus tombol **Pesan**.
- Aturan: jam tepat saja; rentang kelipatan 1 jam sesuai kebutuhan; minimal 1 jam; tidak boleh menimpa blok terisi; jam yang sudah lewat pada hari ini dan tanggal lampau disabled; di luar jam operasional abu-abu.
- Mobile: timeline menampilkan satu hari dan bisa digeser per hari; area lebar scroll di dalam container, bukan di body.
- Loading (skeleton) dan error (Coba lagi) untuk kalender dan timeline.

### 8.7 Popup Pesan Ruang Rapat (detail booking)

Alur Worker: **Ruang Rapat** (pilih ruangan) → **Kalender + Timeline** (pilih tanggal dan rentang jam) → klik **Pesan** → popup detail → **Konfirmasi** → **Sukses**. Ini memenuhi stepper 4 langkah (Ruangan, Tanggal & Jam, Data Pemesan, Konfirmasi).

Isi popup:

| Bagian | Field | Aturan |
|---|---|---|
| Ringkasan jadwal | Ruangan, tanggal, Start - End, durasi | Read-only dari timeline; ada tautan "Ubah" kembali ke timeline |
| Contact person (otomatis) | **ID Work, nama, email, no. telp** | Read-only, dari database worker; tidak dikirim dari form |
| Detail rapat | **Jumlah orang yang akan hadir** | Wajib, integer, 1 sampai `capacity`; teks bantu "Ruangan ini tersedia hingga maks. X orang" |
| Detail rapat | Keterangan | Opsional, maksimal 200 karakter (tampil di Riwayat) |

- Konfirmasi menampilkan ringkasan lengkap, tanpa harga. Tombol **Simpan** memanggil `POST /bookings`.
- Sukses menampilkan kode booking dari respons API; tombol "Kembali ke timeline" memuat ulang kalender dan timeline.
- Respons 409: pesan tampil di popup, pengguna kembali ke timeline dan data dimuat ulang.
- Mobile: popup layar penuh; konfirmasi sebelum menutup bila sudah ada isian.

### 8.8 Riwayat

Judul "Riwayat Pemesanan" dengan tabel milik worker yang login, diurutkan dari terbaru:

| Kolom | Isi |
|---|---|
| No | Nomor urut |
| Ruangan | Nama ruangan |
| Hari | Nama hari (Senin, Selasa, ...) |
| Tanggal | Tanggal booking |
| Mulai / Selesai | Jam tepat |
| Status | **Akan Datang**, **Sedang Berlangsung**, **Selesai** (dihitung otomatis dari tanggal dan jam, zona Asia/Jakarta) |
| Keterangan | Keterangan booking, atau "-" bila kosong |

Pembatalan tetap di luar scope. Bila daftar panjang, gunakan paginasi. Empty state: "Belum ada riwayat pemesanan".

### 8.9 Backend

**Slot:** diganti menjadi slot **60 menit** (08:00 sampai 21:00 menghasilkan 13 slot). `durationMinutes` harus kelipatan 60, minimal 60. Mekanisme `booking_slots` dengan `UNIQUE (slot_id, date)` dan transaksi tetap dipakai.

**Perubahan database**
- Tabel baru `workers` (lihat 8.2). `bookings` mendapat `worker_id` (FK).
- `bookings.name`, `email`, `phone` tetap ada sebagai **snapshot** yang diisi server dari `workers`, supaya riwayat tidak berubah bila data worker diubah.
- Kolom `consumption_package` dihapus. `description` menjadi opsional (maks. 200 karakter).
- Tidak ada kolom harga di tabel mana pun.

**Kontrak API**

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/workers/me` | Login | Profil worker dari token Clerk: `workerCode, name, email, phone, position, role` (menggantikan `/auth/me`) |
| GET | `/rooms?date=&startTime=&endTime=` | Login | Daftar ruangan; bila tiga parameter terisi, tiap ruangan memuat `isAvailable` |
| GET | `/bookings?roomId=&from=&to=` | Login | Booking satu ruangan untuk kalender dan timeline: `id, roomId, date, startTime, endTime, bookedBy` (nama), `isMine`. Tanpa email dan no. telp |
| GET | `/bookings/me` | Worker | Riwayat milik sendiri: `id, code, roomName, date, startTime, endTime, status, description` |
| POST | `/bookings` | Worker | Membuat booking |

Body `POST /bookings`:

```json
{
  "roomId": 1,
  "slotId": 3,
  "date": "2026-10-20",
  "durationMinutes": 120,
  "participants": 3,
  "description": "Rapat sprint"
}
```

- `workerId`, nama, email, dan no. telp **diambil dari token dan tabel `workers`**, bukan dari body. Bila body lama dari soal (dengan `name`, `email`, `phone`) tetap dikirim, field tersebut diabaikan dan tetap menghasilkan 201.
- Aturan bisnis: durasi melewati jam tutup atau slot bentrok = **409**; `durationMinutes` bukan kelipatan 60, `participants` kurang dari 1, atau `description` lebih dari 200 karakter = **422**; `participants` melebihi kapasitas = **409**; worker tidak terdaftar = **403**.
- Respons 201 memuat `code`, `startTime`, `endTime`, `durationMinutes`, `participants`, `description`.

**Skenario uji tambahan**

| # | Skenario | Hasil |
|---|---|---|
| 25 | Login Clerk dengan email yang tidak ada di `workers` | 403 |
| 26 | `POST /bookings` mulai 09:00 durasi 120 menit pada ruangan kosong | 201, `endTime` 11:00, 2 baris `booking_slots` |
| 27 | `POST /bookings` durasi 90 menit | 422 |
| 28 | `POST /bookings` dengan `name`/`email`/`phone` palsu di body | 201, data tersimpan dari `workers` |
| 29 | `GET /bookings?roomId=1` oleh Worker | 200, tanpa email dan no. telp pemesan lain |
| 30 | `GET /bookings/me` | 200, hanya booking sendiri dengan status yang benar |
| 31 | `GET /rooms?date=...&startTime=09:00&endTime=11:00` saat 10:00 terisi | Ruangan tersebut `isAvailable: false` |

### 8.10 Acceptance Criteria Revisi 2

- [ ] Login lewat Clerk berhasil dan akun yang tidak ada di `workers` ditolak dengan pesan jelas.
- [ ] Tidak ada field, kalkulasi, atau kolom harga/biaya maupun paket konsumsi di UI, API, dan database.
- [ ] Popup booking menampilkan ID Work, nama, email, no. telp secara otomatis dan read-only; jumlah orang divalidasi terhadap kapasitas.
- [ ] Timeline menampilkan booking pemesan lain per tanggal; blok terisi tidak bisa dipilih; Start/End sinkron dengan blok pilihan.
- [ ] Semua waktu booking berupa jam tepat; rentang kelipatan 1 jam bisa dipilih.
- [ ] Sidebar memiliki Beranda, Ruang Rapat, dan Riwayat; Beranda menampilkan profil worker.
- [ ] Filter Ruang Rapat (tanggal, durasi Start-End, kapasitas, fasilitas, ketersediaan, gedung) bisa digabung dan Reset Filter berfungsi.
- [ ] Riwayat menampilkan status Akan Datang / Sedang Berlangsung / Selesai dengan benar.
- [ ] Tampilan rapi di 360 px dan 1280 px.

### 8.11 Sisi Admin: Kelola Ruangan

Bagian ini menggantikan Bagian 6.9 (halaman Admin dan card Edit/Hapus di galeri), 7.9 (endpoint ruangan), dan semua ketentuan slot 30 menit untuk ruangan baru. Admin hanya mengelola ruangan. **Admin tidak membuat booking** (tetap sesuai 5.1), dan dashboard seluruh booking tetap di luar scope.

**Peran dan akses**
- Role dibaca dari kolom `workers.role` di database (bukan dari metadata Clerk). Admin juga punya baris di tabel `workers`, jadi Beranda tampil seperti Worker.
- Backend memakai middleware `requireAdmin`: tanpa token **401**, Worker **403**. UI hanya menyembunyikan menu; keamanan ada di backend.

**Sidebar Admin:** Beranda, Ruang Rapat, **Kelola Ruangan**. Menu **Riwayat disembunyikan** karena Admin tidak membuat booking. Header menampilkan badge role "Admin".

**Perilaku halaman yang dipakai bersama**
- **Ruang Rapat** (`/rooms`): tampil sama seperti Worker, termasuk semua filter, tetapi card Admin hanya punya tombol **Detail Ruangan** (tanpa Pesan Ruangan).
- **Detail Ruangan** (`/rooms/:id`): kalender dan timeline tampil read-only (blok terisi dengan nama pemesan). Tidak ada tombol Pesan, tidak ada pemilihan rentang, tidak ada popup pemesanan. Email dan no. telp pemesan tidak ditampilkan.

**Rute Admin**

| Rute | Akses | Isi |
|---|---|---|
| `/admin/rooms` | Admin | Tabel Kelola Ruangan |
| `/admin/rooms/new` | Admin | Form tambah ruangan |
| `/admin/rooms/:id/edit` | Admin | Form ubah ruangan |

Worker yang membuka rute ini diarahkan ke `/403`. Rute `/rooms/new` dan `/rooms/:id/edit` dari 6.9 tidak dipakai lagi.

**Tabel Kelola Ruangan** (`/admin/rooms`)
- Judul "Kelola Ruangan", tombol **Tambah Ruangan**, kolom pencarian nama, dan "Total: N ruangan".
- Kolom: No, Nama, Gedung, Lantai, Kapasitas, Fasilitas (chip), Jam Operasional, Aksi (**Edit**, **Hapus**).
- Hapus memakai dialog konfirmasi. Pesan error dari backend (409) ditampilkan apa adanya.
- State loading (skeleton), error (Coba lagi), dan empty ("Belum ada ruangan" + tombol Tambah Ruangan).

**Form tambah/ubah ruangan** (pratinjau card langsung di samping atau di bawah form, tampilannya sama dengan card di Ruang Rapat)

| Field | Aturan |
|---|---|
| Nama ruangan | Wajib, 2 sampai 100 karakter |
| Tipe | Wajib, Onsite atau Online, default Onsite |
| Gedung | Wajib bila Onsite, maksimal 50 karakter (dipakai filter Gedung) |
| Lantai | Wajib bila Onsite, integer 0 sampai 100 (dipakai filter Lantai) |
| Lokasi (teks tampilan) | Otomatis dari Gedung dan Lantai, contoh "Lantai 2 Gedung A"; "Online" bila tipe Online |
| Kapasitas (maks. orang) | Wajib, integer 1 sampai 500 |
| Jam buka dan jam tutup | Wajib, **jam tepat** (format `HH:00`), jam tutup lebih besar dari jam buka, default 08:00 dan 21:00 |
| Fasilitas | Opsional, input tag; saran: Wi-Fi, Internet, Proyektor, Whiteboard, TV/Monitor, AC |
| Gambar | Opsional, URL gambar dengan pratinjau |
| Catatan khusus | Opsional, maksimal 200 karakter |

Tombol Simpan nonaktif sampai form valid; ada state loading saat menyimpan; error 422 tampil per field; berhasil tampil toast lalu kembali ke tabel. Mode Edit memuat data lama dari `GET /rooms/:id`.

**Endpoint Admin**

| Method | Endpoint | Hasil |
|---|---|---|
| POST | `/rooms` | **201** ruangan baru; slot 60 menit dibuat otomatis dari `openTime` sampai `closeTime` dalam satu transaksi (08:00 sampai 21:00 menghasilkan 13 slot) |
| PUT | `/rooms/:id` | **200**; validasi sama dengan create; **404** bila tidak ada |
| DELETE | `/rooms/:id` | **200** bila berhasil; **404** bila tidak ada; **409** bila ruangan memiliki booking |

Body `POST` dan `PUT`: `{ name, type, building, floor, capacity, openTime, closeTime, facilities, image, notes }`. Kolom `location` dibentuk server dari `building` dan `floor` (atau "Online"), bukan dari body.

**Aturan bisnis**
- Ubah jam operasional: slot jam baru ditambahkan; slot di luar jam baru dihapus **hanya bila belum pernah punya booking**. Slot yang pernah punya booking dipertahankan.
- Ubah kapasitas menjadi lebih kecil dari `participants` pada booking mendatang: **409** dengan pesan jelas.
- Hapus ruangan yang memiliki booking (mendatang maupun riwayat): **409** "Ruangan memiliki booking dan tidak dapat dihapus", supaya riwayat Worker tidak rusak. Hapus ruangan tanpa booking menghapus slotnya otomatis (cascade).
- Validasi dengan Zod; format error 401/403/422 mengikuti 7.5 dan 7.9. `POST /bookings` oleh Admin tetap **403**.

**Seeder:** admin diisi lewat seeder (SEED_ADMIN_EMAIL), dengan nama dan `worker_code` sendiri.

**Skenario uji Admin**

| # | Skenario | Hasil |
|---|---|---|
| 32 | Token Worker memanggil `POST /rooms` | 403 |
| 33 | Tanpa token memanggil `POST /rooms` | 401 |
| 34 | Token Admin `POST /rooms` jam 09:00-18:00 | 201, 9 slot terbentuk |
| 35 | Token Admin `POST /rooms` dengan `openTime` 09:30 | 422 |
| 36 | Token Admin `PUT /rooms/:id` mengubah jam buka ke 10:00 pada ruangan yang punya booking jam 09:00 | 200, slot 09:00 tetap ada |
| 37 | Token Admin `DELETE /rooms/:id` pada ruangan yang punya booking | 409 |
| 38 | Token Admin `DELETE /rooms/:id` pada ruangan tanpa booking | 200, slot ikut terhapus |
| 39 | Token Admin `POST /bookings` | 403 |
| 40 | Worker membuka `/admin/rooms` | Diarahkan ke `/403` |

**Acceptance Criteria Admin**

- [ ] Menu Kelola Ruangan hanya tampil untuk Admin; Worker yang membuka rutenya diarahkan ke `/403`.
- [ ] Admin berhasil menambah, mengubah, dan menghapus ruangan; ruangan baru langsung muncul di Ruang Rapat dan bisa dipesan Worker.
- [ ] Slot jam tepat terbentuk otomatis sesuai jam buka dan jam tutup.
- [ ] Hapus ruangan yang punya booking ditolak dengan pesan jelas.
- [ ] Admin tidak melihat tombol Pesan Ruangan di mana pun, dan menu Riwayat tidak tampil untuk Admin.
- [ ] Role ditegakkan di backend lewat `requireAdmin`, bukan hanya di UI.

---

# BAGIAN C: PENGUMPULAN

## 9. Dokumentasi dan Repository

**Struktur repo (monorepo, public di GitHub):**

```
/frontend
/backend
README.md        # ringkasan + link ke README tiap bagian
```

**README wajib memuat:**

1. Deskripsi singkat dan screenshot alur (stepper, sukses).
2. **Teknologi** yang dipakai beserta versinya.
3. **Cara menjalankan**: prasyarat, install, setup env, migrate dan seed, start backend, start frontend (atau json-server).
4. **Dokumentasi endpoint**: tabel endpoint, contoh request/response, daftar status code (atau tautan Postman/Swagger).
5. **Asumsi** yang dibuat (lihat Bagian 5, catatan 409 vs 422, dan keputusan lain).
6. **Penggunaan AI**: jelaskan alat AI yang dipakai dan untuk apa (contoh: brainstorming struktur, pembuatan boilerplate, review validasi, debugging), serta bagian mana yang ditulis dan diverifikasi sendiri. Penggunaan referensi dan AI diperbolehkan asalkan dijelaskan.

**Tambahan README untuk autentikasi:** cara membuat aplikasi Clerk, mengatur provider login (misalnya Google), daftar env Clerk frontend/backend, cara menetapkan role Admin dengan aman, serta langkah menjalankan dan menguji role Admin dan Worker. Jelaskan bahwa booking ruang rapat merupakan fasilitas internal tanpa biaya sewa; karena itu semua field harga, kalkulasi harga, dan kolom biaya sengaja dihilangkan dari UI, API, dan database meskipun mungkin muncul pada soal awal.

## 10. Rencana Pengerjaan 3 Hari

| Hari | Fokus | Output |
|---|---|---|
| 1 | Setup repo, `db.json`, kerangka Frontend (stepper, state, API layer); skema database, migration, seeder Backend | Langkah 1 dan 2 berjalan; tabel dan seed siap |
| 2 | Form, validasi, konfirmasi, sukses, loading/error di Frontend; endpoint dan validasi `POST /bookings` di Backend | Alur end-to-end di mock; semua endpoint berfungsi |
| 3 | Responsif dan polish UI; sambungkan Frontend ke Backend asli; uji skenario 409/422; dokumentasi dan Postman; README final | Repo siap dikumpulkan |

## 11. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| json-server tidak menolak double booking atau memvalidasi | Validasi sisi klien kuat; logika bisnis diuji pada Backend asli |
| Format respons mock beda dengan Backend | Lapisan `api.js` yang membuka envelope |
| Waktu 3 hari terbatas | Kerjakan fitur Wajib dulu, item "Disarankan" belakangan |
| Race condition booking | Unique constraint `(slot_id, date)` + transaksi |
| README kurang jelas | Uji dengan clone bersih di folder baru sebelum submit |

## 12. Definition of Done

- Semua item Wajib pada Bagian 6.3 dan semua acceptance criteria Backend terpenuhi.
- Proyek bisa dijalankan dari clone bersih hanya dengan mengikuti README.
- Repo GitHub public, tanpa file rahasia (`.env` tidak ikut ter-commit, `.env.example` ada).
- Penggunaan AI dan asumsi sudah dijelaskan di README.