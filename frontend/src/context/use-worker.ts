import { useContext } from "react";
import { WorkerContext } from "./worker-context";

export function useWorker() {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error("useWorker harus digunakan di dalam WorkerProvider.");
  }
  return context;
}
