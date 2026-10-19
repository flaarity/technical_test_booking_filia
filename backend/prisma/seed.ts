import "dotenv/config";
import { Role, RoomType } from "../generated/prisma/client.js";
import { prisma } from "../src/lib/prisma.js";

const requiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} wajib diisi sebelum menjalankan seeder.`);
  }
  return value;
};

const workerEmail = requiredEnv("SEED_WORKER_EMAIL").toLowerCase();
const workerName = requiredEnv("SEED_WORKER_NAME");
const adminEmail = requiredEnv("SEED_ADMIN_EMAIL").toLowerCase();
const adminName = requiredEnv("SEED_ADMIN_NAME");

if (workerEmail === adminEmail) {
  throw new Error("SEED_ADMIN_EMAIL harus berbeda dari SEED_WORKER_EMAIL.");
}

const workers = [
  {
    workerCode: "INM-100000001",
    name: workerName,
    email: workerEmail,
    phone: "081234567801",
    position: "Web Developer Intern",
    role: Role.WORKER,
  },
  {
    workerCode: "INM-100000002",
    name: adminName,
    email: adminEmail,
    phone: "081234567802",
    position: "Meeting Room Administrator",
    role: Role.ADMIN,
  },
  {
    workerCode: "INM-100000003",
    name: "Budi Santoso",
    email: "budi.santoso@example.com",
    phone: "081234567803",
    position: "Product Designer",
    role: Role.WORKER,
  },
  {
    workerCode: "INM-100000004",
    name: "Siti Rahmawati",
    email: "siti.rahmawati@example.com",
    phone: "081234567804",
    position: "Project Manager",
    role: Role.WORKER,
  },
];

const rooms = [
  {
    name: "Ruang Alpha A",
    capacity: 6,
    building: "Gedung A",
    floor: 2,
    location: "Lantai 2 Gedung A",
    facilities: ["Wi-Fi", "Proyektor", "Whiteboard", "AC"],
    notes: null,
  },
  {
    name: "Ruang Alpha B",
    capacity: 4,
    building: "Gedung A",
    floor: 3,
    location: "Lantai 3 Gedung A",
    facilities: ["Wi-Fi", "TV/Monitor", "AC"],
    notes: null,
  },
  {
    name: "Ruang Betta A",
    capacity: 8,
    building: "Gedung B",
    floor: 1,
    location: "Lantai 1 Gedung B",
    facilities: ["Internet", "Proyektor", "Whiteboard", "AC"],
    notes: "Gunakan whiteboard dengan hati-hati.",
  },
  {
    name: "Ruang Gamma A",
    capacity: 10,
    building: "Gedung A",
    floor: 4,
    location: "Lantai 4 Gedung A",
    facilities: ["Wi-Fi", "Proyektor", "TV/Monitor", "AC"],
    notes: null,
  },
  {
    name: "Ruang Delta A",
    capacity: 12,
    building: "Gedung B",
    floor: 2,
    location: "Lantai 2 Gedung B",
    facilities: ["Internet", "Whiteboard", "TV/Monitor", "AC"],
    notes: null,
  },
  {
    name: "Ruang Epsilon A",
    capacity: 16,
    building: "Gedung A",
    floor: 5,
    location: "Lantai 5 Gedung A",
    facilities: ["Wi-Fi", "Internet", "Proyektor", "Whiteboard", "AC"],
    notes: null,
  },
  {
    name: "Ruang Zeta A",
    capacity: 20,
    building: "Gedung B",
    floor: 3,
    location: "Lantai 3 Gedung B",
    facilities: ["Wi-Fi", "Internet", "Proyektor", "Whiteboard", "TV/Monitor", "AC"],
    notes: null,
  },
].map((room) => ({
  ...room,
  type: RoomType.ONSITE,
  openTime: "08:00",
  closeTime: "21:00",
}));

const jakartaDateParts = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== "literal") {
        parts[part.type] = part.value;
      }
      return parts;
    }, {});

const dateAtOffset = (today: string, offset: number): Date => {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};

const formatTime = (hour: number): string =>
  `${String(hour).padStart(2, "0")}:00`;

const main = async (): Promise<void> => {
  const workerRecords = await Promise.all(
    workers.map((worker) =>
      prisma.worker.upsert({
        where: { email: worker.email },
        create: { ...worker, photoUrl: null, clerkUserId: null },
        update: { ...worker, photoUrl: null, clerkUserId: null },
      }),
    ),
  );
  const workerByEmail = new Map(workerRecords.map((worker) => [worker.email, worker]));

  const roomRecords = await Promise.all(
    rooms.map(async (room) => {
      const existingRoom = await prisma.room.findFirst({
        where: { name: room.name },
      });
      return existingRoom
        ? prisma.room.update({
            where: { id: existingRoom.id },
            data: room,
          })
        : prisma.room.create({ data: room });
    }),
  );
  const roomByName = new Map(roomRecords.map((room) => [room.name, room]));

  const slotsByRoom = new Map<
    string,
    Array<{ id: number; startTime: string; endTime: string }>
  >();

  for (const room of roomRecords) {
    const roomSlots = [];
    for (let hour = 8; hour < 21; hour += 1) {
      const startTime = formatTime(hour);
      const endTime = formatTime(hour + 1);
      const slot = await prisma.slot.upsert({
        where: { roomId_startTime: { roomId: room.id, startTime } },
        create: { roomId: room.id, startTime, endTime },
        update: { endTime },
      });
      roomSlots.push(slot);
    }
    slotsByRoom.set(room.name, roomSlots);
  }

  const jakartaNow = jakartaDateParts(new Date());
  const today = `${jakartaNow.year}-${jakartaNow.month}-${jakartaNow.day}`;
  const currentHour = Number(jakartaNow.hour);
  const ongoingHour = currentHour >= 8 && currentHour < 21;
  const sampleBookings = [
    {
      code: "BK-SEED01",
      roomName: "Ruang Alpha A",
      workerEmail: "budi.santoso@example.com",
      dayOffset: -7,
      startHour: 9,
      durationHours: 1,
      participants: 3,
      description: "Rapat perencanaan produk",
    },
    {
      code: "BK-SEED02",
      roomName: "Ruang Alpha B",
      workerEmail,
      dayOffset: -1,
      startHour: 10,
      durationHours: 2,
      participants: 3,
      description: "Evaluasi sprint",
    },
    {
      code: "BK-SEED03",
      roomName: "Ruang Betta A",
      workerEmail: "siti.rahmawati@example.com",
      dayOffset: 1,
      startHour: 10,
      durationHours: 1,
      participants: 5,
      description: "Diskusi desain",
    },
    {
      code: "BK-SEED04",
      roomName: "Ruang Gamma A",
      workerEmail,
      dayOffset: 1,
      startHour: 10,
      durationHours: 1,
      participants: 6,
      description: "Sinkronisasi tim",
    },
    {
      code: "BK-SEED05",
      roomName: "Ruang Delta A",
      workerEmail: "budi.santoso@example.com",
      dayOffset: 3,
      startHour: 14,
      durationHours: 1,
      participants: 8,
      description: "Review kebutuhan",
    },
    {
      code: "BK-SEED06",
      roomName: "Ruang Epsilon A",
      workerEmail: "siti.rahmawati@example.com",
      dayOffset: 5,
      startHour: 20,
      durationHours: 1,
      participants: 12,
      description: "Perencanaan kuartal",
    },
    {
      code: "BK-SEED07",
      roomName: "Ruang Zeta A",
      workerEmail,
      dayOffset: ongoingHour ? 0 : 7,
      startHour: ongoingHour ? currentHour : 9,
      durationHours: 1,
      participants: 15,
      description: ongoingHour ? "Rapat tim yang sedang berlangsung" : "Rapat tim",
    },
  ];

  await prisma.booking.deleteMany({
    where: { code: { startsWith: "BK-SEED" } },
  });

  const bookedSlots = new Set<string>();
  for (const booking of sampleBookings) {
    const room = roomByName.get(booking.roomName);
    const assignedWorker = workerByEmail.get(booking.workerEmail);
    const roomSlots = slotsByRoom.get(booking.roomName);
    if (!room || !assignedWorker || !roomSlots) {
      throw new Error(`Data seed tidak lengkap untuk booking ${booking.code}.`);
    }

    const firstSlotIndex = booking.startHour - 8;
    const coveredSlots = roomSlots.slice(
      firstSlotIndex,
      firstSlotIndex + booking.durationHours,
    );
    if (coveredSlots.length !== booking.durationHours) {
      throw new Error(`Jadwal booking ${booking.code} melewati jam operasional.`);
    }

    const date = dateAtOffset(today, booking.dayOffset);
    const slotKeys = coveredSlots.map((slot) => `${slot.id}:${date.toISOString()}`);
    if (slotKeys.some((key) => bookedSlots.has(key))) {
      throw new Error(`Jadwal booking seed bentrok pada booking ${booking.code}.`);
    }
    slotKeys.forEach((key) => bookedSlots.add(key));

    const firstSlot = coveredSlots[0];
    const lastSlot = coveredSlots[coveredSlots.length - 1];
    if (!firstSlot || !lastSlot) {
      throw new Error(`Slot waktu tidak valid untuk booking ${booking.code}.`);
    }

    await prisma.booking.create({
      data: {
        code: booking.code,
        roomId: room.id,
        slotId: firstSlot.id,
        workerId: assignedWorker.id,
        date,
        startTime: firstSlot.startTime,
        endTime: lastSlot.endTime,
        durationMinutes: booking.durationHours * 60,
        participants: booking.participants,
        description: booking.description,
        name: assignedWorker.name,
        email: assignedWorker.email,
        phone: assignedWorker.phone,
        bookingSlots: {
          create: coveredSlots.map((slot) => ({
            slotId: slot.id,
            date,
          })),
        },
      },
    });
  }

  const [workerCount, roomCount, slotCount, bookingCount, bookingSlotCount] =
    await Promise.all([
      prisma.worker.count(),
      prisma.room.count(),
      prisma.slot.count(),
      prisma.booking.count(),
      prisma.bookingSlot.count(),
    ]);

  console.info("Seeding selesai. Jumlah baris:");
  console.info(
    JSON.stringify(
      {
        workers: workerCount,
        rooms: roomCount,
        slots: slotCount,
        bookings: bookingCount,
        booking_slots: bookingSlotCount,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error: unknown) => {
    console.error("Seeder gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
