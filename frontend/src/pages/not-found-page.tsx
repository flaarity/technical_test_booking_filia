import { useAuth } from "@clerk/react";
import { Navigate, NavLink } from "react-router-dom";
import { FullPageStatus } from "../components/full-page-status";

export function NotFoundPage() {
  return (
    <main className="account-blocked">
      <div className="account-blocked-card">
        <div className="blocked-icon" aria-hidden="true">
          404
        </div>
        <h1>Halaman tidak ditemukan</h1>
        <p>Alamat yang Anda buka tidak tersedia.</p>
        <NavLink className="button button-primary" to="/">
          Kembali ke Beranda
        </NavLink>
      </div>
    </main>
  );
}

export function UnknownRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <FullPageStatus label="Memuat autentikasi..." />;
  return isSignedIn ? <NotFoundPage /> : <Navigate to="/sign-in" replace />;
}
