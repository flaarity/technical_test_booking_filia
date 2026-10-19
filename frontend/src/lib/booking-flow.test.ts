import { describe, expect, it } from "vitest";
import {
  findAvailableStartingSlot,
  formatBookingDate,
  formatBookingWeekday,
  getDurationMinutes,
  getHistoryRowNumber,
  mapApiFieldErrors,
  validateBookingForm,
  type BookingSlot,
} from "./booking-flow";

const slots: BookingSlot[] = [
  { id: 5, startTime: "09:00", endTime: "10:00", isAvailable: false },
  { id: 6, startTime: "10:00", endTime: "11:00", isAvailable: true },
];

describe("booking flow helpers", () => {
  it("calculates duration only for increasing time ranges", () => {
    expect(getDurationMinutes("09:00", "11:00")).toBe(120);
    expect(getDurationMinutes("11:00", "09:00")).toBe(0);
  });

  it("finds the available slot matching the booking start time", () => {
    expect(findAvailableStartingSlot(slots, "10:00")?.id).toBe(6);
    expect(findAvailableStartingSlot(slots, "09:00")).toBeUndefined();
    expect(findAvailableStartingSlot(slots, "12:00")).toBeUndefined();
  });

  it("validates participants and description length", () => {
    expect(validateBookingForm({ participants: "1", description: "" }, 8)).toEqual({});
    expect(
      validateBookingForm({ participants: "1.5", description: "" }, 8)
        .participants,
    ).toBeTruthy();
    expect(
      validateBookingForm({ participants: "9", description: "" }, 8)
        .participants,
    ).toContain("8");
    expect(
      validateBookingForm(
        { participants: "2", description: "x".repeat(201) },
        8,
      ).description,
    ).toContain("200");
  });

  it("formats pure date strings in Indonesian without timezone shifts", () => {
    expect(formatBookingDate("2026-10-20")).toBe("20/10/2026");
    expect(formatBookingWeekday("2026-10-20")).toBe("Selasa");
    expect(formatBookingDate("2026-02-30")).toBe("2026-02-30");
  });

  it("continues row numbering across pages", () => {
    expect(getHistoryRowNumber(1, 10, 0)).toBe(1);
    expect(getHistoryRowNumber(2, 10, 0)).toBe(11);
  });

  it("maps backend field errors to booking form fields", () => {
    expect(
      mapApiFieldErrors({
        participants: ["Maksimal 8 orang"],
        description: "Keterangan tidak valid",
        date: ["Tidak dipetakan"],
      }),
    ).toEqual({
      participants: "Maksimal 8 orang",
      description: "Keterangan tidak valid",
    });
  });
});
