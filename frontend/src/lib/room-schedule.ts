import {
  getJakartaDate,
  isExactHour,
  minutesToTime,
  timeToMinutes,
} from "./room-filters";

export type RoomBooking = {
  id: number | string;
  roomId: number | string;
  date: string;
  startTime: string;
  endTime: string;
  bookedBy: string;
  isMine: boolean;
};

export type DateRange = {
  from: string;
  to: string;
};

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

export type BookingBlockPosition = {
  top: number;
  height: number;
  rowStart: number;
  rowSpan: number;
};

export function parseISODate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    return null;
  }
  return result;
}

export function formatISODate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addCalendarDays(date: string, days: number) {
  const parsed = parseISODate(date);
  if (!parsed) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatISODate(parsed);
}

export function getMonthRange(year: number, monthIndex: number): DateRange {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { from: formatISODate(first), to: formatISODate(last) };
}

export function getTimelineRange(startDate: string, visibleDays = 5): DateRange {
  const days = Math.max(1, Math.min(visibleDays, 31));
  return { from: startDate, to: addCalendarDays(startDate, days - 1) };
}

export function getMonthGrid(year: number, monthIndex: number): CalendarDay[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart);
    current.setUTCDate(gridStart.getUTCDate() + index);
    return {
      date: formatISODate(current),
      day: current.getUTCDate(),
      inMonth: current.getUTCMonth() === monthIndex,
    };
  });
}

export function buildHourRows(openTime: string, closeTime: string) {
  if (!isExactHour(openTime) || !isExactHour(closeTime)) return [];
  const opening = timeToMinutes(openTime);
  const closing = timeToMinutes(closeTime);
  if (closing <= opening) return [];
  return Array.from({ length: (closing - opening) / 60 }, (_, index) => {
    const hour = Math.floor((opening + index * 60) / 60);
    return `${String(hour).padStart(2, "0")}:00`;
  });
}

export function getBookingBlockPosition(
  booking: Pick<RoomBooking, "startTime" | "endTime">,
  openTime: string,
  rowHeight = 64,
): BookingBlockPosition | null {
  const start = timeToMinutes(booking.startTime);
  const end = timeToMinutes(booking.endTime);
  const opening = timeToMinutes(openTime);
  if (end <= start || start < opening) return null;
  const offset = start - opening;
  const duration = end - start;
  return {
    top: (offset / 60) * rowHeight,
    height: (duration / 60) * rowHeight,
    rowStart: Math.floor(offset / 60) + 1,
    rowSpan: Math.ceil(duration / 60),
  };
}

export function getJakartaClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hour, minute, minutes: hour * 60 + minute };
}

export function isCellDisabled(
  date: string,
  time: string,
  openTime: string,
  closeTime: string,
  now = new Date(),
) {
  const today = getJakartaDate(now);
  if (date < today) return true;
  const start = timeToMinutes(time);
  const opening = timeToMinutes(openTime);
  const closing = timeToMinutes(closeTime);
  if (start < opening || start + 60 > closing) return true;
  if (date === today && start <= getJakartaClock(now).minutes) return true;
  return false;
}

export function validateBookingRange(
  date: string,
  startTime: string,
  endTime: string,
  openTime: string,
  closeTime: string,
  bookings: readonly RoomBooking[],
  now = new Date(),
) {
  if (!parseISODate(date)) return { valid: false, reason: "Tanggal tidak valid." };
  if (!isExactHour(startTime) || !isExactHour(endTime)) {
    return { valid: false, reason: "Waktu harus pada jam tepat." };
  }
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end - start < 60) {
    return { valid: false, reason: "Durasi minimal satu jam." };
  }
  if (
    start < timeToMinutes(openTime) ||
    end > timeToMinutes(closeTime) ||
    end <= start
  ) {
    return { valid: false, reason: "Waktu berada di luar jam operasional." };
  }
  if (date < getJakartaDate(now)) {
    return { valid: false, reason: "Tanggal sudah lewat." };
  }
  if (isCellDisabled(date, startTime, openTime, closeTime, now)) {
    return { valid: false, reason: "Jam mulai sudah lewat atau tidak tersedia." };
  }

  const conflict = bookings.find(
    (booking) =>
      booking.date === date &&
      start < timeToMinutes(booking.endTime) &&
      end > timeToMinutes(booking.startTime),
  );
  if (conflict) {
    return {
      valid: false,
      reason: `Waktu bertabrakan dengan booking ${conflict.startTime}-${conflict.endTime}.`,
      conflict,
    };
  }
  return { valid: true, reason: "" };
}

export function getFreeStartTimes(
  date: string,
  openTime: string,
  closeTime: string,
  bookings: readonly RoomBooking[],
  now = new Date(),
) {
  return buildHourRows(openTime, closeTime).filter(
    (time) =>
      !isCellDisabled(date, time, openTime, closeTime, now) &&
      validateBookingRange(
        date,
        time,
        minutesToTime(timeToMinutes(time) + 60),
        openTime,
        closeTime,
        bookings,
        now,
      ).valid,
  );
}

export function getFreeEndTimes(
  date: string,
  startTime: string,
  openTime: string,
  closeTime: string,
  bookings: readonly RoomBooking[],
  now = new Date(),
) {
  const start = timeToMinutes(startTime);
  const close = timeToMinutes(closeTime);
  const endings: string[] = [];
  for (let end = start + 60; end <= close; end += 60) {
    const endTime = minutesToTime(end);
    if (
      validateBookingRange(
        date,
        startTime,
        endTime,
        openTime,
        closeTime,
        bookings,
        now,
      ).valid
    ) {
      endings.push(endTime);
    } else {
      break;
    }
  }
  return endings;
}

export function twoClickSelection(
  firstClick: number | null,
  clickedIndex: number,
) {
  if (firstClick === null) {
    return { startIndex: clickedIndex, endIndex: clickedIndex + 1, awaitingSecond: true };
  }
  const low = Math.min(firstClick, clickedIndex);
  const high = Math.max(firstClick, clickedIndex);
  return { startIndex: low, endIndex: high + 1, awaitingSecond: false };
}

export function formatLongJakartaDate(date: string) {
  const parsed = parseISODate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function getMonthKey(date: string) {
  return date.slice(0, 7);
}
