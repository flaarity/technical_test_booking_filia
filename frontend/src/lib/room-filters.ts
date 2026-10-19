export const ROOM_FACILITIES = [
  "Proyektor",
  "Whiteboard",
  "TV/Monitor",
  "AC",
  "Wi-Fi",
  "Internet",
] as const;

export type CapacityFilter = "" | "1-3" | "4-6" | "7-10" | "11+";
export type RoomSort = "name" | "capacity-asc" | "capacity-desc";
export type RoomAvailability = "all" | "available";

export type RoomFilters = {
  date: string;
  start: string;
  end: string;
  capacity: CapacityFilter;
  facilities: string[];
  availability: RoomAvailability;
  building: string;
  floor: string;
  search: string;
  sort: RoomSort;
  type: string;
};

export type Room = {
  id: number | string;
  name: string;
  type: string;
  capacity: number;
  building: string | null;
  floor: number | string | null;
  location: string;
  facilities: string[] | null;
  image: string | null;
  notes: string | null;
  openTime: string;
  closeTime: string;
  isAvailable?: boolean;
};

export function getJakartaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createDefaultRoomFilters(today = getJakartaDate()): RoomFilters {
  return {
    date: today,
    start: "",
    end: "",
    capacity: "",
    facilities: [],
    availability: "all",
    building: "",
    floor: "",
    search: "",
    sort: "name",
    type: "",
  };
}

export function parseRoomFilters(
  params: URLSearchParams,
  today = getJakartaDate(),
): RoomFilters {
  const date = isValidDate(params.get("date") ?? "") &&
    (params.get("date") ?? "") >= today
    ? (params.get("date") ?? "")
    : today;
  const rawStart = params.get("start") ?? "";
  const rawEnd = params.get("end") ?? "";
  const validDuration =
    isExactHour(rawStart) && isExactHour(rawEnd) && timeToMinutes(rawEnd) > timeToMinutes(rawStart);
  const capacity = params.get("capacity") ?? "";
  const sort = params.get("sort") ?? "name";
  const availability = params.get("availability") ?? "all";
  const facilities = [...new Set(params.getAll("facility"))].filter((value) =>
    ROOM_FACILITIES.includes(value as (typeof ROOM_FACILITIES)[number]),
  );

  return {
    date,
    start: validDuration ? rawStart : "",
    end: validDuration ? rawEnd : "",
    capacity: isCapacityFilter(capacity) ? capacity : "",
    facilities,
    availability:
      validDuration && availability === "available" ? "available" : "all",
    building: params.get("building") ?? "",
    floor: params.get("floor") ?? "",
    search: params.get("q") ?? "",
    sort: isRoomSort(sort) ? sort : "name",
    type: params.get("type") ?? "",
  };
}

export function serializeRoomFilters(filters: RoomFilters) {
  const params = new URLSearchParams();
  params.set("date", filters.date);
  params.set("start", filters.start);
  params.set("end", filters.end);
  params.set("capacity", filters.capacity);
  for (const facility of [...filters.facilities].sort()) {
    params.append("facility", facility);
  }
  params.set("availability", filters.availability);
  params.set("building", filters.building);
  params.set("floor", filters.floor);
  params.set("q", filters.search);
  params.set("sort", filters.sort);
  params.set("type", filters.type);
  return params.toString();
}

export function capacityMinimum(filter: CapacityFilter) {
  switch (filter) {
    case "1-3":
      return 3;
    case "4-6":
      return 6;
    case "7-10":
      return 10;
    case "11+":
      return 11;
    default:
      return 0;
  }
}

export function hasAllFacilities(
  roomFacilities: readonly string[] | null | undefined,
  selectedFacilities: readonly string[],
) {
  const available = new Set((roomFacilities ?? []).map(normalize));
  return selectedFacilities.every((facility) => available.has(normalize(facility)));
}

export function buildHourOptions(rooms: readonly Room[]) {
  if (!rooms.length) return { starts: [] as string[], ends: [] as string[] };
  const opening = Math.min(...rooms.map((room) => timeToMinutes(room.openTime)));
  const closing = Math.max(...rooms.map((room) => timeToMinutes(room.closeTime)));
  const firstStart = Math.ceil(opening / 60) * 60;
  const lastEnd = Math.floor(closing / 60) * 60;
  const starts: string[] = [];
  const ends: string[] = [];

  for (let minute = firstStart; minute < lastEnd; minute += 60) {
    starts.push(minutesToTime(minute));
  }
  for (let minute = firstStart + 60; minute <= lastEnd; minute += 60) {
    ends.push(minutesToTime(minute));
  }
  return { starts, ends };
}

export function getEndOptions(start: string, endOptions: readonly string[]) {
  if (!start) return [...endOptions];
  const startMinute = timeToMinutes(start);
  return endOptions.filter((end) => timeToMinutes(end) > startMinute);
}

export function formatDurationLabel(start: string, end: string) {
  return start && end ? `${start} - ${end}` : "Pilih durasi";
}

export function filterRooms(rooms: readonly Room[], filters: RoomFilters) {
  const minimumCapacity = capacityMinimum(filters.capacity);
  const filtered = rooms.filter((room) => {
    if (room.capacity < minimumCapacity) return false;
    if (!hasAllFacilities(room.facilities, filters.facilities)) return false;
    if (filters.building && room.building !== filters.building) return false;
    if (filters.floor && String(room.floor) !== filters.floor) return false;
    if (
      filters.search &&
      !room.name.toLocaleLowerCase("id-ID").includes(filters.search.toLocaleLowerCase("id-ID"))
    ) {
      return false;
    }
    if (filters.type && room.type.toLowerCase() !== filters.type.toLowerCase()) {
      return false;
    }
    if (filters.availability === "available" && room.isAvailable !== true) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "capacity-asc") {
      return a.capacity - b.capacity || a.name.localeCompare(b.name, "id-ID");
    }
    if (filters.sort === "capacity-desc") {
      return b.capacity - a.capacity || a.name.localeCompare(b.name, "id-ID");
    }
    return a.name.localeCompare(b.name, "id-ID");
  });
}

export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isExactHour(value: string) {
  return /^([01]\d|2[0-3]):00$/.test(value);
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

function isCapacityFilter(value: string): value is CapacityFilter {
  return value === "" || value === "1-3" || value === "4-6" || value === "7-10" || value === "11+";
}

function isRoomSort(value: string): value is RoomSort {
  return value === "name" || value === "capacity-asc" || value === "capacity-desc";
}
