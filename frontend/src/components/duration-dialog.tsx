import { useEffect, useRef, type RefObject } from "react";
import {
  formatDurationLabel,
  getEndOptions,
} from "../lib/room-filters";

type DurationDialogProps = {
  starts: string[];
  ends: string[];
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onCancel: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export function DurationDialog({
  starts,
  ends,
  start,
  end,
  onStartChange,
  onEndChange,
  onApply,
  onClear,
  onCancel,
  triggerRef,
}: DurationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const startSelectRef = useRef<HTMLSelectElement>(null);
  const endChoices = getEndOptions(start, ends);
  const durationIsValid =
    Boolean(start && end) && endChoices.includes(end);

  useEffect(() => {
    const trigger = triggerRef.current;
    startSelectRef.current?.focus();
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [onCancel, triggerRef]);

  return (
    <div className="duration-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div
        ref={dialogRef}
        className="duration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duration-dialog-title"
      >
        <div className="duration-dialog-heading">
          <div>
            <p className="eyebrow">JADWAL PEMAKAIAN</p>
            <h2 id="duration-dialog-title">Durasi</h2>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Tutup popup durasi"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <p className="duration-dialog-description">
          Pilih jam mulai dan selesai. Durasi minimal satu jam.
        </p>
        <div className="duration-selects">
          <label>
            <span>Start</span>
            <select
              ref={startSelectRef}
              value={start}
              onChange={(event) => onStartChange(event.target.value)}
            >
              {starts.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
          <span className="duration-divider" aria-hidden="true">
            —
          </span>
          <label>
            <span>End</span>
            <select
              value={end}
              onChange={(event) => onEndChange(event.target.value)}
            >
              {endChoices.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="duration-preview" aria-live="polite">
          {durationIsValid ? formatDurationLabel(start, end) : "Pilih rentang waktu"}
        </p>
        <div className="duration-dialog-actions">
          <button type="button" className="button button-text" onClick={onClear}>
            Hapus Durasi
          </button>
          <div className="duration-action-group">
            <button type="button" className="button button-outline" onClick={onCancel}>
              Batal
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!durationIsValid}
              onClick={onApply}
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
