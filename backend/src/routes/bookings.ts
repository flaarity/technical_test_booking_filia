import { randomBytes } from "node:crypto";
import { Router } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import {
  buildHourlyRanges,
  formatDateOnlyUTC,
  formatIndonesianWeekday,
  getBookingStatus,
  getJakartaTime,
  getJakartaToday,
  isDateOnly,
  parseDateOnlyUTC,
} from "../lib/booking-time.js";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { sendSuccess } from "../lib/responses.js";
import { parseInput } from "../lib/validation.js";
import {
  requireWorkerAccount,
  requireWorkerRole,
} from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

const calendarQuerySchema = z.object({
  roomId: z.coerce.number().int().positive(),
  from: z.string(),
  to: z.string(),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const bookingBodySchema = z.object({
  roomId: z.number().int().positive(),
  slotId: z.number().int().positive(),
  date: z.string(),
  durationMinutes: z.number().int().min(60).multipleOf(60),
  participants: z.number().int().min(1),
  description: z.string().trim().max(200).optional(),
});

const isCodeUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  (Array.isArray(error.meta?.["target"])
    ? error.meta["target"].some((field) => String(field).toLowerCase().includes("code"))
    : String(error.meta?.["target"] ?? "").toLowerCase().includes("code"));

router.get(
  "/me",
  requireWorkerAccount,
  requireWorkerRole,
  async (request, response, next) => {
    try {
      const query = parseInput(historyQuerySchema, request.query);
      const worker = request.worker;
      if (!worker) throw new HttpError(401, "Silakan login terlebih dahulu");

      const where = { workerId: worker.id };
      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          include: { room: { select: { name: true } } },
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.booking.count({ where }),
      ]);

      sendSuccess(response, 200, "OK", {
        items: bookings.map((booking) => {
          const date = formatDateOnlyUTC(booking.date);
          return {
            id: booking.id,
            code: booking.code,
            roomName: booking.room.name,
            date,
            hari: formatIndonesianWeekday(date),
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: getBookingStatus(
              date,
              booking.startTime,
              booking.endTime,
            ),
            description: booking.description,
          };
        }),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/", requireWorkerAccount, async (request, response, next) => {
  try {
    const query = parseInput(calendarQuerySchema, request.query);
    const dateErrors: Record<string, string[]> = {};
    if (!isDateOnly(query.from)) {
      dateErrors["from"] = ["Tanggal harus berformat YYYY-MM-DD dan valid"];
    }
    if (!isDateOnly(query.to)) {
      dateErrors["to"] = ["Tanggal harus berformat YYYY-MM-DD dan valid"];
    }
    if (Object.keys(dateErrors).length > 0) {
      throw new HttpError(422, "Validasi gagal", dateErrors);
    }
    if (query.from > query.to) {
      throw new HttpError(422, "Validasi gagal", {
        to: ["Tanggal akhir harus sama atau setelah tanggal awal"],
      });
    }
    const from = parseDateOnlyUTC(query.from)!;
    const to = parseDateOnlyUTC(query.to)!;
    const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (spanDays + 1 > 31) {
      throw new HttpError(422, "Rentang tanggal maksimal 31 hari");
    }
    const worker = request.worker;
    if (!worker) throw new HttpError(401, "Silakan login terlebih dahulu");

    const room = await prisma.room.findUnique({
      where: { id: query.roomId },
      select: { id: true },
    });
    if (!room) throw new HttpError(404, "Ruangan tidak ditemukan");

    const bookings = await prisma.booking.findMany({
      where: {
        roomId: room.id,
        date: { gte: from, lte: to },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        roomId: true,
        date: true,
        startTime: true,
        endTime: true,
        name: true,
        workerId: true,
      },
    });
    sendSuccess(
      response,
      200,
      "OK",
      bookings.map((booking) => ({
        id: booking.id,
        roomId: booking.roomId,
        date: formatDateOnlyUTC(booking.date),
        startTime: booking.startTime,
        endTime: booking.endTime,
        bookedBy: booking.name,
        isMine: booking.workerId === worker.id,
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requireWorkerAccount,
  requireWorkerRole,
  async (request, response, next) => {
    try {
      const input = parseInput(bookingBodySchema, request.body);
      if (!isDateOnly(input.date)) {
        throw new HttpError(422, "Validasi gagal", {
          date: ["Tanggal harus berformat YYYY-MM-DD dan valid"],
        });
      }
      if (input.date < getJakartaToday()) {
        throw new HttpError(422, "Tanggal tidak boleh sebelum hari ini", {
          date: ["Tanggal tidak boleh sebelum hari ini"],
        });
      }
      const worker = request.worker;
      if (!worker) throw new HttpError(401, "Silakan login terlebih dahulu");

      const room = await prisma.room.findUnique({
        where: { id: input.roomId },
        include: { slots: { orderBy: { startTime: "asc" } } },
      });
      if (!room) throw new HttpError(404, "Ruangan tidak ditemukan");
      if (input.participants > room.capacity) {
        throw new HttpError(
          409,
          `Jumlah peserta (${input.participants}) melebihi kapasitas ruangan (${room.capacity})`,
        );
      }

      const startingSlot = await prisma.slot.findUnique({
        where: { id: input.slotId },
      });
      if (!startingSlot) throw new HttpError(404, "Slot tidak ditemukan");
      if (startingSlot.roomId !== room.id) {
        throw new HttpError(422, "Slot tidak termasuk dalam ruangan yang dipilih", {
          slotId: ["Slot harus dimiliki oleh roomId yang sama"],
        });
      }
      if (
        input.date === getJakartaToday() &&
        startingSlot.startTime <= getJakartaTime()
      ) {
        throw new HttpError(422, "Jam mulai booking sudah lewat", {
          slotId: ["Slot mulai belum lewat bila tanggal booking hari ini"],
        });
      }

      const startHour = Number(startingSlot.startTime.slice(0, 2));
      const endHour = startHour + input.durationMinutes / 60;
      const endTime = `${String(endHour).padStart(2, "0")}:00`;
      if (
        startingSlot.startTime < room.openTime ||
        endTime > room.closeTime ||
        endHour > 23
      ) {
        throw new HttpError(409, "Durasi melebihi jam operasional ruangan");
      }
      const coveredRanges = buildHourlyRanges(startingSlot.startTime, endTime);
      if (coveredRanges.length !== input.durationMinutes / 60) {
        throw new HttpError(409, "Rentang waktu booking tidak tersedia");
      }
      const slotByStart = new Map(
        room.slots.map((slot) => [slot.startTime, slot]),
      );
      const coveredSlots = coveredRanges.map((range) => {
        const slot = slotByStart.get(range.startTime);
        return slot?.endTime === range.endTime ? slot : undefined;
      });
      if (coveredSlots.some((slot) => !slot)) {
        throw new HttpError(409, "Rentang waktu booking tidak tersedia");
      }

      const date = parseDateOnlyUTC(input.date)!;
      let createdBooking = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = `BK-${randomBytes(3).toString("hex").toUpperCase()}`;
        try {
          createdBooking = await prisma.$transaction((transaction) =>
            transaction.booking.create({
              data: {
                code,
                roomId: room.id,
                slotId: startingSlot.id,
                workerId: worker.id,
                date,
                startTime: startingSlot.startTime,
                endTime,
                durationMinutes: input.durationMinutes,
                participants: input.participants,
                description: input.description ?? null,
                name: worker.name,
                email: worker.email,
                phone: worker.phone,
                bookingSlots: {
                  create: coveredSlots.map((slot) => ({
                    slotId: slot!.id,
                    date,
                  })),
                },
              },
            }),
          );
          break;
        } catch (error) {
          if (isCodeUniqueViolation(error) && attempt < 4) continue;
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            throw new HttpError(
              409,
              "Salah satu slot pada rentang waktu tersebut sudah dipesan",
            );
          }
          throw error;
        }
      }
      if (!createdBooking) {
        throw new HttpError(409, "Kode booking tidak dapat dibuat. Silakan coba lagi.");
      }

      sendSuccess(response, 201, "Booking berhasil dibuat", {
        id: createdBooking.id,
        code: createdBooking.code,
        roomId: createdBooking.roomId,
        date: formatDateOnlyUTC(createdBooking.date),
        startTime: createdBooking.startTime,
        endTime: createdBooking.endTime,
        durationMinutes: createdBooking.durationMinutes,
        participants: createdBooking.participants,
        description: createdBooking.description,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
