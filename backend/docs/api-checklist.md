# Book-in API checklist

## Base URL and authentication

Local base URL: `http://localhost:4000`

Send a Clerk **session token** on authenticated requests:

```http
Authorization: Bearer <CLERK_SESSION_TOKEN>
Content-Type: application/json
```

Do not use a Clerk publishable key or secret key as the bearer token. Role and
worker profile are read from the `workers` database record. Only verified
Clerk email addresses can be matched to a worker.

All responses use `{ "success": boolean, "message": string, "data"?: ...,
"errors"?: ... }`. Validation failures return HTTP 422 with an `errors` object
whose values are arrays of field-specific messages. Authentication failures
return 401 `Silakan login terlebih dahulu`; an email without a worker record
returns 403 `Akun belum terdaftar sebagai worker`; role failures return 403
`Anda tidak memiliki akses untuk aksi ini`. Unexpected server failures return
500 with a generic message.

Public health check:

```json
{
  "success": true,
  "message": "OK",
  "data": { "status": "ok" }
}
```

Example validation error:

```json
{
  "success": false,
  "message": "Validasi gagal",
  "errors": { "durationMinutes": ["Invalid input: number must be a multiple of 60"] }
}
```

## Endpoint reference

| Method | Endpoint | Access | Expected result |
|---|---|---|---|
| GET | `/health` | Public | 200, `data.status: "ok"` |
| GET | `/workers/me` | Login | 200, workerCode, name, email, phone, position, role, photoUrl |
| GET | `/rooms` | Login | 200, all rooms; optionally availability fields |
| GET | `/rooms/:id` | Login | 200 room, or 404 |
| GET | `/slots?roomId=1&date=2026-10-20` | Login | 200 one-hour slots with `isAvailable` |
| GET | `/bookings?roomId=1&from=2026-10-20&to=2026-10-31` | Login | 200 calendar events, without email or phone |
| GET | `/bookings/me?page=1&limit=10` | Worker | 200 own history and pagination |
| POST | `/bookings` | Worker | 201 booking, or 409 conflict |
| POST | `/bookings` | Admin | 403 |
| POST | `/rooms` | Admin | 201 room and automatically created hourly slots |
| PUT | `/rooms/:id` | Admin | 200 updated room; 404 or 409 where applicable |
| DELETE | `/rooms/:id` | Admin | 200 deleted room; 404 or 409 where applicable |

Example room response item:

```json
{
  "success": true,
  "message": "OK",
  "data": [{
    "id": 1,
    "name": "Ruang Alpha A",
    "type": "ONSITE",
    "building": "Gedung A",
    "floor": 2,
    "location": "Lantai 2 Gedung A",
    "capacity": 6,
    "facilities": ["Wi-Fi", "Proyektor"],
    "image": null,
    "notes": null,
    "openTime": "08:00",
    "closeTime": "21:00"
  }]
}
```

### Check availability

All three query parameters must be present together. Times must be exact
hours; date cannot be in the past.

```http
GET /rooms?date=2026-10-20&startTime=09:00&endTime=11:00
```

Response rooms include `isAvailable: true|false`. Availability is false if the
range is outside operating hours, any required slot is absent, or one or more
slots are already booked.

Example booking response:

```json
{
  "success": true,
  "message": "Booking berhasil dibuat",
  "data": {
    "id": 20,
    "code": "BK-A1B2C3",
    "roomId": 1,
    "date": "2026-10-20",
    "startTime": "09:00",
    "endTime": "11:00",
    "durationMinutes": 120,
    "participants": 3,
    "description": "Rapat sprint"
  }
}
```

### Read room slots

```http
GET /slots?roomId=1&date=2026-10-20
```

`date` is optional. Without it, slots are returned as available. A supplied
date marks slots occupied by any booking as unavailable.

### Read room calendar

```http
GET /bookings?roomId=1&from=2026-10-20&to=2026-10-31
```

The date range may span at most 31 days. Event data contains only `id`,
`roomId`, `date`, `startTime`, `endTime`, `bookedBy` (name), and `isMine`.

### Read worker history

```http
GET /bookings/me?page=1&limit=10
```

History items include `id`, `code`, `roomName`, date, Indonesian weekday,
start/end, status (`Akan Datang`, `Sedang Berlangsung`, or `Selesai` in
Asia/Jakarta), and description.

### Create a booking

```http
POST /bookings
{
  "roomId": 1,
  "slotId": 3,
  "date": "2026-10-20",
  "durationMinutes": 120,
  "participants": 3,
  "description": "Rapat sprint"
}
```

Name, email, phone, and workerId are taken from the authenticated database
worker record. Extra contact fields in the request body are ignored.
Duration must be at least 60 minutes and a multiple of 60. A same-day slot
must not have started; participant count must not exceed room capacity.
Each successful booking creates all covered `booking_slots` in the same
database transaction. An occupied slot returns 409.

### Create or update a room (Admin)

```http
POST /rooms
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

`type` accepts `ONSITE`/`ONLINE` (case-insensitive). For onsite rooms,
building (max 50 characters) and floor (integer 0–100) are required. Location
is generated as `Lantai <floor> <building>`; online rooms use `Online`.
Capacity is 1–500. Operating hours must be whole hours (`HH:00`) and close
must be later than open. Facilities are optional; image must be a valid URL
of at most 255 characters; notes are optional and at most 200 characters.
Successful create inserts one 60-minute slot per hour in a transaction.
PUT uses the same body and validation.

When operating hours change, new slots are added and out-of-range slots are
deleted only when they have never been booked. A capacity reduction that
would invalidate an upcoming booking returns 409. A room with any booking
(past or future) cannot be deleted and returns 409.

## Manual verification scenarios

Use seeded database records, a Clerk session token whose verified email maps
to a worker, and an Admin token mapped to a worker whose database role is
`ADMIN`. Avoid changing/deleting seeded records when testing against shared
data; use a disposable room for Admin create/update/delete tests.

| PRD scenario | Request/setup | Expected |
|---|---|---|
| 25 | Clerk login with verified email absent from `workers`; call `/workers/me` | 403, account not registered |
| 26 | Worker books an available two-hour range starting 09:00 | 201, endTime 11:00, two `booking_slots` |
| 27 | Worker posts `durationMinutes: 90` | 422 |
| 28 | Worker posts forged name/email/phone along with valid booking data | 201; snapshot comes from `workers` |
| 29 | Worker calls `/bookings?roomId=1&from=...&to=...` | 200; no contact email or phone |
| 30 | Worker calls `/bookings/me` | 200; only their bookings and calculated statuses |
| 31 | Request `/rooms?date=...&startTime=09:00&endTime=11:00` with 10:00 booked | That room has `isAvailable: false` |
| 32 | Worker calls `POST /rooms` | 403 |
| 33 | No token calls `POST /rooms` | 401 |
| 34 | Admin creates 09:00–18:00 room | 201; nine hourly slots |
| 35 | Admin creates room with `openTime: "09:30"` | 422 with field error |
| 36 | Admin updates opening time to 10:00 where 09:00 slot is booked | 200; booked 09:00 slot remains |
| 37 | Admin deletes a room with any booking | 409, `Ruangan memiliki booking dan tidak dapat dihapus` |
| 38 | Admin deletes a room without bookings | 200; its slots cascade-delete |
| 39 | Admin calls `POST /bookings` | 403 |
| 40 | Worker opens `/admin/rooms` | Frontend redirects to `/403`; no such page route is implemented by this API |
| — | No token calls `GET /rooms` or `GET /workers/me` | 401 JSON, not redirect |
| — | Invalid/expired Clerk session token | 401 |
| — | Booking exceeds room capacity | 409 |
| — | Booking date or same-day start time has passed | 422 |
| — | Booking range extends beyond room closing time | 409 |
| — | Booking uses slot from another room | 422 |
| — | Booking collides on any covered `booking_slots` row | 409 |
| — | Calendar request spans more than 31 days | 422 |
| — | Room schedule is partial, non-hourly, or has close ≤ open | 422 |
| — | Capacity reduced below participants of an upcoming booking | 409 |
