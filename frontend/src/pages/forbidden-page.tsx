import { NavLink } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <main className="account-blocked">
      <div className="account-blocked-card">
        <div className="blocked-icon" aria-hidden="true">
          403
        </div>
        <h1>Akses tidak tersedia</h1>
        <p>Anda tidak memiliki akses untuk membuka halaman ini.</p>
        <NavLink className="button button-primary" to="/">
          Kembali ke Beranda
        </NavLink>
      </div>
    </main>
  );
}
