export type HourlyRange = {
  startTime: string;
  endTime: string;
};

export type BookingStatus =
  | "Akan Datang"
  | "Sedang Berlangsung"
  | "Selesai";

const hourPattern = /^(?:[01]\d|2[0-3]):00$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const isExactHour = (value: string): boolean =>
  hourPattern.test(value);

export const isDateOnly = (value: string): boolean => {
  if (!datePattern.test(value)) return false;
  const date = parseDateOnlyUTC(value);
  return date !== null && date.toISOString().slice(0, 10) === value;
};

export const parseDateOnlyUTC = (value: string): Date | null => {
  if (!datePattern.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
};

export const formatDateOnlyUTC = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const buildHourlyRanges = (
  startTime: string,
  endTime: string,
): HourlyRange[] => {
  if (!isExactHour(startTime) || !isExactHour(endTime)) return [];
  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  if (endHour <= startHour) return [];

  return Array.from({ length: endHour - startHour }, (_, index) => {
    const hour = startHour + index;
    return {
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(hour + 1).padStart(2, "0")}:00`,
    };
  });
};

export const formatRoomLocation = (
  type: "ONSITE" | "ONLINE",
  building: string | null | undefined,
  floor: number | null | undefined,
): string => {
  if (type === "ONLINE") return "Online";
  if (!building || floor === null || floor === undefined) return "";
  return `Lantai ${floor} ${building}`;
};

const jakartaDateTime = (instant: Date): { date: string; time: string } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    time: `${parts["hour"]}:${parts["minute"]}`,
  };
};

export const getBookingStatus = (
  date: string,
  startTime: string,
  endTime: string,
  now = new Date(),
): BookingStatus => {
  const current = jakartaDateTime(now);
  if (date < current.date) return "Selesai";
  if (date > current.date || current.time < startTime) return "Akan Datang";
  if (current.time >= endTime) return "Selesai";
  return "Sedang Berlangsung";
};

export const getJakartaToday = (now = new Date()): string =>
  jakartaDateTime(now).date;

export const getJakartaTime = (now = new Date()): string =>
  jakartaDateTime(now).time;

export const formatIndonesianWeekday = (date: string): string => {
  const parsedDate = parseDateOnlyUTC(date);
  if (!parsedDate) return "";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "UTC",
  }).format(parsedDate);
};
