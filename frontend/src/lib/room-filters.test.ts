import { describe, expect, it } from "vitest";
import {
  buildHourOptions,
  capacityMinimum,
  createDefaultRoomFilters,
  filterRooms,
  formatDurationLabel,
  getEndOptions,
  hasAllFacilities,
  parseRoomFilters,
  serializeRoomFilters,
  type Room,
} from "./room-filters";

const rooms: Room[] = [
  {
    id: 1,
    name: "Ruang Beta",
    type: "ONSITE",
    capacity: 8,
    building: "Gedung A",
    floor: 2,
    location: "Lantai 2 Gedung A",
    facilities: ["Wi-Fi", "AC", "Proyektor"],
    image: null,
    notes: null,
    openTime: "09:00",
    closeTime: "20:00",
    isAvailable: true,
  },
  {
    id: 2,
    name: "Ruang Alpha",
    type: "ONSITE",
    capacity: 12,
    building: "Gedung B",
    floor: 1,
    location: "Lantai 1 Gedung B",
    facilities: ["Wi-Fi", "TV/Monitor"],
    image: null,
    notes: null,
    openTime: "08:00",
    closeTime: "21:00",
    isAvailable: false,
  },
];

describe("room filtering helpers", () => {
  it.each([
    ["1-3", 3],
    ["4-6", 6],
    ["7-10", 10],
    ["11+", 11],
    ["", 0],
  ] as const)("uses the upper bound for capacity %s", (filter, expected) => {
    expect(capacityMinimum(filter)).toBe(expected);
  });

  it("requires every selected facility", () => {
    expect(hasAllFacilities(["Wi-Fi", "AC"], ["Wi-Fi", "AC"])).toBe(true);
    expect(hasAllFacilities(["Wi-Fi"], ["Wi-Fi", "AC"])).toBe(false);
  });

  it("builds exact-hour options from the earliest opening and latest closing", () => {
    expect(buildHourOptions(rooms)).toEqual({
      starts: Array.from({ length: 13 }, (_, index) => `${String(index + 8).padStart(2, "0")}:00`),
      ends: Array.from({ length: 13 }, (_, index) => `${String(index + 9).padStart(2, "0")}:00`),
    });
  });

  it("restricts end choices to at least one hour after start", () => {
    expect(getEndOptions("10:00", ["09:00", "10:00", "11:00"])).toEqual(["11:00"]);
  });

  it("formats and clears an empty duration label", () => {
    expect(formatDurationLabel("09:00", "12:00")).toBe("09:00 - 12:00");
    expect(formatDurationLabel("", "")).toBe("Pilih durasi");
  });

  it("serializes and parses URL filters including repeated facilities", () => {
    const filters = {
      ...createDefaultRoomFilters("2026-10-19"),
      start: "09:00",
      end: "11:00",
      capacity: "4-6" as const,
      facilities: ["AC", "Wi-Fi"],
      availability: "available" as const,
      building: "Gedung A",
      floor: "2",
      search: "Alpha Room",
      sort: "capacity-desc" as const,
      type: "online",
    };

    expect(
      parseRoomFilters(
        new URLSearchParams(serializeRoomFilters(filters)),
        "2026-10-19",
      ),
    ).toEqual(filters);
  });

  it("drops invalid or past dates and invalid duration ranges", () => {
    const parsed = parseRoomFilters(
      new URLSearchParams("date=2026-02-30&start=11%3A00&end=10%3A00"),
      "2026-10-19",
    );
    expect(parsed.date).toBe("2026-10-19");
    expect(parsed.start).toBe("");
    expect(parsed.end).toBe("");
  });

  it("does not keep availability filtering without a valid duration", () => {
    const parsed = parseRoomFilters(
      new URLSearchParams("date=2026-10-20&availability=available"),
      "2026-10-19",
    );
    expect(parsed.availability).toBe("all");
  });

  it("combines capacity, facilities, availability, and name sorting", () => {
    const result = filterRooms(rooms, {
      ...createDefaultRoomFilters("2026-10-19"),
      capacity: "4-6",
      facilities: ["Wi-Fi"],
      availability: "available",
    });
    expect(result.map((room) => room.name)).toEqual(["Ruang Beta"]);
  });
});
