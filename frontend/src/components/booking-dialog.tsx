import { useAuth } from "@clerk/react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import type { Worker } from "../context/worker-context";
import {
  findAvailableStartingSlot,
  getDurationMinutes,
  mapApiFieldErrors,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormValues,
  type BookingSlot,
} from "../lib/booking-flow";
import { ApiError, apiRequest } from "../lib/api";
import { formatLongJakartaDate } from "../lib/room-schedule";
import type { Room } from "../lib/room-filters";
import "./booking-dialog.css";

export type BookingSchedule = {
  roomId: number | string;
  date: string;
  startTime: string;
  endTime: string;
};

export type BookingSuccess = {
  code: string;
  roomId: number;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  participants: number;
  description: string | null;
};

type Props = {
  room: Room;
  worker: Worker;
  schedule: BookingSchedule;
  onClose: (refreshTimeline: boolean) => void;
  onSuccess: () => void;
  onUnavailable: () => void;
  onEditSchedule: () => void;
};

const initialValues: BookingFormValues = { participants: "", description: "" };

export function BookingDialog({
  room,
  worker,
  schedule,
  onClose,
  onSuccess,
  onUnavailable,
  onEditSchedule,
}: Props) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"details" | "confirmation" | "success">("details");
  const [successResult, setSuccessResult] = useState<BookingSuccess | null>(null);
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<BookingFormErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const durationMinutes = getDurationMinutes(schedule.startTime, schedule.endTime);
  const validationErrors = validateBookingForm(values, room.capacity);
  const formValid = Object.keys(validationErrors).length === 0;
  const changed = Boolean(values.participants || values.description);

  useEffect(() => {
    initialFocusRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const requestClose = () => {
    if (busy) return;
    if (step !== "success" && changed && !window.confirm("Tutup pemesanan? Isian yang sudah dimasukkan akan hilang.")) {
      return;
    }
    onClose(conflict);
  };

  const requestEditSchedule = () => {
    if (busy) return;
    if (changed && !window.confirm("Kembali ke timeline? Isian pemesan akan hilang.")) {
      return;
    }
    onEditSchedule();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]',
      ),
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateField = (field: keyof BookingFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setErrorMessage("");
  };

  const submitBooking = async (event?: FormEvent) => {
    event?.preventDefault();
    const errors = validateBookingForm(values, room.capacity);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setStep("details");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setRetryable(false);
    try {
      const params = new URLSearchParams({
        roomId: String(schedule.roomId),
        date: schedule.date,
      });
      const slots = await apiRequest<BookingSlot[]>(
        `/slots?${params.toString()}`,
        () => getToken(),
      );
      const slot = findAvailableStartingSlot(slots, schedule.startTime);
      if (!slot) {
        setErrorMessage("Slot waktu tersebut sudah tidak tersedia. Silakan pilih jadwal lain.");
        onUnavailable();
        return;
      }

      const body = {
        roomId: Number(schedule.roomId),
        slotId: Number(slot.id),
        date: schedule.date,
        durationMinutes,
        participants: Number(values.participants),
        ...(values.description.trim()
          ? { description: values.description.trim() }
          : {}),
      };
      const result = await apiRequest<BookingSuccess>("/bookings", () => getToken(), {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccessResult(result);
      setStep("success");
      onSuccess();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        onClose(false);
        navigate("/sign-in", { replace: true });
        return;
      }
      if (requestError instanceof ApiError && requestError.status === 403) {
        onClose(false);
        navigate("/403", { replace: true });
        return;
      }
      if (requestError instanceof ApiError && requestError.status === 422) {
        setStep("details");
        setFieldErrors(mapApiFieldErrors(requestError.errors));
        setErrorMessage(requestError.message);
        return;
      }
      if (requestError instanceof ApiError && requestError.status === 409) {
        setConflict(true);
        setErrorMessage(requestError.message);
        if (/kapasitas|peserta/i.test(requestError.message)) {
          setStep("details");
          setFieldErrors({ participants: requestError.message });
        }
        return;
      }
      setErrorMessage(
        requestError instanceof Error
          ? requestError.message
          : "Pemesanan gagal. Silakan coba lagi.",
      );
      setRetryable(true);
    } finally {
      setBusy(false);
    }
  };

  const durationLabel = `${durationMinutes / 60} jam`;
  const summaryDate = formatLongJakartaDate(schedule.date);
  const activeStep = step === "details" ? 2 : 3;

  return (
    <div
      className="booking-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="booking-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-dialog-title"
        aria-busy={busy}
        onKeyDown={handleKeyDown}
      >
        <header className="booking-dialog-header">
          <div>
            <p className="detail-eyebrow">PEMESANAN RUANGAN</p>
            <h2 id="booking-dialog-title">
              {step === "details"
                ? "Data Pemesan"
                : step === "confirmation"
                  ? "Konfirmasi Pemesanan"
                  : "Pemesanan Berhasil"}
            </h2>
          </div>
          <button
            type="button"
            className="booking-dialog-close"
            aria-label="Tutup dialog pemesanan"
            onClick={requestClose}
            disabled={busy}
          >
            ×
          </button>
        </header>

        <ol className="booking-stepper" aria-label="Langkah pemesanan">
          {["Ruangan", "Tanggal & Jam", "Data Pemesan", "Konfirmasi"].map(
            (label, index) => {
              const completed = step === "success" || index < activeStep;
              return (
                <li
                  className={`${completed ? "step-complete" : ""}${index === activeStep && step !== "success" ? " step-current" : ""}`}
                  aria-current={index === activeStep && step !== "success" ? "step" : undefined}
                  key={label}
                >
                  <span>{completed ? "✓" : index + 1}</span>
                  <span>{label}</span>
                </li>
              );
            },
          )}
        </ol>

        {errorMessage && (
          <div className="booking-dialog-error" role="alert">
            <p>{errorMessage}</p>
            {retryable && (
              <button
                type="button"
                className="button button-outline"
                disabled={busy}
                onClick={() => void submitBooking()}
              >
                Coba lagi
              </button>
            )}
          </div>
        )}

        {step === "details" ? (
          <form className="booking-dialog-body" onSubmit={submitBooking}>
            <section className="booking-summary-card" aria-label="Ringkasan jadwal">
              <div className="booking-summary-heading">
                <h3>Ringkasan Jadwal</h3>
                <button
                  type="button"
                  className="booking-edit-link"
                  onClick={requestEditSchedule}
                >
                  Ubah
                </button>
              </div>
              <dl>
                <div><dt>Ruangan</dt><dd>{room.name}</dd></div>
                <div><dt>Tanggal</dt><dd>{summaryDate}</dd></div>
                <div><dt>Waktu</dt><dd>{schedule.startTime} - {schedule.endTime}</dd></div>
                <div><dt>Durasi</dt><dd>{durationLabel}</dd></div>
              </dl>
            </section>

            <section className="booking-contact-card" aria-labelledby="booking-contact-title">
              <h3 id="booking-contact-title">Contact Person</h3>
              <dl>
                <div><dt>ID Work</dt><dd>{worker.workerCode}</dd></div>
                <div><dt>Nama</dt><dd>{worker.name}</dd></div>
                <div><dt>Email</dt><dd>{worker.email}</dd></div>
                <div><dt>No. Telp</dt><dd>{worker.phone}</dd></div>
              </dl>
            </section>

            <div className="booking-form-field">
              <label htmlFor="booking-participants">Jumlah orang yang akan hadir</label>
              <input
                ref={initialFocusRef}
                id="booking-participants"
                type="number"
                min={1}
                max={room.capacity}
                step={1}
                inputMode="numeric"
                value={values.participants}
                aria-invalid={Boolean(fieldErrors.participants || validationErrors.participants)}
                aria-describedby="booking-participants-help booking-participants-error"
                onChange={(event) => updateField("participants", event.target.value)}
              />
              <p id="booking-participants-help">
                Ruangan ini tersedia hingga maks. {room.capacity} orang
              </p>
              {(fieldErrors.participants || validationErrors.participants) && (
                <p id="booking-participants-error" className="booking-field-error" role="alert">
                  {fieldErrors.participants || validationErrors.participants}
                </p>
              )}
            </div>

            <div className="booking-form-field">
              <label htmlFor="booking-description">Keterangan <span>(opsional)</span></label>
              <textarea
                id="booking-description"
                rows={3}
                maxLength={200}
                value={values.description}
                aria-invalid={Boolean(fieldErrors.description || validationErrors.description)}
                aria-describedby="booking-description-count booking-description-error"
                onChange={(event) => updateField("description", event.target.value)}
              />
              <div className="booking-description-meta">
                {(fieldErrors.description || validationErrors.description) && (
                  <p id="booking-description-error" className="booking-field-error" role="alert">
                    {fieldErrors.description || validationErrors.description}
                  </p>
                )}
                <span id="booking-description-count">{values.description.length}/200</span>
              </div>
            </div>

            <footer className="booking-dialog-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={requestClose}
                disabled={busy}
              >
                Batal
              </button>
              <button type="submit" className="button button-primary" disabled={!formValid || busy}>
                Lanjut
              </button>
            </footer>
          </form>
        ) : step === "confirmation" ? (
          <div className="booking-dialog-body">
            <div className="booking-confirmation-summary">
              <h3>Periksa kembali detail pemesanan</h3>
              <dl>
                <div><dt>Ruangan</dt><dd>{room.name}</dd></div>
                <div><dt>Tanggal</dt><dd>{summaryDate}</dd></div>
                <div><dt>Waktu</dt><dd>{schedule.startTime} - {schedule.endTime}</dd></div>
                <div><dt>Durasi</dt><dd>{durationLabel}</dd></div>
                <div><dt>Jumlah orang</dt><dd>{values.participants}</dd></div>
                <div><dt>Keterangan</dt><dd>{values.description.trim() || "-"}</dd></div>
              </dl>
              <section className="booking-contact-card" aria-label="Contact person pemesan">
                <h3>Contact Person</h3>
                <dl>
                  <div><dt>ID Work</dt><dd>{worker.workerCode}</dd></div>
                  <div><dt>Nama</dt><dd>{worker.name}</dd></div>
                  <div><dt>Email</dt><dd>{worker.email}</dd></div>
                  <div><dt>No. Telp</dt><dd>{worker.phone}</dd></div>
                </dl>
              </section>
            </div>
            <footer className="booking-dialog-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setStep("details");
                  setErrorMessage("");
                }}
                disabled={busy}
              >
                Kembali
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => void submitBooking()}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="booking-submit-spinner" aria-hidden="true" />
                    Mengirim...
                  </>
                ) : (
                  "Konfirmasi Pemesanan"
                )}
              </button>
            </footer>
          </div>
        ) : (
          <div className="booking-success-state" role="status" aria-live="polite">
            <span className="booking-success-icon" aria-hidden="true">✓</span>
            <h3>Pemesanan berhasil</h3>
            <p>Kode booking Anda</p>
            <strong className="booking-success-code">
              {successResult?.code || "Kode tidak tersedia"}
            </strong>
            <dl>
              <div><dt>Ruangan</dt><dd>{room.name}</dd></div>
              <div><dt>Tanggal</dt><dd>{summaryDate}</dd></div>
              <div><dt>Waktu</dt><dd>{successResult?.startTime ?? schedule.startTime} - {successResult?.endTime ?? schedule.endTime}</dd></div>
              <div><dt>Durasi</dt><dd>{durationLabel}</dd></div>
            </dl>
            <div className="booking-dialog-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  onClose(false);
                  navigate("/history");
                }}
              >
                Lihat Riwayat
              </button>
              <button type="button" className="button button-primary" onClick={() => onClose(false)}>
                Tutup
              </button>
            </div>
          </div>
        )}
        {busy && (
          <p className="visually-hidden" role="status" aria-live="polite">
            Sedang mengirim pemesanan.
          </p>
        )}
      </div>
    </div>
  );
}
