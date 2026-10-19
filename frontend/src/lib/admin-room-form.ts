import type { Room } from "./room-filters";

export type RoomFormState = {
  name: string;
  type: "ONSITE" | "ONLINE";
  building: string;
  floor: string;
  capacity: string;
  openTime: string;
  closeTime: string;
  facilities: string[];
  facilityDraft: string;
  image: string;
  notes: string;
};

export type RoomFormErrors = Partial<Record<keyof RoomFormState, string>>;

export type RoomMutationPayload = {
  name: string;
  type: "ONSITE" | "ONLINE";
  building: string | null;
  floor: number | null;
  capacity: number;
  openTime: string;
  closeTime: string;
  facilities: string[];
  image: string | null;
  notes: string | null;
};

export const FACILITY_SUGGESTIONS = [
  "Wi-Fi",
  "Internet",
  "Proyektor",
  "Whiteboard",
  "TV/Monitor",
  "AC",
] as const;

export function createDefaultRoomForm(): RoomFormState {
  return {
    name: "",
    type: "ONSITE",
    building: "",
    floor: "",
    capacity: "",
    openTime: "08:00",
    closeTime: "21:00",
    facilities: [],
    facilityDraft: "",
    image: "",
    notes: "",
  };
}

export function buildRoomLocation(
  type: RoomFormState["type"],
  building: string,
  floor: string,
) {
  if (type === "ONLINE") return "Online";
  const trimmedBuilding = building.trim();
  const trimmedFloor = floor.trim();
  return trimmedBuilding && trimmedFloor
    ? `Lantai ${trimmedFloor} ${trimmedBuilding}`
    : "";
}

export function getRoomOpenTimeOptions() {
  return Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
}

export function getRoomCloseTimeOptions(openTime: string) {
  return getRoomOpenTimeOptions().filter((time) => time > openTime);
}

export function validateRoomForm(form: RoomFormState): RoomFormErrors {
  const errors: RoomFormErrors = {};
  const name = form.name.trim();
  const capacity = Number(form.capacity);

  if (name.length < 2 || name.length > 100) {
    errors.name = "Nama ruangan wajib 2 sampai 100 karakter.";
  }
  if (form.type !== "ONSITE" && form.type !== "ONLINE") {
    errors.type = "Pilih tipe ruangan yang valid.";
  }
  if (form.type === "ONSITE") {
    if (!form.building.trim()) {
      errors.building = "Gedung wajib diisi untuk ruangan onsite.";
    } else if (form.building.trim().length > 50) {
      errors.building = "Nama gedung maksimal 50 karakter.";
    }
    const floor = Number(form.floor);
    if (!form.floor.trim() || !Number.isInteger(floor) || floor < 0 || floor > 100) {
      errors.floor = "Lantai wajib berupa bilangan bulat 0 sampai 100.";
    }
  }
  if (!form.capacity.trim() || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    errors.capacity = "Kapasitas wajib berupa bilangan bulat 1 sampai 500.";
  }
  if (!/^([01]\d|2[0-3]):00$/.test(form.openTime)) {
    errors.openTime = "Jam buka harus pada jam tepat.";
  }
  if (!/^([01]\d|2[0-3]):00$/.test(form.closeTime)) {
    errors.closeTime = "Jam tutup harus pada jam tepat.";
  } else if (form.closeTime <= form.openTime) {
    errors.closeTime = "Jam tutup harus lebih besar dari jam buka.";
  }
  if (form.facilities.some((facility) => !facility.trim() || facility.trim().length > 30)) {
    errors.facilityDraft = "Fasilitas harus berisi 1 sampai 30 karakter.";
  } else if (form.facilityDraft.trim()) {
    errors.facilityDraft = "Tekan Enter atau koma untuk menambahkan fasilitas.";
  }
  const image = form.image.trim();
  if (image && (image.length > 255 || !isHttpUrl(image))) {
    errors.image = "Masukkan URL gambar http atau https yang valid (maksimal 255 karakter).";
  }
  if (form.notes.length > 200) {
    errors.notes = "Catatan khusus maksimal 200 karakter.";
  }
  return errors;
}

export function buildRoomMutationPayload(form: RoomFormState): RoomMutationPayload {
  const onsite = form.type === "ONSITE";
  return {
    name: form.name.trim(),
    type: form.type,
    building: onsite ? form.building.trim() : null,
    floor: onsite ? Number(form.floor) : null,
    capacity: Number(form.capacity),
    openTime: form.openTime,
    closeTime: form.closeTime,
    facilities: form.facilities.map((facility) => facility.trim()).filter(Boolean),
    image: form.image.trim() || null,
    notes: form.notes.trim() || null,
  };
}

export function roomToFormState(room: Room): RoomFormState {
  return {
    name: room.name,
    type: room.type.toUpperCase() === "ONLINE" ? "ONLINE" : "ONSITE",
    building: room.building ?? "",
    floor: room.floor === null || room.floor === undefined ? "" : String(room.floor),
    capacity: String(room.capacity),
    openTime: room.openTime,
    closeTime: room.closeTime,
    facilities: [...(room.facilities ?? [])],
    facilityDraft: "",
    image: room.image ?? "",
    notes: room.notes ?? "",
  };
}

export function addFacilityTags(facilities: readonly string[], value: string) {
  const next = [...facilities];
  for (const raw of value.split(",")) {
    const tag = raw.trim();
    if (!tag || tag.length > 30) continue;
    if (!next.some((existing) => normalize(existing) === normalize(tag))) {
      next.push(tag);
    }
  }
  return next;
}

export function removeFacilityTag(facilities: readonly string[], tag: string) {
  return facilities.filter((facility) => normalize(facility) !== normalize(tag));
}

export function mapRoomApiErrors(
  errors: Record<string, string | string[]>,
): RoomFormErrors {
  const mapping: Record<string, keyof RoomFormState> = {
    name: "name",
    type: "type",
    building: "building",
    floor: "floor",
    capacity: "capacity",
    openTime: "openTime",
    closeTime: "closeTime",
    facilities: "facilityDraft",
    image: "image",
    notes: "notes",
  };
  const result: RoomFormErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    const field = mapping[key];
    if (field) result[field] = Array.isArray(value) ? value.join(" ") : value;
  }
  return result;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
