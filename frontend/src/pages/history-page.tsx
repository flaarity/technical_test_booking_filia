import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiRequest } from "../lib/api";
import {
  formatBookingDate,
  formatBookingWeekday,
  getHistoryRowNumber,
} from "../lib/booking-flow";
import "./history-page.css";

type BookingHistoryItem = {
  id: number | string;
  code: string;
  roomName: string;
  date: string;
  hari: string;
  startTime: string;
  endTime: string;
  status: "Akan Datang" | "Sedang Berlangsung" | "Selesai";
  description: string | null;
};

type BookingHistoryResponse = {
  items: BookingHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const PAGE_SIZE = 10;

function getPageParam(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function HistorySkeleton() {
  return (
    <div className="history-table-wrap" aria-label="Memuat riwayat pemesanan">
      <table className="history-table history-table-skeleton" aria-hidden="true">
        <thead>
          <tr>
            {["No", "Ruangan", "Hari", "Tanggal", "Mulai", "Selesai", "Status", "Keterangan"].map((item) => (
              <th key={item}>{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: 8 }, (_, cell) => (
                <td key={cell}><span /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="visually-hidden" role="status">Memuat riwayat pemesanan</span>
    </div>
  );
}

function HistoryError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="history-error-banner" role="alert">
      <span aria-hidden="true">!</span>
      <p>{error.message}</p>
      <button type="button" className="button button-outline" onClick={retry}>
        Coba lagi
      </button>
    </div>
  );
}

export function HistoryPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = getPageParam(searchParams.get("page"));
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [result, setResult] = useState<BookingHistoryResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const requestKey = `${page}:${attempt}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    void apiRequest<BookingHistoryResponse>(
      `/bookings/me?${params.toString()}`,
      () => getToken(),
      { signal: controller.signal },
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setResult(response);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setResult(null);
        if (requestError instanceof ApiError && requestError.status === 401) {
          navigate("/sign-in", { replace: true });
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 403) {
          navigate("/403", { replace: true });
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError
            : new Error("Riwayat pemesanan tidak dapat dimuat."),
        );
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [attempt, getToken, navigate, page, requestKey]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const changePage = useCallback((nextPage: number) => {
    setSearchParams(nextPage <= 1 ? {} : { page: String(nextPage) });
  }, [setSearchParams]);
  const pagination = result?.pagination;
  const pageLabel = useMemo(
    () => `Halaman ${pagination?.page ?? page} dari ${Math.max(1, pagination?.totalPages ?? 1)}`,
    [page, pagination?.page, pagination?.totalPages],
  );

  return (
    <section className="history-page">
      <div className="history-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Beranda</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Riwayat</span>
      </div>
      <header className="history-heading">
        <div>
          <p className="history-eyebrow">PEMESANAN SAYA</p>
          <h1>Riwayat Pemesanan</h1>
          <p className="history-subtitle">Daftar pemesanan ruang rapat Anda.</p>
        </div>
        {pagination && <span className="history-total">{pagination.total} pemesanan</span>}
      </header>

      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        <HistoryError error={error} retry={retry} />
      ) : !result?.items.length ? (
        <div className="history-empty">
          <span className="history-empty-icon" aria-hidden="true">▤</span>
          <h2>Belum ada riwayat pemesanan</h2>
          <p>Pemesanan ruang rapat Anda akan muncul di sini.</p>
          <Link className="button button-primary" to="/rooms">Lihat Ruang Rapat</Link>
        </div>
      ) : (
        <>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">No</th>
                  <th scope="col">Ruangan</th>
                  <th scope="col">Hari</th>
                  <th scope="col">Tanggal</th>
                  <th scope="col">Mulai</th>
                  <th scope="col">Selesai</th>
                  <th scope="col">Status</th>
                  <th scope="col">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((booking, index) => (
                  <tr key={booking.id}>
                    <td data-label="No">{getHistoryRowNumber(pagination?.page ?? page, pagination?.limit ?? PAGE_SIZE, index)}</td>
                    <td data-label="Ruangan" className="history-room-name">
                      <strong>{booking.roomName}</strong>
                      <span>{booking.code}</span>
                    </td>
                    <td data-label="Hari" className="history-capitalize">{formatBookingWeekday(booking.date) || booking.hari}</td>
                    <td data-label="Tanggal">{formatBookingDate(booking.date)}</td>
                    <td data-label="Mulai">{booking.startTime}</td>
                    <td data-label="Selesai">{booking.endTime}</td>
                    <td data-label="Status">
                      <span className={`history-status status-${booking.status === "Akan Datang" ? "upcoming" : booking.status === "Sedang Berlangsung" ? "ongoing" : "finished"}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td data-label="Keterangan" className="history-description">
                      {booking.description?.trim() || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="history-pagination" aria-label="Paginasi riwayat">
            <button
              type="button"
              className="button button-outline"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
            >
              Sebelumnya
            </button>
            <span aria-live="polite">{pageLabel} · {pagination?.total ?? 0} pemesanan</span>
            <button
              type="button"
              className="button button-outline"
              disabled={page >= (pagination?.totalPages ?? 0)}
              onClick={() => changePage(page + 1)}
            >
              Berikutnya
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
