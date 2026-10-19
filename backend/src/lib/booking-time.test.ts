import { describe, expect, it } from "vitest";
import {
  buildHourlyRanges,
  formatDateOnlyUTC,
  formatIndonesianWeekday,
  formatRoomLocation,
  getBookingStatus,
  getJakartaToday,
  isDateOnly,
  isExactHour,
  parseDateOnlyUTC,
} from "./booking-time.js";

describe("booking time helpers", () => {
  it("validates whole-hour times and builds one-hour ranges", () => {
    expect(isExactHour("09:00")).toBe(true);
    expect(isExactHour("09:30")).toBe(false);
    expect(buildHourlyRanges("09:00", "12:00")).toEqual([
      { startTime: "09:00", endTime: "10:00" },
      { startTime: "10:00", endTime: "11:00" },
      { startTime: "11:00", endTime: "12:00" },
    ]);
    expect(buildHourlyRanges("09:00", "09:00")).toEqual([]);
  });

  it("parses strict date-only values at UTC midnight", () => {
    expect(isDateOnly("2026-02-28")).toBe(true);
    expect(isDateOnly("2026-02-30")).toBe(false);
    expect(formatDateOnlyUTC(parseDateOnlyUTC("2026-10-20")!)).toBe(
      "2026-10-20",
    );
  });

  it("builds display locations from room type", () => {
    expect(formatRoomLocation("ONSITE", "Gedung A", 2)).toBe(
      "Lantai 2 Gedung A",
    );
    expect(formatRoomLocation("ONLINE", null, null)).toBe("Online");
  });

  it("calculates booking status in Asia/Jakarta", () => {
    const now = new Date("2026-10-20T03:30:00.000Z");
    expect(getJakartaToday(now)).toBe("2026-10-20");
    expect(getBookingStatus("2026-10-20", "10:00", "11:00", now)).toBe(
      "Sedang Berlangsung",
    );
    expect(getBookingStatus("2026-10-20", "11:00", "12:00", now)).toBe(
      "Akan Datang",
    );
    expect(
      getBookingStatus("2026-10-20", "09:00", "10:00", now),
    ).toBe("Selesai");
  });

  it("formats weekday names in Indonesian", () => {
    expect(formatIndonesianWeekday("2026-10-19")).toBe("Senin");
  });
});
