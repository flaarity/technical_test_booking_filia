import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { BookingDialog } from "../components/booking-dialog";
import { RoomCardSkeleton } from "../components/room-card-skeleton";
import { ApiError, apiRequest } from "../lib/api";
import type { Room } from "../lib/room-filters";
import { getJakartaDate, isExactHour, timeToMinutes } from "../lib/room-filters";
import {
  addCalendarDays,
  buildHourRows,
  formatLongJakartaDate,
  getBookingBlockPosition,
  getFreeEndTimes,
  getFreeStartTimes,
  getMonthGrid,
  getTimelineRange,
  isCellDisabled,
  parseISODate,
  twoClickSelection,
  validateBookingRange,
  type RoomBooking,
} from "../lib/room-schedule";
import { useMonthlyRoomBookings, useRoomBookings } from "../hooks/use-room-bookings";
import { useWorker } from "../context/use-worker";
import "./room-detail-page.css";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const DAY_ROW_HEIGHT = 64;

type Selection = {
  startTime: string;
  endTime: string;
  awaitingSecond: boolean;
};

function getInitialDate(queryDate: string | null) {
  const today = getJakartaDate();
  return queryDate && parseISODate(queryDate) && queryDate >= today
    ? queryDate
    : today;
}

function getInitialMonth(date: string) {
  const parsed = parseISODate(date) ?? parseISODate(getJakartaDate())!;
  return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() };
}

function MonthNavigation({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  const today = parseISODate(getJakartaDate())!;
  const atCurrentMonth =
    year === today.getUTCFullYear() && month === today.getUTCMonth();
  const label = new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));

  return (
    <div className="calendar-month-navigation">
      <button
        type="button"
        className="calendar-month-button"
        aria-label="Bulan sebelumnya"
        disabled={atCurrentMonth}
        onClick={() => onChange(year, month - 1)}
      >
        ‹
      </button>
      <h2 aria-live="polite">{label}</h2>
      <button
        type="button"
        className="calendar-month-button"
        aria-label="Bulan berikutnya"
        onClick={() => onChange(year, month + 1)}
      >
        ›
      </button>
    </div>
  );
}

function RoomDetailLoading() {
  return (
    <section className="room-detail-page" aria-label="Memuat detail ruangan">
      <div className="detail-skeleton-breadcrumb" />
      <div className="detail-layout">
        <RoomCardSkeleton />
        <div className="detail-right-skeleton">
          <div className="detail-skeleton-calendar" />
          <div className="detail-skeleton-timeline" />
        </div>
      </div>
    </section>
  );
}

function DetailError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="detail-error-banner" role="alert">
      <span className="detail-error-symbol" aria-hidden="true">
        !
      </span>
      <p>{message}</p>
      <button type="button" className="button button-outline" onClick={retry}>
        Coba lagi
      </button>
    </div>
  );
}

function RoomNotFound({ returnTo }: { returnTo: string }) {
  return (
    <section className="room-not-found">
      <span className="not-found-room-icon" aria-hidden="true">
        ?
      </span>
      <h1>Ruangan tidak ditemukan</h1>
      <p>Ruangan yang Anda cari tidak tersedia atau sudah dihapus.</p>
      <Link className="button button-primary" to={returnTo}>
        Kembali ke Ruang Rapat
      </Link>
    </section>
  );
}

export function RoomDetailPage() {
  const { id = "" } = useParams();
  const { getToken } = useAuth();
  const location = useLocation();
  const [room, setRoom] = useState<Room | null>(null);
  const [loadedRoomKey, setLoadedRoomKey] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const roomRequestKey = `${id}:${attempt}`;
  const loading = loadedRoomKey !== roomRequestKey;
  const [searchParams] = useSearchParams();
  const retry = () => setAttempt((value) => value + 1);
  const locationState = location.state as { returnTo?: string } | null;
  const returnTo = locationState?.returnTo?.startsWith("/rooms")
    ? locationState.returnTo
    : "/rooms";

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Room>(`/rooms/${encodeURIComponent(id)}`, () => getToken(), {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setRoom(result);
        setError(null);
        setLoadedRoomKey(roomRequestKey);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setRoom(null);
        setError(
          requestError instanceof Error
            ? requestError
            : new Error("Detail ruangan tidak dapat dimuat."),
        );
        setLoadedRoomKey(roomRequestKey);
      });
    return () => controller.abort();
  }, [getToken, id, roomRequestKey]);

  if (loading) return <RoomDetailLoading />;
  if (error instanceof ApiError && error.status === 404) {
    return <RoomNotFound returnTo={returnTo} />;
  }
  if (error) {
    return (
      <section className="room-detail-page">
        <DetailError message={error.message} retry={retry} />
      </section>
    );
  }
  if (!room) return <RoomDetailLoading />;

  return (
    <LoadedRoomDetail
      key={room.id}
      room={room}
      returnTo={returnTo}
      queryDate={searchParams.get("date")}
      queryStart={searchParams.get("start")}
      queryEnd={searchParams.get("end")}
    />
  );
}

function LoadedRoomDetail({
  room,
  returnTo,
  queryDate,
  queryStart,
  queryEnd,
}: {
  room: Room;
  returnTo: string;
  queryDate: string | null;
  queryStart: string | null;
  queryEnd: string | null;
}) {
  const { worker } = useWorker();
  const isAdmin = worker?.role === "ADMIN";
  const initialDate = getInitialDate(queryDate);
  const initialMonth = getInitialMonth(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [windowStart, setWindowStart] = useState(initialDate);
  const [visibleDays, setVisibleDays] = useState(5);
  const [calendarMonth, setCalendarMonth] = useState(initialMonth);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingSchedule, setBookingSchedule] = useState<{
    roomId: number | string;
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [activeBooking, setActiveBooking] = useState<string | number | null>(null);
  const initialQueryApplied = useRef(false);
  const timelineHeadingRef = useRef<HTMLHeadingElement>(null);
  const bookingButtonRef = useRef<HTMLButtonElement>(null);
  const timelineRange = useMemo(
    () => getTimelineRange(windowStart, visibleDays),
    [visibleDays, windowStart],
  );
  const monthBookings = useMonthlyRoomBookings(
    String(room.id),
    calendarMonth.year,
    calendarMonth.month,
  );
  const timelineBookings = useRoomBookings(
    String(room.id),
    timelineRange.from,
    timelineRange.to,
  );
  const calendarDays = useMemo(
    () => getMonthGrid(calendarMonth.year, calendarMonth.month),
    [calendarMonth.month, calendarMonth.year],
  );
  const bookingDates = useMemo(
    () => new Set(monthBookings.bookings.map((booking) => booking.date)),
    [monthBookings.bookings],
  );
  const dates = useMemo(
    () =>
      Array.from({ length: visibleDays }, (_, index) =>
        addCalendarDays(windowStart, index),
      ),
    [visibleDays, windowStart],
  );
  const hourRows = useMemo(
    () => buildHourRows(room.openTime, room.closeTime),
    [room.closeTime, room.openTime],
  );
  const currentBookings = timelineBookings.bookings;
  const selectedStartTimes = useMemo(
    () =>
      getFreeStartTimes(
        selectedDate,
        room.openTime,
        room.closeTime,
        currentBookings,
        now,
      ),
    [currentBookings, now, room.closeTime, room.openTime, selectedDate],
  );
  const selectedEndTimes = useMemo(
    () =>
      selection
        ? getFreeEndTimes(
            selectedDate,
            selection.startTime,
            room.openTime,
            room.closeTime,
            currentBookings,
            now,
          )
        : [],
    [currentBookings, now, room.closeTime, room.openTime, selectedDate, selection],
  );
  const rowsByDate = useMemo(
    () =>
      new Map(
        dates.map((date) => [
          date,
          currentBookings.filter((booking) => booking.date === date),
        ]),
      ),
    [currentBookings, dates],
  );
  const dateLongLabel = formatLongJakartaDate(selectedDate);
  const facilities = room.facilities ?? [];

  useEffect(() => {
    const updateVisibleDays = () => {
      setVisibleDays(window.matchMedia("(max-width: 600px)").matches ? 1 : 5);
    };
    updateVisibleDays();
    window.addEventListener("resize", updateVisibleDays);
    return () => window.removeEventListener("resize", updateVisibleDays);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      initialQueryApplied.current ||
      timelineBookings.loading ||
      timelineBookings.error ||
      !queryDate ||
      !queryStart ||
      !queryEnd ||
      selectedDate !== queryDate
    ) {
      return;
    }
    initialQueryApplied.current = true;
    if (
      !isExactHour(queryStart) ||
      !isExactHour(queryEnd) ||
      timeToMinutes(queryEnd) <= timeToMinutes(queryStart)
    ) {
      return;
    }
    const validation = validateBookingRange(
      queryDate,
      queryStart,
      queryEnd,
      room.openTime,
      room.closeTime,
      currentBookings,
      now,
    );
    if (validation.valid) {
      queueMicrotask(() => {
        setSelection({
          startTime: queryStart,
          endTime: queryEnd,
          awaitingSecond: false,
        });
      });
    }
  }, [
    currentBookings,
    now,
    queryDate,
    queryEnd,
    queryStart,
    room.closeTime,
    room.openTime,
    selectedDate,
    timelineBookings.error,
    timelineBookings.loading,
  ]);

  const changeCalendarMonth = (year: number, month: number) => {
    const next = new Date(Date.UTC(year, month, 1));
    const today = parseISODate(getJakartaDate())!;
    if (
      next.getUTCFullYear() < today.getUTCFullYear() ||
      (next.getUTCFullYear() === today.getUTCFullYear() &&
        next.getUTCMonth() < today.getUTCMonth())
    ) {
      return;
    }
    setCalendarMonth({
      year: next.getUTCFullYear(),
      month: next.getUTCMonth(),
    });
  };

  const chooseDate = (date: string) => {
    if (date < getJakartaDate()) return;
    setSelectedDate(date);
    setWindowStart(date);
    setSelection(null);
    setSelectionError("");
    const parsed = parseISODate(date)!;
    setCalendarMonth({
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth(),
    });
  };

  const shiftTimeline = (direction: -1 | 1) => {
    const shifted = addCalendarDays(windowStart, direction);
    if (shifted < getJakartaDate()) return;
    setSelectedDate(shifted);
    setWindowStart(shifted);
    setSelection(null);
    setSelectionError("");
    const parsed = parseISODate(shifted)!;
    setCalendarMonth({
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth(),
    });
  };

  const clearSelection = () => {
    setSelection(null);
    setSelectionError("");
  };

  const handleCellSelect = (date: string, rowIndex: number) => {
    if (date !== selectedDate) {
      chooseDate(date);
      return;
    }
    const startTime = hourRows[rowIndex];
    if (isCellDisabled(date, startTime, room.openTime, room.closeTime, now)) {
      return;
    }

    const currentStartIndex =
      selection?.awaitingSecond
        ? hourRows.indexOf(selection.startTime)
        : null;
    const range = twoClickSelection(currentStartIndex, rowIndex);
    const nextStart = hourRows[range.startIndex];
    const nextEnd = hourRows[range.endIndex];
    if (!nextStart || !nextEnd) {
      setSelectionError("Rentang waktu tidak valid.");
      return;
    }
    const validation = validateBookingRange(
      date,
      nextStart,
      nextEnd,
      room.openTime,
      room.closeTime,
      currentBookings,
      now,
    );
    if (!validation.valid) {
      setSelectionError(validation.reason);
      return;
    }
    setSelection({
      startTime: nextStart,
      endTime: nextEnd,
      awaitingSecond: range.awaitingSecond,
    });
    setSelectionError("");
  };

  const handleStartChange = (startTime: string) => {
    const endOptions = getFreeEndTimes(
      selectedDate,
      startTime,
      room.openTime,
      room.closeTime,
      currentBookings,
      now,
    );
    const endTime =
      selection && endOptions.includes(selection.endTime)
        ? selection.endTime
        : endOptions[0] ?? "";
    setSelection(
      endTime
        ? { startTime, endTime, awaitingSecond: false }
        : null,
    );
    setSelectionError("");
  };

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && selection) clearSelection();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [selection]);

  const handleRequestBooking = () => {
    if (!selection) return;
    setBookingSchedule({
      roomId: room.id,
      date: selectedDate,
      startTime: selection.startTime,
      endTime: selection.endTime,
    });
    setBookingDialogOpen(true);
  };

  const focusTimeline = () => {
    timelineHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    timelineHeadingRef.current?.focus({ preventScroll: true });
  };

  const handleBookingClose = (refreshTimeline: boolean) => {
    setBookingDialogOpen(false);
    setBookingSchedule(null);
    if (refreshTimeline) {
      timelineBookings.reload();
      monthBookings.reload();
      clearSelection();
    }
    window.requestAnimationFrame(() => {
      if (bookingButtonRef.current?.disabled) {
        focusTimeline();
      } else {
        bookingButtonRef.current?.focus();
      }
    });
  };

  const handleBookingSuccess = () => {
    timelineBookings.reload();
    monthBookings.reload();
    clearSelection();
  };

  const handleSlotUnavailable = () => {
    setBookingDialogOpen(false);
    timelineBookings.reload();
    monthBookings.reload();
    clearSelection();
    setSelectionError("Slot waktu tersebut sudah tidak tersedia. Pilih jadwal lain.");
    window.requestAnimationFrame(() => bookingButtonRef.current?.focus());
  };

  const calendarError = monthBookings.error;
  const timelineError = timelineBookings.error;

  return (
    <section className="room-detail-page">
      <div className="detail-breadcrumb-row">
        <div className="detail-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Beranda</Link>
          <span aria-hidden="true">›</span>
          <Link to={returnTo}>Ruang Rapat</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Detail Ruang Rapat</span>
        </div>
        <Link className="detail-back-link" to={returnTo}>
          <span aria-hidden="true">←</span>
          Kembali ke Ruang Rapat
        </Link>
      </div>

      <div className="detail-layout">
        <aside className="room-info-card">
          <div className="detail-room-image">
            {room.image && !imageFailed ? (
              <img
                src={room.image}
                alt={`Foto ${room.name}`}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="detail-room-image-placeholder">
                <span aria-hidden="true">▦</span>
                <span>Gambar Ruang Rapat</span>
              </div>
            )}
          </div>
          <div className="room-info-card-content">
            <div className="room-info-heading">
              <div>
                <p className="detail-eyebrow">INFORMASI RUANGAN</p>
                <h1>{room.name}</h1>
              </div>
              <span className="room-type-badge">
                {room.type.toLowerCase() === "online" ? "Online" : "Onsite"}
              </span>
            </div>
            <div className="room-info-essentials">
              <p>
                <span aria-hidden="true">⌖</span>
                {room.location || "Lokasi tidak disebutkan"}
              </p>
              <p>
                <span aria-hidden="true">◷</span>
                {room.openTime} - {room.closeTime}
              </p>
              <p>
                <span aria-hidden="true">◉</span>
                Maks. {room.capacity} orang
              </p>
            </div>

            {room.notes && (
              <div className="detail-note-badge">
                <span aria-hidden="true">!</span>
                <span>{room.notes}</span>
              </div>
            )}

            <div className="detail-facilities">
              <h2>Fasilitas Ruangan</h2>
              {facilities.length ? (
                <ul className="detail-facility-chips">
                  {facilities.map((facility) => (
                    <li key={facility}>{facility}</li>
                  ))}
                </ul>
              ) : (
                <p>Tidak disebutkan</p>
              )}
            </div>

            {detailsExpanded && (
              <div className="room-extra-details">
                <h2>Rincian Ruangan</h2>
                <dl>
                  <div>
                    <dt>Tipe ruangan</dt>
                    <dd>{room.type.toLowerCase() === "online" ? "Online" : "Onsite"}</dd>
                  </div>
                  {room.building && (
                    <div>
                      <dt>Gedung</dt>
                      <dd>{room.building}</dd>
                    </div>
                  )}
                  {room.floor !== null && room.floor !== undefined && (
                    <div>
                      <dt>Lantai</dt>
                      <dd>{room.floor}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Jam operasional</dt>
                    <dd>{room.openTime} - {room.closeTime}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="room-info-actions">
              <button
                type="button"
                className="button button-outline"
                aria-expanded={detailsExpanded}
                onClick={() => setDetailsExpanded((expanded) => !expanded)}
              >
                {detailsExpanded ? "Tutup Detail Ruangan" : "Detail Ruangan"}
              </button>
              {!isAdmin && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={focusTimeline}
                >
                  Pesan Ruangan
                </button>
              )}
            </div>
          </div>
        </aside>

        <div className="room-schedule-column">
          <section className="detail-panel calendar-panel" aria-labelledby="calendar-title">
            <div className="detail-panel-heading">
              <div>
                <p className="detail-eyebrow">PILIH TANGGAL</p>
                <h2 id="calendar-title">Kalender</h2>
              </div>
              <MonthNavigation
                year={calendarMonth.year}
                month={calendarMonth.month}
                onChange={changeCalendarMonth}
              />
            </div>

            {calendarError && (
              <DetailError message={calendarError.message} retry={monthBookings.reload} />
            )}
            {monthBookings.loading ? (
              <div className="calendar-skeleton" role="status" aria-label="Memuat kalender">
                {Array.from({ length: 35 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            ) : (
              <div className="calendar-grid" aria-label="Kalender bulanan">
                {WEEKDAYS.map((weekday) => (
                  <span className="calendar-weekday" key={weekday}>
                    {weekday}
                  </span>
                ))}
                {calendarDays.map((day) => {
                  const isToday = day.date === getJakartaDate(now);
                  const isSelected = day.date === selectedDate;
                  const isPast = day.date < getJakartaDate(now);
                  const hasBookings = bookingDates.has(day.date);
                  const accessibleDate = formatLongJakartaDate(day.date);
                  return (
                    <button
                      type="button"
                      key={day.date}
                      className={[
                        "calendar-day",
                        !day.inMonth && "calendar-day-outside",
                        isToday && "calendar-day-today",
                        isSelected && "calendar-day-selected",
                        isPast && "calendar-day-disabled",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={isPast}
                      aria-pressed={isSelected}
                      aria-label={`${accessibleDate}, ${hasBookings ? "ada booking" : "tidak ada booking"}${isToday ? ", hari ini" : ""}`}
                      onClick={() => chooseDate(day.date)}
                    >
                      <span>{day.day}</span>
                      {hasBookings && (
                        <span className="calendar-booking-dot" aria-hidden="true" />
                      )}
                      {isToday && <span className="calendar-today-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="calendar-legend">
              <span>
                <i className="legend-selected" aria-hidden="true" /> Tanggal dipilih
              </span>
              <span>
                <i className="legend-booking" aria-hidden="true" /> Ada booking
              </span>
            </div>
          </section>

          <section className="detail-panel timeline-panel" aria-labelledby="timeline-title">
            <div className="detail-panel-heading timeline-heading">
              <div>
                <p className="detail-eyebrow">KETERSEDIAAN RUANG</p>
                <h2 id="timeline-title" ref={timelineHeadingRef} tabIndex={-1}>
                  Timeline
                </h2>
              </div>
              <div className="timeline-window-controls">
                <button
                  type="button"
                  className="timeline-shift-button"
                  aria-label="Lihat hari sebelumnya"
                  disabled={windowStart <= getJakartaDate(now)}
                  onClick={() => shiftTimeline(-1)}
                >
                  ‹
                </button>
                <span>{dateLongLabel}</span>
                <button
                  type="button"
                  className="timeline-shift-button"
                  aria-label="Lihat hari berikutnya"
                  onClick={() => shiftTimeline(1)}
                >
                  ›
                </button>
              </div>
            </div>
            {isAdmin && (
              <p className="admin-readonly-note">
                <span aria-hidden="true">◉</span> Mode lihat (Admin)
              </p>
            )}
            {calendarError === null && timelineError && (
              <DetailError message={timelineError.message} retry={timelineBookings.reload} />
            )}
            {timelineBookings.loading ? (
              <div className="timeline-loading" role="status">
                <span className="loading-spinner" />
                <span>Memuat jadwal ruangan...</span>
                <div className="timeline-loading-lines" />
              </div>
            ) : (
              <>
                <TimelineGrid
                  dates={dates}
                  hourRows={hourRows}
                  openTime={room.openTime}
                  closeTime={room.closeTime}
                  bookingsByDate={rowsByDate}
                  selectedDate={selectedDate}
                  selection={selection}
                  isAdmin={isAdmin}
                  now={now}
                  activeBooking={activeBooking}
                  setActiveBooking={setActiveBooking}
                  onSelectCell={handleCellSelect}
                  onClearSelection={clearSelection}
                />
                <div className="timeline-legend">
                  <span>
                    <i className="legend-other-booking" aria-hidden="true" /> Sudah dipesan
                  </span>
                  {!isAdmin && (
                    <>
                      <span>
                        <i className="legend-my-booking" aria-hidden="true" /> Booking saya
                      </span>
                      <span>
                        <i className="legend-selection" aria-hidden="true" /> Pilihan
                      </span>
                    </>
                  )}
                </div>
                {selectionError && (
                  <p className="timeline-live-error" role="status" aria-live="polite">
                    {selectionError}
                  </p>
                )}
                {!isAdmin && (
                  <section className="booked-time-panel" aria-labelledby="booked-time-title">
                    <div className="booked-time-heading">
                      <div>
                        <p className="detail-eyebrow">JADWAL PILIHAN</p>
                        <h3 id="booked-time-title">Waktu yang dipesan</h3>
                      </div>
                      <span className="booked-date-label">{dateLongLabel}</span>
                    </div>
                    <div className="booked-time-controls">
                      <label>
                        <span>Start</span>
                        <select
                          value={selection?.startTime ?? ""}
                          onChange={(event) => handleStartChange(event.target.value)}
                          disabled={!selectedStartTimes.length}
                        >
                          <option value="">Pilih jam mulai</option>
                          {selectedStartTimes.map((time) => (
                            <option value={time} key={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="booked-time-dash" aria-hidden="true">
                        —
                      </span>
                      <label>
                        <span>End</span>
                        <select
                          value={selection?.endTime ?? ""}
                          onChange={(event) =>
                            setSelection((current) =>
                              current
                                ? {
                                    ...current,
                                    endTime: event.target.value,
                                    awaitingSecond: false,
                                  }
                                : null,
                            )
                          }
                          disabled={!selection || !selectedEndTimes.length}
                        >
                          {selection ? (
                            selectedEndTimes.map((time) => (
                              <option value={time} key={time}>
                                {time}
                              </option>
                            ))
                          ) : (
                            <option value="">Pilih jam selesai</option>
                          )}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="button button-primary request-booking-button"
                        ref={bookingButtonRef}
                        disabled={!selection || !selectedEndTimes.includes(selection.endTime)}
                        onClick={handleRequestBooking}
                      >
                        Pesan
                      </button>
                      {selection && (
                        <button
                          type="button"
                          className="clear-selection-button"
                          onClick={clearSelection}
                        >
                          Hapus pilihan
                        </button>
                      )}
                    </div>
                    <p className="timeline-keyboard-hint">
                      Pilih satu jam, lalu pilih jam lain untuk memperluas rentang. Tekan
                      Escape untuk menghapus pilihan.
                    </p>
                  </section>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      {bookingDialogOpen && bookingSchedule && worker && (
        <BookingDialog
          room={room}
          worker={worker}
          schedule={bookingSchedule}
          onClose={handleBookingClose}
          onSuccess={handleBookingSuccess}
          onUnavailable={handleSlotUnavailable}
          onEditSchedule={() => {
            if (!bookingSchedule) return;
            setBookingDialogOpen(false);
            setBookingSchedule(null);
            window.requestAnimationFrame(focusTimeline);
          }}
        />
      )}
    </section>
  );
}

function TimelineGrid({
  dates,
  hourRows,
  openTime,
  closeTime,
  bookingsByDate,
  selectedDate,
  selection,
  isAdmin,
  now,
  activeBooking,
  setActiveBooking,
  onSelectCell,
  onClearSelection,
}: {
  dates: string[];
  hourRows: string[];
  openTime: string;
  closeTime: string;
  bookingsByDate: Map<string, RoomBooking[]>;
  selectedDate: string;
  selection: Selection | null;
  isAdmin: boolean;
  now: Date;
  activeBooking: string | number | null;
  setActiveBooking: (id: string | number | null) => void;
  onSelectCell: (date: string, rowIndex: number) => void;
  onClearSelection: () => void;
}) {
  const rowsHeight = `${hourRows.length * DAY_ROW_HEIGHT}px`;
  const gridColumns = `58px repeat(${dates.length}, minmax(144px, 1fr))`;

  return (
    <div
      className="timeline-scroll"
      role="region"
      aria-label="Timeline ketersediaan ruangan"
      tabIndex={0}
    >
      <div
        className="timeline-grid"
        style={{
          gridTemplateColumns: gridColumns,
          "--timeline-row-height": `${DAY_ROW_HEIGHT}px`,
          "--timeline-row-count": hourRows.length,
        } as CSSProperties}
      >
        <div className="timeline-corner">Jam</div>
        {dates.map((date) => {
          const bookingList = bookingsByDate.get(date) ?? [];
          return (
            <div
              className={`timeline-date-heading${date === selectedDate ? " timeline-date-selected" : ""}`}
              key={`heading-${date}`}
            >
              <span>{formatTimelineDate(date)}</span>
              {bookingList.length > 0 && (
                <span className="timeline-booking-count">
                  {bookingList.length} booking
                </span>
              )}
            </div>
          );
        })}

        <div className="timeline-time-rail" style={{ height: rowsHeight }}>
          {hourRows.map((time) => (
            <div className="timeline-hour-label" key={`hour-${time}`}>
              {time}
            </div>
          ))}
        </div>
        {dates.map((date) => {
          const bookingList = bookingsByDate.get(date) ?? [];
          const dateBookings = bookingList.filter(
            (booking) => booking.date === date,
          );
          return (
            <div className="timeline-day-column" key={date} style={{ height: rowsHeight }}>
              <div className="timeline-day-cells">
                {hourRows.map((time, rowIndex) => {
                  const isPastOrClosed = isCellDisabled(
                    date,
                    time,
                    openTime,
                    closeTime,
                    now,
                  );
                  const slotStart = timeToMinutes(time);
                  const occupiedBy = dateBookings.find(
                    (booking) =>
                      slotStart < timeToMinutes(booking.endTime) &&
                      slotStart + 60 > timeToMinutes(booking.startTime),
                  );
                  const isDisabled = isPastOrClosed || Boolean(occupiedBy);
                  const startIndex = selection
                    ? hourRows.indexOf(selection.startTime)
                    : -1;
                  const endIndex = selection
                    ? hourRows.indexOf(selection.endTime)
                    : -1;
                  const selected =
                    selection !== null &&
                    date === selectedDate &&
                    rowIndex >= startIndex &&
                    rowIndex < endIndex;
                  const cellLabel = `${formatLongJakartaDate(date)} ${time}, ${occupiedBy ? "sudah dipesan" : isPastOrClosed ? "tidak tersedia" : "tersedia"}`;

                  if (isAdmin) {
                    return (
                      <div
                        className={`timeline-cell${isDisabled ? " timeline-cell-disabled" : ""}`}
                        role="gridcell"
                        aria-label={cellLabel}
                        key={`${date}-${time}`}
                      />
                    );
                  }
                  return (
                    <button
                      type="button"
                      className={[
                        "timeline-cell",
                        isDisabled && "timeline-cell-disabled",
                        selected && "timeline-cell-selected",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={cellLabel}
                      aria-disabled={isDisabled}
                      disabled={isDisabled}
                      key={`${date}-${time}`}
                      onClick={() => onSelectCell(date, rowIndex)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && selection) {
                          event.stopPropagation();
                          onClearSelection();
                        }
                      }}
                    >
                      {selected && rowIndex === startIndex && (
                        <span className="selection-label">Pilihan</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {dateBookings.map((booking) => {
                const position = getBookingBlockPosition(
                  booking,
                  openTime,
                  DAY_ROW_HEIGHT,
                );
                if (!position) return null;
                const isMine = booking.isMine;
                return (
                  <button
                    type="button"
                    key={booking.id}
                    className={`timeline-booking-block${isMine ? " timeline-booking-mine" : ""}${activeBooking === booking.id ? " timeline-booking-active" : ""}`}
                    style={{
                      top: `${position.top}px`,
                      height: `${position.height}px`,
                    }}
                    aria-label={`${isMine ? "Booking saya" : `Dipesan oleh ${booking.bookedBy}`}, ${booking.startTime} sampai ${booking.endTime}`}
                    title={`${isMine ? "Booking saya" : booking.bookedBy} · ${booking.startTime}-${booking.endTime}`}
                    onClick={() =>
                      setActiveBooking(activeBooking === booking.id ? null : booking.id)
                    }
                    onBlur={() => setActiveBooking(null)}
                  >
                    <strong>{isMine ? "Booking saya" : booking.bookedBy}</strong>
                    <span>
                      {booking.startTime}-{booking.endTime}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTimelineDate(date: string) {
  const parsed = parseISODate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parsed);
}
