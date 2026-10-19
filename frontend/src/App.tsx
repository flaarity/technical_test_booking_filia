import { SignIn, UserButton, useAuth, useClerk } from "@clerk/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { ApiError, apiRequest } from "./lib/api";
import "./App.css";

type Worker = {
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

const WorkerContext = createContext<WorkerContextValue | null>(null);

function useWorker() {
  const context = useContext(WorkerContext);
  if (!context) {
    throw new Error("useWorker harus digunakan di dalam WorkerProvider.");
  }
  return context;
}

function WorkerProvider({ children }: { children: ReactNode }) {
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route element={<RequireLogin />}>
          <Route path="/403" element={<ForbiddenPage />} />
          <Route element={<ProtectedApplication />}>
            <Route index element={<HomePage />} />
            <Route path="rooms" element={<PlaceholderPage title="Ruang Rapat" />} />
            <Route
              path="rooms/:id"
              element={<PlaceholderPage title="Detail Ruangan" />}
            />
            <Route
              path="history"
              element={
                <RoleGuard role="WORKER">
                  <PlaceholderPage title="Riwayat Pemesanan" />
                </RoleGuard>
              }
            />
            <Route
              path="admin/rooms"
              element={
                <RoleGuard role="ADMIN">
                  <PlaceholderPage title="Kelola Ruangan" />
                </RoleGuard>
              }
            />
            <Route
              path="admin/rooms/new"
              element={
                <RoleGuard role="ADMIN">
                  <PlaceholderPage title="Tambah Ruangan" />
                </RoleGuard>
              }
            />
            <Route
              path="admin/rooms/:id/edit"
              element={
                <RoleGuard role="ADMIN">
                  <PlaceholderPage title="Edit Ruangan" />
                </RoleGuard>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

function SignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <FullPageStatus label="Memuat autentikasi..." />;
  if (isSignedIn) return <Navigate to="/" replace />;

  return (
    <main className="sign-in-page">
      <div className="sign-in-brand">
        <span className="brand-mark" aria-hidden="true">
          B
        </span>
        <span>Book-in</span>
      </div>
      <p className="sign-in-caption">Sistem Booking Ruang Meeting</p>
      <SignIn routing="hash" />
    </main>
  );
}

function RequireLogin() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  if (!isLoaded) return <FullPageStatus label="Memuat autentikasi..." />;
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

function ProtectedApplication() {
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

function RoleGuard({
  role,
  children,
}: {
  role: Worker["role"];
  children: ReactNode;
}) {
  const { worker } = useWorker();
  if (!worker) return null;
  return worker.role === role ? children : <Navigate to="/403" replace />;
}

type NavigationItem = {
  to: string;
  label: string;
  icon: "home" | "rooms" | "history" | "manage";
  end?: boolean;
};

const icons: Record<NavigationItem["icon"], string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
  rooms: "M3 21h18M5 21V5l7-2v18m0-14h7v14M8 8h1m-1 4h1m-1 4h1m7-5h1m-1 4h1",
  history: "M3 12a9 9 0 1 0 2.6-6.4L3 8m0-5v5h5m4-1v5l3 2",
  manage: "M4 5h16v14H4zM8 9h8m-8 4h5m-5 3h8",
};

function NavIcon({ name }: { name: NavigationItem["icon"] }) {
  return (
    <svg
      aria-hidden="true"
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={icons[name]} />
    </svg>
  );
}

function ApplicationLayout({ worker }: { worker: Worker }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const isAdmin = worker.role === "ADMIN";
  const navItems: NavigationItem[] = [
    { to: "/", label: "Beranda", icon: "home", end: true },
    { to: "/rooms", label: "Ruang Rapat", icon: "rooms" },
    ...(isAdmin
      ? [{ to: "/admin/rooms", label: "Kelola Ruangan", icon: "manage" as const }]
      : [{ to: "/history", label: "Riwayat", icon: "history" as const }]),
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          type="button"
          className="mobile-backdrop"
          aria-label="Tutup menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>Book-in</span>
        </div>
        <div className="sidebar-section-label">MENU</div>
        <nav aria-label="Navigasi utama" className="side-navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-footer-dot" aria-hidden="true" />
          <span>Ruang kerja yang lebih mudah</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="topbar-date">{formatJakartaDateTime(now)}</div>
          <div className="topbar-account">
            <span className="topbar-email">{worker.email}</span>
            <span className={`role-badge ${isAdmin ? "role-admin" : ""}`}>
              {isAdmin ? "Admin" : "Worker"}
            </span>
            <UserButton />
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function HomePage() {
  const { worker } = useWorker();
  const [now, setNow] = useState(() => new Date());
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!worker) return null;

  const firstName = worker.name.trim().split(/\s+/)[0] || worker.name;
  const hour = getJakartaHour(now);
  const greeting =
    hour < 11
      ? "Selamat Pagi"
      : hour < 15
        ? "Selamat Siang"
        : hour < 18
          ? "Selamat Sore"
          : "Selamat Malam";

  return (
    <section className="home-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RUANG KERJA ANDA</p>
          <h1>Beranda</h1>
        </div>
        <div className="welcome-date">{formatJakartaDate(now)}</div>
      </div>

      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <span className="welcome-kicker">BOOK-IN · SISTEM BOOKING RUANG</span>
          <h2 id="welcome-title">
            {greeting}, {firstName}!
          </h2>
          <p>Siap untuk mengatur ruang meeting Anda hari ini?</p>
        </div>
        <div className="welcome-decoration" aria-hidden="true">
          <span className="decoration-orbit orbit-one" />
          <span className="decoration-orbit orbit-two" />
          <span className="decoration-spark">✦</span>
          <span className="decoration-dot" />
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">INFORMASI AKUN</p>
            <h2 id="profile-title">Profil Saya</h2>
          </div>
        </div>
        <div className="profile-card">
          <div className="profile-photo-wrap">
            {worker.photoUrl && !photoFailed ? (
              <img
                className="profile-photo"
                src={worker.photoUrl}
                alt={`Foto ${worker.name}`}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="profile-photo-placeholder" aria-hidden="true">
                {getInitials(worker.name)}
              </div>
            )}
          </div>
          <div className="profile-details">
            <div className="profile-intro">
              <span className="profile-label">PROFIL PEGAWAI</span>
              <span className="profile-status">
                <span aria-hidden="true" />
                Akun aktif
              </span>
            </div>
            <dl className="profile-fields">
              <div>
                <dt>Nama</dt>
                <dd>{worker.name}</dd>
              </div>
              <div>
                <dt>ID Work</dt>
                <dd>{worker.workerCode}</dd>
              </div>
              <div>
                <dt>Posisi</dt>
                <dd>{worker.position}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <div className="home-note">
        <span className="home-note-mark" aria-hidden="true">
          i
        </span>
        <p>
          Gunakan menu <strong>Ruang Rapat</strong> untuk melihat ketersediaan
          ruangan.
        </p>
      </div>
    </section>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="placeholder-page">
      <p className="eyebrow">BOOK-IN</p>
      <h1>{title}</h1>
      <div className="placeholder-card">
        <div className="placeholder-symbol" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2>{title}</h2>
        <p>Halaman ini akan tersedia pada tahap pengembangan berikutnya.</p>
      </div>
    </section>
  );
}

function ForbiddenPage() {
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

function NotFoundPage() {
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

function UnknownRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <FullPageStatus label="Memuat autentikasi..." />;
  return isSignedIn ? <NotFoundPage /> : <Navigate to="/sign-in" replace />;
}

function FullPageStatus({ label }: { label: string }) {
  return (
    <main className="full-page-status" role="status">
      <span className="loading-spinner" />
      <span>{label}</span>
    </main>
  );
}

function getJakartaHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

function formatJakartaDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatJakartaDateTime(date: Date) {
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const time = ["hour", "minute", "second"]
    .map((partType) => timeParts.find((part) => part.type === partType)?.value)
    .join(":");
  return `${formatJakartaDate(date)} | ${time}`;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("id-ID") ?? "")
    .join("");
}

export default App;
