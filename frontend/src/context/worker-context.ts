import { createContext } from "react";

export type Worker = {
  workerCode: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  role: "WORKER" | "ADMIN";
  photoUrl: string | null;
};

type WorkerContextValue = {
  worker: Worker | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
};

export const WorkerContext = createContext<WorkerContextValue | null>(null);
