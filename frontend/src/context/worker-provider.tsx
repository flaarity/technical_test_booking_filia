import { useAuth } from "@clerk/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "../lib/api";
import type { Worker } from "./worker-context";
import { WorkerContext } from "./worker-context";

export function WorkerProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
    });

    void apiRequest<Worker>("/workers/me", () => getToken(), {
      signal: controller.signal,
    })
      .then((profile) => setWorker(profile))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setWorker(null);
        setError(
          requestError instanceof Error
            ? requestError
            : new Error("Profil worker tidak dapat dimuat."),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [attempt, getToken, isLoaded, isSignedIn]);

  return (
    <WorkerContext.Provider value={{ worker, loading, error, retry }}>
      {children}
    </WorkerContext.Provider>
  );
}
