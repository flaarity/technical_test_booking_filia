import { Router } from "express";
import { z } from "zod";
import { requireWorkerAccount } from "../middleware/auth.js";
import {
  formatDateOnlyUTC,
  isDateOnly,
  parseDateOnlyUTC,
} from "../lib/booking-time.js";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { sendSuccess } from "../lib/responses.js";
import { parseInput } from "../lib/validation.js";

const router = Router();
const querySchema = z.object({
  roomId: z.coerce.number().int().positive(),
  date: z.string().optional(),
});

router.get("/", requireWorkerAccount, async (request, response, next) => {
  try {
    const query = parseInput(querySchema, request.query);
    if (query.date !== undefined && !isDateOnly(query.date)) {
      throw new HttpError(422, "Validasi gagal", {
        date: ["Tanggal harus berformat YYYY-MM-DD dan valid"],
      });
    }

    const room = await prisma.room.findUnique({
      where: { id: query.roomId },
      select: { id: true, openTime: true, closeTime: true },
    });
    if (!room) throw new HttpError(404, "Ruangan tidak ditemukan");

    const slots = await prisma.slot.findMany({
      where: {
        roomId: room.id,
        startTime: { gte: room.openTime },
        endTime: { lte: room.closeTime },
      },
      orderBy: { startTime: "asc" },
    });
    const bookedSlotIds =
      query.date === undefined
        ? new Set<number>()
        : new Set(
            (
              await prisma.bookingSlot.findMany({
                where: {
                  date: parseDateOnlyUTC(query.date)!,
                  slotId: { in: slots.map((slot) => slot.id) },
                },
                select: { slotId: true },
              })
            ).map((bookingSlot) => bookingSlot.slotId),
          );

    sendSuccess(
      response,
      200,
      "OK",
      slots.map((slot) => ({
        id: slot.id,
        roomId: slot.roomId,
        time: `${slot.startTime}-${slot.endTime}`,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: !bookedSlotIds.has(slot.id),
      })),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
