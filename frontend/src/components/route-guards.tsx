import { useAuth, useClerk } from "@clerk/react";
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FullPageStatus } from "./full-page-status";
import { ApplicationLayout } from "./application-layout";
import { WorkerProvider } from "../context/worker-provider";
import { useWorker } from "../context/use-worker";
import { ApiError } from "../lib/api";

export function RequireLogin() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  if (!isLoaded) return <FullPageStatus label="Memuat autentikasi..." />;
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function ProtectedApplication() {
  return (
    <WorkerProvider>
      <WorkerBoundary />
    </WorkerProvider>
  );
}

function WorkerBoundary() {
  const { worker, loading, error, retry } = useWorker();
  const { signOut } = useClerk();
  if (loading) return <FullPageStatus label="Memuat profil worker..." />;
  if (error instanceof ApiError && error.status === 403) {
    return (
      <main className="account-blocked">
        <div className="account-blocked-card">
          <div className="blocked-icon" aria-hidden="true">
            !
          </div>
          <h1>Akun belum terdaftar</h1>
          <p>
            Akun ini belum terdaftar sebagai worker Book-in. Hubungi
            administrator untuk mendapatkan akses.
          </p>
          <button className="button button-primary" onClick={() => void signOut()}>
            Keluar
          </button>
        </div>
      </main>
    );
  }
  if (error) {
    return (
      <main className="account-blocked">
        <div className="account-blocked-card">
          <h1>Profil belum dapat dimuat</h1>
          <p>
            {error instanceof ApiError && error.status === 401
              ? "Sesi login tidak dapat diverifikasi."
              : "Periksa koneksi Anda, lalu coba muat profil kembali."}
          </p>
          <button className="button button-primary" onClick={retry}>
            Coba lagi
          </button>
        </div>
      </main>
    );
  }
  if (!worker) return <FullPageStatus label="Memuat profil worker..." />;

  return <ApplicationLayout worker={worker} />;
}

export function RoleGuard({
  role,
  children,
}: {
  role: "WORKER" | "ADMIN";
  children: ReactNode;
}) {
  const { worker } = useWorker();
  if (!worker) return null;
  return worker.role === role ? children : <Navigate to="/403" replace />;
}
