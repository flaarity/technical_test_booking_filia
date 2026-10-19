import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  buildHourRows,
  formatISODate,
  getBookingBlockPosition,
  getFreeEndTimes,
  getFreeStartTimes,
  getMonthGrid,
  getMonthRange,
  getTimelineRange,
  isCellDisabled,
  parseISODate,
  twoClickSelection,
  validateBookingRange,
  type RoomBooking,
} from "./room-schedule";

const bookings: RoomBooking[] = [
  {
    id: "b1",
    roomId: 1,
    date: "2026-10-20",
    startTime: "10:00",
    endTime: "12:00",
    bookedBy: "Ayu",
    isMine: false,
  },
];

describe("room schedule helpers", () => {
  it("parses pure calendar dates without local timezone shifts", () => {
    expect(formatISODate(parseISODate("2026-10-19")!)).toBe("2026-10-19");
    expect(parseISODate("2026-02-30")).toBeNull();
  });

  it("creates full month and capped timeline ranges", () => {
    expect(getMonthRange(2026, 9)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(getTimelineRange("2026-10-30", 5)).toEqual({
      from: "2026-10-30",
      to: "2026-11-03",
    });
    expect(getTimelineRange("2026-10-01", 60).to).toBe("2026-10-31");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds a Monday-first six-week calendar grid", () => {
    const grid = getMonthGrid(2026, 9);
    expect(grid).toHaveLength(42);
    expect(grid[0].date).toBe("2026-09-28");
    expect(grid[0].inMonth).toBe(false);
    expect(grid.find((day) => day.date === "2026-10-01")?.inMonth).toBe(true);
  });

  it("builds hourly rows from room operations", () => {
    expect(buildHourRows("08:00", "11:00")).toEqual([
      "08:00",
      "09:00",
      "10:00",
    ]);
    expect(buildHourRows("08:30", "11:00")).toEqual([]);
  });

  it("calculates position and height for a two-hour booking", () => {
    expect(
      getBookingBlockPosition(
        { startTime: "10:00", endTime: "12:00" },
        "08:00",
      ),
    ).toEqual({ top: 128, height: 128, rowStart: 3, rowSpan: 2 });
  });

  it("disables past, elapsed, and out-of-operation cells using an injected instant", () => {
    const now = new Date("2026-10-19T04:30:00.000Z"); // 11:30 in Jakarta
    expect(isCellDisabled("2026-10-18", "12:00", "08:00", "21:00", now)).toBe(true);
    expect(isCellDisabled("2026-10-19", "11:00", "08:00", "21:00", now)).toBe(true);
    expect(isCellDisabled("2026-10-19", "12:00", "08:00", "21:00", now)).toBe(false);
    expect(isCellDisabled("2026-10-19", "20:00", "08:00", "21:00", now)).toBe(false);
  });

  it("validates operating bounds and rejects overlaps", () => {
    expect(
      validateBookingRange(
        "2026-10-20",
        "08:00",
        "10:00",
        "08:00",
        "21:00",
        bookings,
      ).valid,
    ).toBe(true);
    expect(
      validateBookingRange(
        "2026-10-20",
        "11:00",
        "13:00",
        "08:00",
        "21:00",
        bookings,
      ).valid,
    ).toBe(false);
    expect(
      validateBookingRange(
        "2026-10-20",
        "20:00",
        "22:00",
        "08:00",
        "21:00",
        bookings,
      ).valid,
    ).toBe(false);
  });

  it("offers free start times and limits end times at the next booking", () => {
    const now = new Date("2026-10-19T04:30:00.000Z");
    expect(
      getFreeStartTimes(
        "2026-10-20",
        "08:00",
        "13:00",
        bookings,
        now,
      ),
    ).toEqual(["08:00", "09:00", "12:00"]);
    expect(
      getFreeEndTimes(
        "2026-10-20",
        "08:00",
        "08:00",
        "13:00",
        bookings,
        now,
      ),
    ).toEqual(["09:00", "10:00"]);
  });

  it("maps two clicks to an inclusive hourly range", () => {
    expect(twoClickSelection(null, 3)).toEqual({
      startIndex: 3,
      endIndex: 4,
      awaitingSecond: true,
    });
    expect(twoClickSelection(3, 5)).toEqual({
      startIndex: 3,
      endIndex: 6,
      awaitingSecond: false,
    });
    expect(twoClickSelection(5, 3)).toEqual({
      startIndex: 3,
      endIndex: 6,
      awaitingSecond: false,
    });
  });
});
