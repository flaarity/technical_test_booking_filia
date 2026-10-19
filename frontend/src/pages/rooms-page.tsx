import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DurationDialog } from "../components/duration-dialog";
import { RoomCard } from "../components/room-card";
import { RoomCardSkeleton } from "../components/room-card-skeleton";
import "./rooms-page.css";
import { useWorker } from "../context/use-worker";
import { ApiError, apiRequest } from "../lib/api";
import {
  buildHourOptions,
  createDefaultRoomFilters,
  filterRooms,
  formatDurationLabel,
  getEndOptions,
  getJakartaDate,
  parseRoomFilters,
  ROOM_FACILITIES,
  serializeRoomFilters,
  type Room,
  type RoomFilters,
} from "../lib/room-filters";

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rooms-error-banner" role="alert">
      <span className="error-banner-icon" aria-hidden="true">
        !
      </span>
      <p>{message}</p>
      <button type="button" className="button button-outline" onClick={onRetry}>
        Coba lagi
      </button>
    </div>
  );
}

function DebouncedSearch({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => onCommit(draft.trimStart()), 300);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit]);

  return (
    <label className="filter-control search-control">
      <span>Cari nama ruangan</span>
      <span className="search-input-wrap">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.2 4.2" />
        </svg>
        <input
          type="search"
          value={draft}
          placeholder="Contoh: Ruang Alpha"
          onChange={(event) => setDraft(event.target.value)}
        />
      </span>
    </label>
  );
}

export function RoomsPage() {
  const { getToken } = useAuth();
  const { worker } = useWorker();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseRoomFilters(searchParams),
    [searchParams],
  );
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<Error | null>(null);
  const [retryRooms, setRetryRooms] = useState(0);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [availabilityResponse, setAvailabilityResponse] = useState<{
    key: string;
    rooms: Room[];
  } | null>(null);
  const [availabilityError, setAvailabilityError] = useState<{
    key: string;
    error: Error;
  } | null>(null);
  const [durationOpen, setDurationOpen] = useState(false);
  const [durationDraft, setDurationDraft] = useState({ start: "", end: "" });
  const durationTriggerRef = useRef<HTMLButtonElement>(null);
  const scheduleSelected = Boolean(filters.start && filters.end);
  const availabilityKey = `${filters.date}|${filters.start}|${filters.end}`;

  useEffect(() => {
    const canonicalQuery = serializeRoomFilters(filters);
    if (searchParams.toString() !== canonicalQuery) {
      setSearchParams(canonicalQuery, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  const updateFilters = useCallback(
    (changes: Partial<RoomFilters>) => {
      const nextFilters = {
        ...filters,
        ...changes,
        floor: changes.building !== undefined ? "" : changes.floor ?? filters.floor,
      };
      setSearchParams(serializeRoomFilters(nextFilters));
    },
    [filters, setSearchParams],
  );

  const retryRoomList = useCallback(() => {
    setLoading(true);
    setRoomsError(null);
    setRetryRooms((count) => count + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Room[]>("/rooms", () => getToken(), {
      signal: controller.signal,
    })
      .then((data) => {
        setRooms(data);
        setRoomsError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRoomsError(
          error instanceof Error
            ? error
            : new Error("Daftar ruangan tidak dapat dimuat."),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [getToken, retryRooms]);

  useEffect(() => {
    if (!rooms || !scheduleSelected) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      date: filters.date,
      startTime: filters.start,
      endTime: filters.end,
    });

    void apiRequest<Room[]>(`/rooms?${params.toString()}`, () => getToken(), {
      signal: controller.signal,
    })
      .then((data) => {
        setAvailabilityResponse({ key: availabilityKey, rooms: data });
        setAvailabilityError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setAvailabilityError({
          key: availabilityKey,
          error:
            error instanceof Error
              ? error
              : new Error("Ketersediaan ruangan tidak dapat dimuat."),
        });
      });
    return () => controller.abort();
  }, [
    availabilityKey,
    availabilityRetry,
    filters.date,
    filters.end,
    filters.start,
    getToken,
    rooms,
    scheduleSelected,
  ]);

  const hours = useMemo(
    () => buildHourOptions(rooms ?? []),
    [rooms],
  );
  const availabilityRooms =
    availabilityResponse?.key === availabilityKey
      ? availabilityResponse.rooms
      : null;
  const currentAvailabilityError =
    availabilityError?.key === availabilityKey ? availabilityError.error : null;
  const availabilityLoading =
    scheduleSelected &&
    availabilityRooms === null &&
    currentAvailabilityError === null &&
    !loading &&
    !roomsError;
  const displayedRooms = useMemo(() => {
    if (!rooms) return [];
    const availabilityById = new Map(
      (availabilityRooms ?? []).map((room) => [String(room.id), room.isAvailable]),
    );
    const withAvailability = rooms.map((room) => ({
      ...room,
      isAvailable: availabilityRooms
        ? availabilityById.get(String(room.id))
        : undefined,
    }));
    return filterRooms(withAvailability, filters);
  }, [availabilityRooms, filters, rooms]);

  const buildings = useMemo(
    () =>
      [...new Set((rooms ?? []).map((room) => room.building).filter(
        (building): building is string => Boolean(building),
      ))].sort((a, b) => a.localeCompare(b, "id-ID")),
    [rooms],
  );
  const floors = useMemo(
    () =>
      [
        ...new Set(
          (rooms ?? [])
            .filter((room) => !filters.building || room.building === filters.building)
            .map((room) => room.floor)
            .filter((floor) => floor !== null && floor !== undefined)
            .map(String),
        ),
      ].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, "id-ID")),
    [filters.building, rooms],
  );
  const hasOnlineRooms = (rooms ?? []).some(
    (room) => room.type.toLowerCase() === "online",
  );
  const availableTypes = useMemo(
    () =>
      [...new Set((rooms ?? []).map((room) => room.type.toLowerCase()))].sort(),
    [rooms],
  );

  const openDurationDialog = () => {
    const start = filters.start || hours.starts[0] || "";
    const endChoices = getEndOptions(start, hours.ends);
    const end = endChoices.includes(filters.end)
      ? filters.end
      : endChoices[0] ?? "";
    setDurationDraft({ start, end });
    setDurationOpen(true);
  };

  const closeDurationDialog = useCallback(() => setDurationOpen(false), []);

  const changeDraftStart = (start: string) => {
    setDurationDraft((draft) => {
      const validEnds = getEndOptions(start, hours.ends);
      return {
        start,
        end: validEnds.includes(draft.end) ? draft.end : validEnds[0] ?? "",
      };
    });
  };

  const applyDuration = () => {
    updateFilters({ start: durationDraft.start, end: durationDraft.end });
    setDurationOpen(false);
  };

  const clearDuration = () => {
    updateFilters({ start: "", end: "", availability: "all" });
    setDurationOpen(false);
  };

  const resetFilters = () => {
    setSearchParams(
      serializeRoomFilters(createDefaultRoomFilters(getJakartaDate())),
    );
  };

  const retryAvailability = () => {
    setAvailabilityError(null);
    setAvailabilityResponse(null);
    setAvailabilityRetry((count) => count + 1);
  };

  const availabilityMessage = currentAvailabilityError
    ? currentAvailabilityError instanceof ApiError && currentAvailabilityError.status === 422
      ? currentAvailabilityError.message
      : currentAvailabilityError.message
    : null;

  return (
    <section className="rooms-page">
      <div className="rooms-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Beranda</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Ruang Rapat</span>
      </div>

      <div className="rooms-heading">
        <div>
          <p className="eyebrow">TEMUKAN RUANGAN YANG TEPAT</p>
          <h1>Ruang Rapat</h1>
        </div>
        <div className="rooms-total" aria-live="polite">
          Total: <strong>{displayedRooms.length}</strong> ruangan
        </div>
      </div>

      {roomsError && (
        <ErrorBanner
          message={roomsError.message}
          onRetry={retryRoomList}
        />
      )}
      {availabilityMessage && (
        <ErrorBanner message={availabilityMessage} onRetry={retryAvailability} />
      )}

      <section className="room-filters-panel" aria-label="Filter ruangan">
        <div className="filter-panel-heading">
          <div className="filter-title">
            <span className="filter-title-icon" aria-hidden="true">
              ≡
            </span>
            <h2>Filter Ruangan</h2>
          </div>
          <button type="button" className="reset-filters" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>

        <div className="filter-grid">
          <label className="filter-control">
            <span>Tanggal</span>
            <input
              type="date"
              value={filters.date}
              min={getJakartaDate()}
              onChange={(event) => updateFilters({ date: event.target.value })}
            />
          </label>

          <div className="filter-control">
            <span id="duration-label">Durasi (Start - End)</span>
            <button
              ref={durationTriggerRef}
              type="button"
              className="duration-trigger"
              aria-haspopup="dialog"
              aria-labelledby="duration-label"
              onClick={openDurationDialog}
              disabled={hours.starts.length === 0 || loading}
            >
              <span>{formatDurationLabel(filters.start, filters.end)}</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>

          <label className="filter-control">
            <span>Kapasitas</span>
            <select
              value={filters.capacity}
              onChange={(event) =>
                updateFilters({
                  capacity: event.target.value as RoomFilters["capacity"],
                })
              }
            >
              <option value="">Semua</option>
              <option value="1-3">1-3 orang</option>
              <option value="4-6">4-6 orang</option>
              <option value="7-10">7-10 orang</option>
              <option value="11+">11+ orang</option>
            </select>
          </label>

          <label className="filter-control">
            <span>Ketersediaan</span>
            <select
              value={filters.availability}
              disabled={!scheduleSelected}
              aria-describedby={!scheduleSelected ? "availability-help" : undefined}
              onChange={(event) =>
                updateFilters({
                  availability:
                    event.target.value as RoomFilters["availability"],
                })
              }
            >
              <option value="all">Semua</option>
              <option value="available">Tersedia saja</option>
            </select>
            {!scheduleSelected && (
              <span className="filter-help" id="availability-help">
                Pilih durasi dulu
              </span>
            )}
          </label>

          <label className="filter-control">
            <span>Gedung</span>
            <select
              value={filters.building}
              onChange={(event) =>
                updateFilters({ building: event.target.value, floor: "" })
              }
            >
              <option value="">Semua gedung</option>
              {buildings.map((building) => (
                <option key={building} value={building}>
                  {building}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-control">
            <span>Lantai</span>
            <select
              value={filters.floor}
              disabled={floors.length === 0}
              onChange={(event) => updateFilters({ floor: event.target.value })}
            >
              <option value="">Semua lantai</option>
              {floors.map((floor) => (
                <option key={floor} value={floor}>
                  {floor === "0" ? "Lantai dasar" : `Lantai ${floor}`}
                </option>
              ))}
            </select>
          </label>

          <DebouncedSearch
            key={filters.search}
            value={filters.search}
            onCommit={(search) => {
              if (search !== filters.search) updateFilters({ search });
            }}
          />

          <label className="filter-control">
            <span>Urutkan</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                updateFilters({ sort: event.target.value as RoomFilters["sort"] })
              }
            >
              <option value="name">Nama A-Z</option>
              <option value="capacity-asc">Kapasitas terkecil</option>
              <option value="capacity-desc">Kapasitas terbesar</option>
            </select>
          </label>

          {hasOnlineRooms && (
            <label className="filter-control">
              <span>Tipe Ruangan</span>
              <select
                value={filters.type}
                onChange={(event) => updateFilters({ type: event.target.value })}
              >
                <option value="">Semua tipe</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "online" ? "Online" : "Onsite"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <fieldset className="facility-filter">
          <legend>Fasilitas</legend>
          <label className="facility-option">
            <input
              type="checkbox"
              checked={filters.facilities.length === 0}
              onChange={() => updateFilters({ facilities: [] })}
            />
            <span>Semua</span>
          </label>
          {ROOM_FACILITIES.map((facility) => (
            <label className="facility-option" key={facility}>
              <input
                type="checkbox"
                checked={filters.facilities.includes(facility)}
                onChange={(event) => {
                  const facilities = event.target.checked
                    ? [...filters.facilities, facility]
                    : filters.facilities.filter((item) => item !== facility);
                  updateFilters({ facilities });
                }}
              />
              <span>{facility}</span>
            </label>
          ))}
        </fieldset>
      </section>

      {availabilityLoading && (
        <div className="availability-loading" role="status">
          <span className="loading-spinner" />
          <span>Memeriksa ketersediaan untuk jadwal terpilih...</span>
        </div>
      )}

      {loading || (availabilityLoading && !availabilityRooms) ? (
        <div className="rooms-grid" aria-label="Memuat daftar ruangan" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <RoomCardSkeleton key={index} />
          ))}
        </div>
      ) : roomsError ? null : displayedRooms.length ? (
        <div className="rooms-grid">
          {displayedRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              isAdmin={worker?.role === "ADMIN"}
              scheduleSelected={scheduleSelected}
            />
          ))}
        </div>
      ) : (
        <div className="rooms-empty">
          <span className="empty-illustration" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <h2>Tidak ada ruangan yang cocok</h2>
          <p>
            {rooms?.length
              ? "Coba ubah filter atau reset untuk melihat kembali semua ruangan."
              : "Belum ada ruangan yang tersedia. Coba reset filter atau periksa kembali nanti."}
          </p>
          <button type="button" className="button button-primary" onClick={resetFilters}>
            Reset Filter
          </button>
        </div>
      )}

      {durationOpen && (
        <DurationDialog
          starts={hours.starts}
          ends={hours.ends}
          start={durationDraft.start}
          end={durationDraft.end}
          onStartChange={changeDraftStart}
          onEndChange={(end) =>
            setDurationDraft((draft) => ({ ...draft, end }))
          }
          onApply={applyDuration}
          onClear={clearDuration}
          onCancel={closeDurationDialog}
          triggerRef={durationTriggerRef}
        />
      )}
    </section>
  );
}
