import { UserButton } from "@clerk/react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { Worker } from "../context/worker-context";

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

function formatJakartaDateTime(date: Date) {
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const timeLabel = ["hour", "minute", "second"]
    .map((partType) => timeParts.find((part) => part.type === partType)?.value)
    .join(":");
  return `${dateLabel} | ${timeLabel}`;
}

export function ApplicationLayout({ worker }: { worker: Worker }) {
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
