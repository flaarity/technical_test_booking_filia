import { describe, expect, it } from "vitest";
import {
  addFacilityTags,
  buildRoomLocation,
  buildRoomMutationPayload,
  createDefaultRoomForm,
  getRoomCloseTimeOptions,
  getRoomOpenTimeOptions,
  mapRoomApiErrors,
  removeFacilityTag,
  roomToFormState,
  validateRoomForm,
} from "./admin-room-form";

describe("admin room form helpers", () => {
  it("validates onsite and online room fields", () => {
    const onsite = createDefaultRoomForm();
    const defaults = validateRoomForm(onsite);
    expect(defaults.name).toBeTruthy();
    expect(defaults.building).toBeTruthy();
    expect(defaults.floor).toBeTruthy();
    expect(defaults.capacity).toBeTruthy();
    onsite.name = "Ruang Alpha";
    onsite.building = "Gedung A";
    onsite.floor = "2";
    onsite.capacity = "8";
    expect(validateRoomForm(onsite)).toEqual({});

    const online = {
      ...onsite,
      type: "ONLINE" as const,
      building: "",
      floor: "",
    };
    expect(validateRoomForm(online)).toEqual({});
  });

  it("rejects invalid capacities, onsite location fields, hours, URLs, and notes", () => {
    const form = {
      ...createDefaultRoomForm(),
      name: "A",
      building: "G".repeat(51),
      floor: "1.5",
      capacity: "501",
      openTime: "08:30",
      closeTime: "08:00",
      image: "ftp://invalid.example/image.jpg",
      notes: "x".repeat(201),
    };
    const errors = validateRoomForm(form);
    expect(errors.name).toBeTruthy();
    expect(errors.building).toBeTruthy();
    expect(errors.floor).toBeTruthy();
    expect(errors.capacity).toBeTruthy();
    expect(errors.openTime).toBeTruthy();
    expect(errors.closeTime).toBeTruthy();
    expect(errors.image).toBeTruthy();
    expect(errors.notes).toBeTruthy();
  });

  it("formats locations and creates whole-hour options bounded by backend validation", () => {
    expect(buildRoomLocation("ONSITE", " Gedung A ", "2")).toBe("Lantai 2 Gedung A");
    expect(buildRoomLocation("ONLINE", "", "")).toBe("Online");
    expect(getRoomOpenTimeOptions()).toHaveLength(24);
    expect(getRoomOpenTimeOptions()).toContain("23:00");
    expect(getRoomCloseTimeOptions("21:00")).toEqual(["22:00", "23:00"]);
    expect(getRoomCloseTimeOptions("23:00")).toEqual([]);
  });

  it("builds the exact room mutation payload without location or id", () => {
    const form = {
      ...createDefaultRoomForm(),
      name: "  Ruang Alpha  ",
      building: " Gedung A ",
      floor: "2",
      capacity: "8",
      facilities: [" Wi-Fi ", "AC"],
      image: "",
      notes: "  ",
    };
    expect(buildRoomMutationPayload(form)).toEqual({
      name: "Ruang Alpha",
      type: "ONSITE",
      building: "Gedung A",
      floor: 2,
      capacity: 8,
      openTime: "08:00",
      closeTime: "21:00",
      facilities: ["Wi-Fi", "AC"],
      image: null,
      notes: null,
    });
  });

  it("sends online rooms with null building and floor and trimmed nullable fields", () => {
    const form = {
      ...createDefaultRoomForm(),
      name: "Ruang Online",
      type: "ONLINE" as const,
      capacity: "10",
      image: " https://example.com/room.png ",
      notes: " Catatan ",
    };
    expect(buildRoomMutationPayload(form)).toEqual({
      name: "Ruang Online",
      type: "ONLINE",
      building: null,
      floor: null,
      capacity: 10,
      openTime: "08:00",
      closeTime: "21:00",
      facilities: [],
      image: "https://example.com/room.png",
      notes: "Catatan",
    });
  });

  it("maps room data into editable form state", () => {
    const form = roomToFormState({
      id: 4,
      name: "Ruang Online",
      type: "ONLINE",
      capacity: 12,
      building: null,
      floor: null,
      location: "Online",
      facilities: ["Teams"],
      image: null,
      notes: null,
      openTime: "09:00",
      closeTime: "18:00",
    });
    expect(form.type).toBe("ONLINE");
    expect(form.facilities).toEqual(["Teams"]);
    expect(form.closeTime).toBe("18:00");
  });

  it("adds comma-separated tags without duplicates and removes case-insensitively", () => {
    expect(addFacilityTags(["Wi-Fi"], "wi-fi, Proyektor, AC")).toEqual([
      "Wi-Fi",
      "Proyektor",
      "AC",
    ]);
    expect(removeFacilityTag(["Wi-Fi", "AC"], "ac")).toEqual(["Wi-Fi"]);
    expect(addFacilityTags([], "x".repeat(31))).toEqual([]);
  });

  it("maps backend validation fields to form fields", () => {
    expect(
      mapRoomApiErrors({
        closeTime: ["Jam tutup tidak valid"],
        facilities: ["Fasilitas tidak valid"],
        image: "URL tidak valid",
        unknown: ["diabaikan"],
      }),
    ).toEqual({
      closeTime: "Jam tutup tidak valid",
      facilityDraft: "Fasilitas tidak valid",
      image: "URL tidak valid",
    });
  });
});
