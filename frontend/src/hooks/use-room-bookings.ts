import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";
import { getMonthKey, getMonthRange, type RoomBooking } from "../lib/room-schedule";

const monthCache = new Map<string, RoomBooking[]>();

type BookingResult = {
  bookings: RoomBooking[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

function useBookingsRequest(
  roomId: string,
  from: string,
  to: string,
  cacheKey?: string,
): BookingResult {
  const { getToken } = useAuth();
  const [requestVersion, setRequestVersion] = useState(0);
  const cached = cacheKey ? monthCache.get(cacheKey) : undefined;
  const [bookings, setBookings] = useState<RoomBooking[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);
  const [loadedKey, setLoadedKey] = useState(cached ? cacheKey : undefined);
  const currentKey = `${roomId}|${from}|${to}`;
  const reload = useCallback(() => {
    if (cacheKey) monthCache.delete(cacheKey);
    setLoading(true);
    setError(null);
    setRequestVersion((version) => version + 1);
  }, [cacheKey]);

  useEffect(() => {
    const key = cacheKey ?? currentKey;
    const controller = new AbortController();
    const existing = cacheKey ? monthCache.get(cacheKey) : undefined;
    if (existing && requestVersion === 0) {
      queueMicrotask(() => {
        if (controller.signal.aborted) return;
        setBookings(existing);
        setLoadedKey(key);
        setLoading(false);
        setError(null);
      });
      return () => controller.abort();
    }

    const params = new URLSearchParams({ roomId, from, to });
    void apiRequest<RoomBooking[]>(
      `/bookings?${params.toString()}`,
      () => getToken(),
      { signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (cacheKey) monthCache.set(cacheKey, result);
        setBookings(result);
        setLoadedKey(key);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError
            : new Error("Data booking tidak dapat dimuat."),
        );
        setLoadedKey(key);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cacheKey, currentKey, from, getToken, requestVersion, roomId, to]);

  const resultKey = cacheKey ?? currentKey;
  const visibleBookings = loadedKey === resultKey ? bookings : [];
  const visibleLoading = loading || loadedKey !== resultKey;
  return {
    bookings: visibleBookings,
    loading: visibleLoading,
    error: loadedKey === resultKey ? error : null,
    reload,
  };
}

export function useMonthlyRoomBookings(
  roomId: string,
  year: number,
  monthIndex: number,
) {
  const range = useMemo(() => getMonthRange(year, monthIndex), [monthIndex, year]);
  const cacheKey = `${roomId}|${getMonthKey(range.from)}`;
  return useBookingsRequest(roomId, range.from, range.to, cacheKey);
}

export function useRoomBookings(roomId: string, from: string, to: string) {
  return useBookingsRequest(roomId, from, to);
}
