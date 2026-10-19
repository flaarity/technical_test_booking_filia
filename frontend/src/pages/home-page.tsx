import { useEffect, useState } from "react";
import { useWorker } from "../context/use-worker";

export function HomePage() {
  const { worker } = useWorker();
  const [now, setNow] = useState(() => new Date());
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!worker) return null;

  const firstName = worker.name.trim().split(/\s+/)[0] || worker.name;
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const greeting =
    Number(hour) < 11
      ? "Selamat Pagi"
      : Number(hour) < 15
        ? "Selamat Siang"
        : Number(hour) < 18
          ? "Selamat Sore"
          : "Selamat Malam";
  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <section className="home-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RUANG KERJA ANDA</p>
          <h1>Beranda</h1>
        </div>
        <div className="welcome-date">{dateLabel}</div>
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
                {worker.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toLocaleUpperCase("id-ID") ?? "")
                  .join("")}
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
