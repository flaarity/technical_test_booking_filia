import { timeToMinutes } from "./room-filters";

export type BookingFormValues = {
  participants: string;
  description: string;
};

export type BookingFormErrors = Partial<
  Record<keyof BookingFormValues | "slotId", string>
>;

export type BookingSlot = {
  id: number | string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export function getDurationMinutes(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : 0;
}

export function findAvailableStartingSlot(
  slots: readonly BookingSlot[],
  startTime: string,
) {
  return slots.find(
    (slot) => slot.startTime === startTime && slot.isAvailable,
  );
}

export function validateBookingForm(
  values: BookingFormValues,
  capacity: number,
): BookingFormErrors {
  const errors: BookingFormErrors = {};
  const rawParticipants = values.participants.trim();
  const participants = Number(rawParticipants);
  if (!rawParticipants || !Number.isInteger(participants) || participants < 1) {
    errors.participants = "Masukkan jumlah orang berupa bilangan bulat minimal 1.";
  } else if (participants > capacity) {
    errors.participants = `Maksimal ${capacity} orang untuk ruangan ini.`;
  }
  if (values.description.length > 200) {
    errors.description = "Keterangan maksimal 200 karakter.";
  }
  return errors;
}

export function formatBookingDate(date: string) {
  const parsed = parseDateOnly(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function formatBookingWeekday(date: string) {
  const parsed = parseDateOnly(date);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
  }).format(parsed);
}

export function getHistoryRowNumber(page: number, limit: number, index: number) {
  return Math.max(0, page - 1) * Math.max(0, limit) + index + 1;
}

export function mapApiFieldErrors(
  errors: Record<string, string | string[]>,
): BookingFormErrors {
  const result: BookingFormErrors = {};
  for (const field of ["participants", "description", "slotId"] as const) {
    const message = errors[field];
    if (message) {
      result[field] = Array.isArray(message) ? message.join(" ") : message;
    }
  }
  return result;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}
