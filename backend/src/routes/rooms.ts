import { Router } from "express";
import { z } from "zod";
import { RoomType } from "../../generated/prisma/client.js";
import { requireAdmin, requireWorkerAccount } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import {
  buildHourlyRanges,
  formatDateOnlyUTC,
  formatRoomLocation,
  getBookingStatus,
  getJakartaToday,
  isDateOnly,
  isExactHour,
  parseDateOnlyUTC,
} from "../lib/booking-time.js";
import { prisma } from "../lib/prisma.js";
import { sendSuccess } from "../lib/responses.js";
import { parseInput } from "../lib/validation.js";

const router = Router();

const roomIdSchema = z.coerce.number().int().positive();
const roomSearchSchema = z
  .object({
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  })
  .superRefine((query, context) => {
    const hasDate = query.date !== undefined;
    const hasStart = query.startTime !== undefined;
    const hasEnd = query.endTime !== undefined;
    if (!(hasDate === hasStart && hasStart === hasEnd)) {
      for (const key of ["date", "startTime", "endTime"] as const) {
        if (query[key] === undefined) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "Parameter ini harus dikirim bersama parameter jadwal lainnya",
          });
        }
      }
      return;
    }
    if (!hasDate) return;
    if (!isDateOnly(query.date!)) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "Tanggal harus berformat YYYY-MM-DD dan valid",
      });
    } else if (query.date! < getJakartaToday()) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "Tanggal tidak boleh sebelum hari ini",
      });
    }
    for (const key of ["startTime", "endTime"] as const) {
      if (!isExactHour(query[key]!)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Waktu harus berformat HH:00",
        });
      }
    }
    if (
      isExactHour(query.startTime!) &&
      isExactHour(query.endTime!) &&
      query.endTime! <= query.startTime!
    ) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Jam selesai harus lebih besar dari jam mulai",
      });
    }
  });

const optionalBuilding = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).max(50).optional().nullable(),
);
const optionalFloor = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.number().int().min(0).max(100).optional().nullable(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().max(255).url().optional().nullable(),
);
const optionalNotes = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().max(200).optional().nullable(),
);

const roomMutationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    type: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.enum([RoomType.ONSITE, RoomType.ONLINE])),
    building: optionalBuilding,
    floor: optionalFloor,
    capacity: z.number().int().min(1).max(500),
    openTime: z.string().regex(/^(?:[01]\d|2[0-3]):00$/, "Jam harus HH:00"),
    closeTime: z.string().regex(/^(?:[01]\d|2[0-3]):00$/, "Jam harus HH:00"),
    facilities: z.array(z.string().trim().min(1)).default([]),
    image: optionalUrl,
    notes: optionalNotes,
  })
  .superRefine((room, context) => {
    if (room.closeTime <= room.openTime) {
      context.addIssue({
        code: "custom",
        path: ["closeTime"],
        message: "Jam tutup harus lebih besar dari jam buka",
      });
    }
    if (room.type === RoomType.ONSITE) {
      if (!room.building) {
        context.addIssue({
          code: "custom",
          path: ["building"],
          message: "Gedung wajib diisi untuk ruangan onsite",
        });
      }
      if (room.floor === null || room.floor === undefined) {
        context.addIssue({
          code: "custom",
          path: ["floor"],
          message: "Lantai wajib diisi untuk ruangan onsite",
        });
      }
    }
  });

type RoomMutation = z.infer<typeof roomMutationSchema>;

const roomData = (input: RoomMutation) => ({
  name: input.name,
  type: input.type,
  building: input.type === RoomType.ONSITE ? input.building ?? null : null,
  floor: input.type === RoomType.ONSITE ? input.floor ?? null : null,
  capacity: input.capacity,
  openTime: input.openTime,
  closeTime: input.closeTime,
  facilities: input.facilities,
  image: input.image ?? null,
  notes: input.notes ?? null,
  location: formatRoomLocation(
    input.type,
    input.type === RoomType.ONSITE ? input.building : null,
    input.type === RoomType.ONSITE ? input.floor : null,
  ),
});

const roomSlotsData = (roomId: number, openTime: string, closeTime: string) =>
  buildHourlyRanges(openTime, closeTime).map((range) => ({
    roomId,
    ...range,
  }));

router.get("/", requireWorkerAccount, async (request, response, next) => {
  try {
    const query = parseInput(roomSearchSchema, request.query);
    const rooms = await prisma.room.findMany({ orderBy: { name: "asc" } });
    if (!query.date) {
      sendSuccess(response, 200, "OK", rooms);
      return;
    }

    const requestedRanges = buildHourlyRanges(query.startTime!, query.endTime!);
    const date = parseDateOnlyUTC(query.date!)!;
    const results = await Promise.all(
      rooms.map(async (room) => {
        const inOperatingHours =
          query.startTime! >= room.openTime &&
          query.endTime! <= room.closeTime &&
          requestedRanges.length > 0;
        if (!inOperatingHours) return { ...room, isAvailable: false };

        const slots = await prisma.slot.findMany({
          where: {
            roomId: room.id,
            startTime: { in: requestedRanges.map((range) => range.startTime) },
          },
        });
        const slotByStart = new Map(slots.map((slot) => [slot.startTime, slot]));
        const completeSlotCoverage = requestedRanges.every(
          (range) => slotByStart.get(range.startTime)?.endTime === range.endTime,
        );
        if (!completeSlotCoverage) return { ...room, isAvailable: false };

        const bookedSlots = await prisma.bookingSlot.findMany({
          where: {
            date,
            slotId: { in: slots.map((slot) => slot.id) },
          },
          select: { slotId: true },
        });
        return {
          ...room,
          isAvailable: bookedSlots.length === 0,
        };
      }),
    );
    sendSuccess(response, 200, "OK", results);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireWorkerAccount, async (request, response, next) => {
  try {
    const id = parseInput(roomIdSchema, request.params["id"]);
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) throw new HttpError(404, "Ruangan tidak ditemukan");
    sendSuccess(response, 200, "OK", room);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requireWorkerAccount,
  requireAdmin,
  async (request, response, next) => {
    try {
      const input = parseInput(roomMutationSchema, request.body);
      const data = roomData(input);
      const room = await prisma.$transaction(async (transaction) => {
        const createdRoom = await transaction.room.create({ data });
        await transaction.slot.createMany({
          data: roomSlotsData(createdRoom.id, createdRoom.openTime, createdRoom.closeTime),
        });
        return createdRoom;
      });
      sendSuccess(response, 201, "Ruangan berhasil dibuat", room);
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/:id",
  requireWorkerAccount,
  requireAdmin,
  async (request, response, next) => {
    try {
      const id = parseInput(roomIdSchema, request.params["id"]);
      const input = parseInput(roomMutationSchema, request.body);
      const data = roomData(input);
      const updatedRoom = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.room.findUnique({
          where: { id },
          include: {
            slots: {
              include: {
                bookings: { select: { id: true } },
                bookingSlots: { select: { id: true } },
              },
            },
          },
        });
        if (!existing) throw new HttpError(404, "Ruangan tidak ditemukan");

        if (input.capacity < existing.capacity) {
          const upcomingBookings = await transaction.booking.findMany({
            where: {
              roomId: id,
              date: { gte: parseDateOnlyUTC(getJakartaToday())! },
            },
            select: {
              participants: true,
              date: true,
              startTime: true,
              endTime: true,
            },
          });
          const capacityConflict = upcomingBookings.some(
            (booking) =>
              booking.participants > input.capacity &&
              getBookingStatus(
                formatDateOnlyUTC(booking.date),
                booking.startTime,
                booking.endTime,
              ) !== "Selesai",
          );
          if (capacityConflict) {
            throw new HttpError(
              409,
              "Kapasitas tidak dapat lebih kecil dari jumlah peserta pada booking mendatang",
            );
          }
        }

        const updated = await transaction.room.update({
          where: { id },
          data,
        });
        const desiredRanges = buildHourlyRanges(input.openTime, input.closeTime);
        const desiredStarts = new Set(
          desiredRanges.map((range) => range.startTime),
        );
        const removableSlotIds = existing.slots
          .filter(
            (slot) =>
              !desiredStarts.has(slot.startTime) &&
              slot.bookings.length === 0 &&
              slot.bookingSlots.length === 0,
          )
          .map((slot) => slot.id);
        if (removableSlotIds.length > 0) {
          await transaction.slot.deleteMany({
            where: { id: { in: removableSlotIds } },
          });
        }
        for (const range of desiredRanges) {
          await transaction.slot.upsert({
            where: {
              roomId_startTime: { roomId: id, startTime: range.startTime },
            },
            create: { roomId: id, ...range },
            update: { endTime: range.endTime },
          });
        }
        return updated;
      });
      sendSuccess(response, 200, "Ruangan berhasil diperbarui", updatedRoom);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  requireWorkerAccount,
  requireAdmin,
  async (request, response, next) => {
    try {
      const id = parseInput(roomIdSchema, request.params["id"]);
      await prisma.$transaction(async (transaction) => {
        const room = await transaction.room.findUnique({
          where: { id },
          select: {
            id: true,
            bookings: { select: { id: true }, take: 1 },
          },
        });
        if (!room) throw new HttpError(404, "Ruangan tidak ditemukan");
        if (room.bookings.length > 0) {
          throw new HttpError(
            409,
            "Ruangan memiliki booking dan tidak dapat dihapus",
          );
        }
        await transaction.room.delete({ where: { id } });
      });
      sendSuccess(response, 200, "Ruangan berhasil dihapus", { id });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
