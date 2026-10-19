import { useAuth } from "@clerk/react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { RoomCard } from "../components/room-card";
import { ApiError, apiRequest } from "../lib/api";
import {
  addFacilityTags,
  buildRoomLocation,
  buildRoomMutationPayload,
  createDefaultRoomForm,
  FACILITY_SUGGESTIONS,
  getRoomCloseTimeOptions,
  getRoomOpenTimeOptions,
  mapRoomApiErrors,
  removeFacilityTag,
  roomToFormState,
  validateRoomForm,
  type RoomFormErrors,
  type RoomFormState,
} from "../lib/admin-room-form";
import type { Room } from "../lib/room-filters";
import "./room-form-page.css";

function RoomFormSkeleton() {
  return (
    <div className="admin-room-form-skeleton" role="status" aria-label="Memuat data ruangan">
      <span /><span /><span /><span /><span /><span />
    </div>
  );
}

function AdminFormError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="admin-form-error" role="alert">
      <span aria-hidden="true">!</span><p>{message}</p>
      {onRetry && <button type="button" className="button button-outline" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}

export function RoomFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id = "" } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RoomFormState>(createDefaultRoomForm);
  const [baseline, setBaseline] = useState(() => JSON.stringify(createDefaultRoomForm()));
  const [loadedKey, setLoadedKey] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<RoomFormErrors>({});
  const [bannerError, setBannerError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof RoomFormState, boolean>>>({});
  const [facilityAnnouncement, setFacilityAnnouncement] = useState("");
  const saveInProgress = useRef(false);
  const isEdit = mode === "edit";
  const requestKey = `${id}:${loadAttempt}`;
  const loaded = !isEdit || loadedKey === requestKey;
  const validationErrors = useMemo(() => validateRoomForm(form), [form]);
  const isDirty = loaded && JSON.stringify(form) !== baseline;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!isEdit) return;
    const controller = new AbortController();
    void apiRequest<Room>(`/rooms/${encodeURIComponent(id)}`, () => getToken(), { signal: controller.signal })
      .then((room) => {
        if (controller.signal.aborted) return;
        const nextForm = roomToFormState(room);
        setBaseline(JSON.stringify(nextForm));
        setForm(nextForm);
        setLoadError(null);
        setLoadedKey(requestKey);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          navigate("/sign-in", { replace: true });
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          navigate("/403", { replace: true });
          return;
        }
        setLoadError(error instanceof Error ? error : new Error("Data ruangan tidak dapat dimuat."));
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [getToken, id, isEdit, requestKey, navigate]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const shouldLeave = window.confirm("Perubahan belum disimpan. Tinggalkan halaman ini?");
    if (shouldLeave) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!isDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [isDirty]);

  const update = <K extends keyof RoomFormState>(field: K, value: RoomFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
    setBannerError("");
    setRetryable(false);
  };

  const showError = (field: keyof RoomFormState) =>
    serverErrors[field] ?? (touched[field] ? validationErrors[field] : undefined);

  const submit = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    if (saveInProgress.current) return;
    const errors = validateRoomForm(form);
    setTouched({
      name: true,
      type: true,
      building: true,
      floor: true,
      capacity: true,
      openTime: true,
      closeTime: true,
      facilityDraft: true,
      image: true,
      notes: true,
    });
    setServerErrors({});
    if (Object.keys(errors).length) return;
    saveInProgress.current = true;
    const payload = buildRoomMutationPayload(form);
    setSaving(true);
    setBannerError("");
    setRetryable(false);
    try {
      const savedRoom = await apiRequest<Room>(
        isEdit ? `/rooms/${encodeURIComponent(id)}` : "/rooms",
        () => getToken(),
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      const nextForm = roomToFormState(savedRoom);
      setBaseline(JSON.stringify(nextForm));
      setForm(nextForm);
      navigate("/admin/rooms", {
        replace: true,
        state: { roomToast: `Ruangan "${savedRoom.name}" berhasil ${isEdit ? "diperbarui" : "ditambahkan"}.` },
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        navigate("/sign-in", { replace: true });
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        navigate("/403", { replace: true });
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setLoadError(error);
        return;
      }
      if (error instanceof ApiError && error.status === 422) {
        setServerErrors(mapRoomApiErrors(error.errors));
        setBannerError(error.message);
        return;
      }
      setBannerError(error instanceof Error ? error.message : "Ruangan tidak dapat disimpan.");
      setRetryable(!(error instanceof ApiError) || error.status >= 500);
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }, [form, getToken, id, isEdit, navigate]);

  const retrySave = () => {
    void submit();
  };

  const title = isEdit ? "Edit Ruangan" : "Tambah Ruangan";
  if (isEdit && !loaded) return <section className="room-form-page"><RoomFormSkeleton /></section>;
  if (loadError instanceof ApiError && loadError.status === 404) {
    return (
      <section className="admin-room-not-found">
        <span aria-hidden="true">?</span><h1>Ruangan tidak ditemukan</h1>
        <p>Ruangan yang akan diedit sudah tidak tersedia.</p>
        <button className="button button-primary" type="button" onClick={() => navigate("/admin/rooms")}>Kembali ke Kelola Ruangan</button>
      </section>
    );
  }
  if (loadError) {
    return (
      <section className="room-form-page">
        <AdminFormError message={loadError.message} onRetry={() => setLoadAttempt((value) => value + 1)} />
      </section>
    );
  }

  const openTimes = getRoomOpenTimeOptions();
  const closeTimes = getRoomCloseTimeOptions(form.openTime);
  const location = buildRoomLocation(form.type, form.building, form.floor);
  const previewRoom: Room = {
    id: id || "preview",
    name: form.name.trim() || "Nama Ruangan",
    type: form.type,
    capacity: Number(form.capacity) || 0,
    building: form.type === "ONLINE" ? null : form.building.trim() || null,
    floor: form.type === "ONLINE" ? null : form.floor === "" ? null : Number(form.floor),
    location: location || "Lokasi akan tampil di sini",
    facilities: form.facilities,
    image: form.image.trim() || null,
    notes: form.notes.trim() || null,
    openTime: form.openTime,
    closeTime: form.closeTime,
  };
  const formValid = Object.keys(validationErrors).length === 0;

  const addFacilities = (rawValue: string) => {
    const tags = rawValue.split(",");
    const tooLong = tags.find((tag) => tag.trim().length > 30);
    if (tooLong) {
      setServerErrors((current) => ({ ...current, facilityDraft: "Fasilitas maksimal 30 karakter." }));
      return;
    }
    const result = addFacilityTags(form.facilities, rawValue);
    setFacilityAnnouncement(
      result.length > form.facilities.length
        ? `Fasilitas ditambahkan: ${result.slice(form.facilities.length).join(", ")}`
        : "Fasilitas sudah ada.",
    );
    update("facilities", result);
    update("facilityDraft", "");
  };

  const facilityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (form.facilityDraft.trim()) addFacilities(form.facilityDraft);
    }
  };

  return (
    <section className="room-form-page">
      <div className="room-form-breadcrumb">
        <button type="button" onClick={() => navigate("/admin/rooms")}>Kelola Ruangan</button>
        <span aria-hidden="true">›</span><span aria-current="page">{title}</span>
      </div>
      <header className="room-form-heading">
        <div><p className="admin-rooms-eyebrow">PENGATURAN FASILITAS</p><h1>{title}</h1><p>{isEdit ? "Perbarui informasi dan fasilitas ruangan." : "Lengkapi informasi untuk menambahkan ruang rapat."}</p></div>
      </header>

      {bannerError && <AdminFormError message={bannerError} onRetry={retryable ? retrySave : undefined} />}

      <div className="room-form-layout">
        <form className="room-admin-form" onSubmit={submit} noValidate>
          <section className="room-form-section">
            <div className="room-form-section-heading"><span>01</span><div><h2>Informasi Ruangan</h2><p>Nama dan jenis ruangan rapat.</p></div></div>
            <div className="room-form-grid">
              <div className="room-admin-field room-admin-field-wide">
                <label htmlFor="room-name">Nama ruangan <span aria-hidden="true">*</span></label>
                <input id="room-name" value={form.name} maxLength={100} aria-invalid={Boolean(showError("name"))} aria-describedby="room-name-error" onBlur={() => setTouched((current) => ({ ...current, name: true }))} onChange={(event) => update("name", event.target.value)} />
                {showError("name") && <p id="room-name-error" className="room-field-error" role="alert">{showError("name")}</p>}
              </div>
              <div className="room-admin-field">
                <label htmlFor="room-type">Tipe ruangan <span aria-hidden="true">*</span></label>
                <select id="room-type" value={form.type} onChange={(event) => {
                  const type = event.target.value as RoomFormState["type"];
                  update("type", type);
                  if (type === "ONLINE") {
                    update("building", "");
                    update("floor", "");
                  }
                }}>
                  <option value="ONSITE">Onsite</option><option value="ONLINE">Online</option>
                </select>
              </div>
              <div className="room-admin-field">
                <label htmlFor="room-capacity">Kapasitas (maks. orang) <span aria-hidden="true">*</span></label>
                <input id="room-capacity" type="number" min={1} max={500} step={1} value={form.capacity} inputMode="numeric" aria-invalid={Boolean(showError("capacity"))} aria-describedby="room-capacity-error" onBlur={() => setTouched((current) => ({ ...current, capacity: true }))} onChange={(event) => update("capacity", event.target.value)} />
                {showError("capacity") && <p id="room-capacity-error" className="room-field-error" role="alert">{showError("capacity")}</p>}
              </div>
              {form.type === "ONSITE" && (
                <>
                  <div className="room-admin-field">
                    <label htmlFor="room-building">Gedung <span aria-hidden="true">*</span></label>
                    <input id="room-building" maxLength={50} value={form.building} aria-invalid={Boolean(showError("building"))} aria-describedby="room-building-error" onBlur={() => setTouched((current) => ({ ...current, building: true }))} onChange={(event) => update("building", event.target.value)} />
                    {showError("building") && <p id="room-building-error" className="room-field-error" role="alert">{showError("building")}</p>}
                  </div>
                  <div className="room-admin-field">
                    <label htmlFor="room-floor">Lantai <span aria-hidden="true">*</span></label>
                    <input id="room-floor" type="number" min={0} max={100} step={1} inputMode="numeric" value={form.floor} aria-invalid={Boolean(showError("floor"))} aria-describedby="room-floor-error" onBlur={() => setTouched((current) => ({ ...current, floor: true }))} onChange={(event) => update("floor", event.target.value)} />
                    {showError("floor") && <p id="room-floor-error" className="room-field-error" role="alert">{showError("floor")}</p>}
                  </div>
                </>
              )}
              <div className="room-admin-field room-admin-field-wide">
                <label htmlFor="room-location">Lokasi</label>
                <input id="room-location" readOnly value={location || "Isi gedung dan lantai untuk melihat lokasi"} />
                <span className="room-field-hint">Lokasi dibuat otomatis dan tidak dikirim ke API.</span>
              </div>
            </div>
          </section>

          <section className="room-form-section">
            <div className="room-form-section-heading"><span>02</span><div><h2>Jam Operasional</h2><p>Gunakan jam tepat sesuai operasional ruangan.</p></div></div>
            <div className="room-form-grid">
              <div className="room-admin-field">
                <label htmlFor="room-open">Jam buka <span aria-hidden="true">*</span></label>
                <select id="room-open" value={form.openTime} aria-invalid={Boolean(showError("openTime"))} onBlur={() => setTouched((current) => ({ ...current, openTime: true }))} onChange={(event) => {
                  const openTime = event.target.value;
                  const options = getRoomCloseTimeOptions(openTime);
                  update("openTime", openTime);
                  if (form.closeTime <= openTime) update("closeTime", options[0] ?? "");
                }}>
                  {openTimes.map((time) => <option key={time}>{time}</option>)}
                </select>
                {showError("openTime") && <p className="room-field-error" role="alert">{showError("openTime")}</p>}
              </div>
              <div className="room-admin-field">
                <label htmlFor="room-close">Jam tutup <span aria-hidden="true">*</span></label>
                <select id="room-close" value={form.closeTime} aria-invalid={Boolean(showError("closeTime"))} onBlur={() => setTouched((current) => ({ ...current, closeTime: true }))} onChange={(event) => update("closeTime", event.target.value)}>
                  <option value="">Pilih jam tutup</option>
                  {closeTimes.map((time) => <option key={time}>{time}</option>)}
                </select>
                {showError("closeTime") && <p className="room-field-error" role="alert">{showError("closeTime")}</p>}
              </div>
            </div>
          </section>

          <section className="room-form-section">
            <div className="room-form-section-heading"><span>03</span><div><h2>Fasilitas & Detail</h2><p>Fasilitas, gambar, dan catatan ruangan.</p></div></div>
            <div className="room-admin-field">
              <label htmlFor="room-facilities">Fasilitas</label>
              <input id="room-facilities" value={form.facilityDraft} placeholder="Ketik fasilitas lalu tekan Enter atau koma" aria-invalid={Boolean(showError("facilityDraft"))} onBlur={() => {
                if (form.facilityDraft.trim()) setTouched((current) => ({ ...current, facilityDraft: true }));
              }} onKeyDown={facilityKeyDown} onChange={(event) => update("facilityDraft", event.target.value)} />
              {form.facilityDraft && <button type="button" className="room-add-tag-button" onClick={() => addFacilities(form.facilityDraft)}>Tambah fasilitas</button>}
              {showError("facilityDraft") && <p className="room-field-error" role="alert">{showError("facilityDraft")}</p>}
              <div className="room-facility-suggestions" aria-label="Saran fasilitas">
                {FACILITY_SUGGESTIONS.map((facility) => (
                  <button type="button" key={facility} disabled={form.facilities.some((current) => current.toLocaleLowerCase("id-ID") === facility.toLocaleLowerCase("id-ID"))} onClick={() => addFacilities(facility)}>＋ {facility}</button>
                ))}
              </div>
              {form.facilities.length > 0 ? (
                <ul className="room-edit-facility-chips">
                  {form.facilities.map((facility) => (
                    <li key={facility}>{facility}<button type="button" aria-label={`Hapus fasilitas ${facility}`} onClick={() => {
                      update("facilities", removeFacilityTag(form.facilities, facility));
                      setFacilityAnnouncement(`Fasilitas dihapus: ${facility}`);
                    }}>×</button></li>
                  ))}
                </ul>
              ) : <p className="room-facility-empty">Belum ada fasilitas yang ditambahkan.</p>}
              <span className="visually-hidden" role="status" aria-live="polite">{facilityAnnouncement}</span>
            </div>

            <div className="room-admin-field">
              <label htmlFor="room-image">URL gambar <span>(opsional)</span></label>
              <input id="room-image" type="url" inputMode="url" maxLength={255} value={form.image} placeholder="https://contoh.com/ruangan.jpg" aria-invalid={Boolean(showError("image"))} aria-describedby="room-image-error" onBlur={() => setTouched((current) => ({ ...current, image: true }))} onChange={(event) => update("image", event.target.value)} />
              {showError("image") && <p id="room-image-error" className="room-field-error" role="alert">{showError("image")}</p>}
            </div>

            <div className="room-admin-field">
              <label htmlFor="room-notes">Catatan khusus <span>(opsional)</span></label>
              <textarea id="room-notes" rows={3} maxLength={200} value={form.notes} aria-invalid={Boolean(showError("notes"))} onBlur={() => setTouched((current) => ({ ...current, notes: true }))} onChange={(event) => update("notes", event.target.value)} />
              <div className="room-notes-meta">{showError("notes") && <p className="room-field-error" role="alert">{showError("notes")}</p>}<span>{form.notes.length}/200</span></div>
            </div>
          </section>

          <div className="room-form-actions">
            <button type="button" className="button button-outline" onClick={() => navigate("/admin/rooms")}>Batal</button>
            <button type="submit" className="button button-primary" disabled={!formValid || saving}>
              {saving ? <><span className="admin-button-spinner" aria-hidden="true" /> Menyimpan...</> : "Simpan"}
            </button>
          </div>
          {saving && <p className="visually-hidden" role="status" aria-live="polite">Menyimpan ruangan.</p>}
        </form>

        <aside className="room-live-preview">
          <div className="room-preview-heading"><p className="admin-rooms-eyebrow">PRATINJAU LANGSUNG</p><h2>Kartu Ruangan</h2><p>Tampilan ruangan pada halaman Ruang Rapat.</p></div>
          <RoomCard key={form.image} room={previewRoom} isAdmin previewOnly scheduleSelected={false} />
        </aside>
      </div>
    </section>
  );
}
