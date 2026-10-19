import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiRequest } from "../lib/api";
import type { Room } from "../lib/room-filters";
import "./admin-rooms-page.css";

function RoomSearch({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => onSearch(draft.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [draft, onSearch]);

  return (
    <label className="admin-room-search">
      <span>Cari nama ruangan</span>
      <input
        type="search"
        value={draft}
        placeholder="Contoh: Ruang Alpha"
        onChange={(event) => setDraft(event.target.value)}
      />
    </label>
  );
}

function RoomTableSkeleton() {
  return (
    <div className="admin-room-table-wrap" aria-label="Memuat daftar ruangan">
      <table className="admin-room-table" aria-hidden="true">
        <thead>
          <tr>{["No", "Nama", "Gedung", "Lantai", "Kapasitas", "Fasilitas", "Jam Operasional", "Aksi"].map((label) => <th key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>{Array.from({ length: 5 }, (_, row) => <tr key={row}>{Array.from({ length: 8 }, (_, cell) => <td key={cell}><span className="admin-table-skeleton-line" /></td>)}</tr>)}</tbody>
      </table>
      <span className="visually-hidden" role="status">Memuat daftar ruangan</span>
    </div>
  );
}

export function AdminRoomsPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadedAttempt, setLoadedAttempt] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [toast, setToast] = useState(
    (location.state as { roomToast?: string } | null)?.roomToast ?? "",
  );
  const addButtonRef = useRef<HTMLAnchorElement>(null);
  const loading = loadedAttempt !== attempt;

  const loadRooms = useCallback(() => setAttempt((current) => current + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<Room[]>("/rooms", () => getToken(), { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRooms(data);
        setError(null);
        setLoadedAttempt(attempt);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          navigate("/sign-in", { replace: true });
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 403) {
          navigate("/403", { replace: true });
          return;
        }
        setError(requestError instanceof Error ? requestError : new Error("Daftar ruangan tidak dapat dimuat."));
        setLoadedAttempt(attempt);
      });
    return () => controller.abort();
  }, [attempt, getToken, navigate]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5000);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, navigate, toast]);

  const updateSearch = useCallback((value: string) => {
    if ((searchParams.get("q") ?? "") === value) return;
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return rooms
      .filter((room) => room.name.toLocaleLowerCase("id-ID").includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  }, [rooms, search]);

  const deleteRequest = (room: Room, trigger: HTMLButtonElement) => {
    deleteTriggerRef.current = trigger;
    setDeleteRoom(room);
  };

  return (
    <section className="admin-rooms-page">
      <div className="admin-rooms-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Beranda</Link><span aria-hidden="true">›</span><span aria-current="page">Kelola Ruangan</span>
      </div>
      <header className="admin-rooms-heading">
        <div>
          <p className="admin-rooms-eyebrow">PENGATURAN FASILITAS</p>
          <h1>Kelola Ruangan</h1>
          <p>Atur informasi ruang rapat dan fasilitas yang tersedia.</p>
        </div>
        <Link ref={addButtonRef} className="button button-primary admin-add-room" to="/admin/rooms/new">
          <span aria-hidden="true">＋</span> Tambah Ruangan
        </Link>
      </header>

      {toast && <div className="admin-room-toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}</div>}
      {error && (
        <div className="admin-room-error" role="alert">
          <span aria-hidden="true">!</span><p>{error.message}</p>
          <button type="button" className="button button-outline" onClick={loadRooms}>Coba lagi</button>
        </div>
      )}

      <section className="admin-room-list-panel" aria-label="Daftar ruangan">
        <div className="admin-room-list-toolbar">
          <RoomSearch key={search} value={search} onSearch={updateSearch} />
          {!loading && !error && <p className="admin-room-total">Total: <strong>{filteredRooms.length}</strong> ruangan</p>}
        </div>
        {loading ? (
          <RoomTableSkeleton />
        ) : error ? null : rooms.length === 0 ? (
          <div className="admin-room-empty">
            <span aria-hidden="true">▦</span><h2>Belum ada ruangan</h2>
            <p>Tambahkan ruangan agar dapat mulai dikelola.</p>
            <Link className="button button-primary" to="/admin/rooms/new">Tambah Ruangan</Link>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="admin-room-empty admin-room-no-match">
            <span aria-hidden="true">⌕</span><h2>Tidak ada ruangan yang cocok</h2>
            <p>Coba ubah kata pencarian.</p>
          </div>
        ) : (
          <div className="admin-room-table-wrap">
            <table className="admin-room-table">
              <thead>
                <tr>
                  <th scope="col">No</th><th scope="col">Nama</th><th scope="col">Gedung</th>
                  <th scope="col">Lantai</th><th scope="col">Kapasitas</th><th scope="col">Fasilitas</th>
                  <th scope="col">Jam Operasional</th><th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room, index) => {
                  const online = room.type.toUpperCase() === "ONLINE";
                  return (
                    <tr key={room.id}>
                      <td data-label="No">{index + 1}</td>
                      <td data-label="Nama"><strong className="admin-room-name">{room.name}</strong></td>
                      <td data-label="Gedung">{online ? "-" : room.building || "-"}</td>
                      <td data-label="Lantai">{online || room.floor === null || room.floor === undefined ? "-" : room.floor}</td>
                      <td data-label="Kapasitas">{room.capacity} orang</td>
                      <td data-label="Fasilitas">
                        {room.facilities?.length ? (
                          <ul className="admin-facility-chips">{room.facilities.map((facility) => <li key={facility}>{facility}</li>)}</ul>
                        ) : <span className="admin-table-muted">Tidak disebutkan</span>}
                      </td>
                      <td data-label="Jam Operasional" className="admin-hours-cell">{room.openTime} - {room.closeTime}</td>
                      <td data-label="Aksi">
                        <div className="admin-room-actions">
                          <Link className="admin-edit-link" to={`/admin/rooms/${room.id}/edit`} aria-label={`Edit ${room.name}`}>Edit</Link>
                          <button type="button" className="admin-delete-link" onClick={(event) => deleteRequest(room, event.currentTarget)} aria-label={`Hapus ${room.name}`}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {deleteRoom && (
        <RoomManagementDeleteDialog
          room={deleteRoom}
          onClose={() => {
            setDeleteRoom(null);
            window.requestAnimationFrame(() => {
              if (deleteTriggerRef.current?.isConnected) deleteTriggerRef.current.focus();
              else addButtonRef.current?.focus();
            });
          }}
          onDeleted={() => {
            setDeleteRoom(null);
            setToast(`Ruangan "${deleteRoom.name}" berhasil dihapus.`);
            loadRooms();
          }}
          onNotFound={() => {
            setToast(`Ruangan "${deleteRoom.name}" sudah tidak ada.`);
            loadRooms();
          }}
        />
      )}
    </section>
  );
}

export function RoomManagementDeleteDialog({
  room,
  onClose,
  onDeleted,
  onNotFound,
}: {
  room: Room;
  onClose: () => void;
  onDeleted: () => void;
  onNotFound: () => void;
}) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (event.shiftKey && document.activeElement === focusable[0]) {
      event.preventDefault();
      focusable.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  };

  const deleteRoom = async () => {
    setBusy(true);
    setError("");
    setCanRetry(false);
    try {
      await apiRequest<{ id: number }>("/rooms/" + encodeURIComponent(String(room.id)), () => getToken(), { method: "DELETE" });
      onDeleted();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        navigate("/sign-in", { replace: true });
        return;
      }
      if (requestError instanceof ApiError && requestError.status === 403) {
        navigate("/403", { replace: true });
        return;
      }
      if (requestError instanceof ApiError && requestError.status === 404) {
        setError("Ruangan sudah tidak ada.");
        onNotFound();
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Ruangan tidak dapat dihapus.");
      setCanRetry(!(requestError instanceof ApiError) || requestError.status >= 500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div ref={dialogRef} className="admin-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-room-title" aria-busy={busy} onKeyDown={handleKeyDown}>
        <span className="admin-confirm-icon" aria-hidden="true">!</span>
        <h2 id="delete-room-title">Hapus Ruangan</h2>
        <p>Apakah Anda yakin ingin menghapus <strong>{room.name}</strong>? Tindakan ini tidak dapat dibatalkan.</p>
        {error && <div className="admin-dialog-error" role="alert"><p>{error}</p>{canRetry && <button type="button" className="admin-dialog-retry" disabled={busy} onClick={() => void deleteRoom()}>Coba lagi</button>}</div>}
        <div className="admin-confirm-actions">
          <button ref={cancelRef} type="button" className="button button-outline" disabled={busy} onClick={onClose}>Batal</button>
          <button type="button" className="button admin-confirm-delete" disabled={busy} onClick={() => void deleteRoom()}>{busy ? "Menghapus..." : "Hapus"}</button>
        </div>
        {busy && <span className="visually-hidden" role="status" aria-live="polite">Sedang menghapus ruangan.</span>}
      </div>
    </div>
  );
}
