import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import type { Room } from "../lib/room-filters";

type RoomCardProps = {
  room: Room;
  isAdmin: boolean;
  scheduleSelected: boolean;
  previewOnly?: boolean;
};

function roomDetailSearch(searchParams: URLSearchParams) {
  const query = new URLSearchParams();
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (date) query.set("date", date);
  if (start && end) {
    query.set("start", start);
    query.set("end", end);
  }
  return query.toString();
}

export function RoomCard({
  room,
  isAdmin,
  scheduleSelected,
  previewOnly = false,
}: RoomCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const detailQuery = roomDetailSearch(searchParams);
  const detailPath = `/rooms/${room.id}${detailQuery ? `?${detailQuery}` : ""}`;
  const roomLinkState = { returnTo: `/rooms${location.search}` };
  const facilities = room.facilities ?? [];
  const unavailable = scheduleSelected && room.isAvailable === false;
  const availabilityUnverified =
    scheduleSelected && room.isAvailable !== true && room.isAvailable !== false;
  const bookingDisabled = unavailable || availabilityUnverified;
  const availabilityKnown =
    scheduleSelected && typeof room.isAvailable === "boolean";

  return (
    <article className="room-card">
      <div className="room-card-image-link">
        {room.image && !imageFailed ? (
          <img
            className="room-card-image"
            src={room.image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="room-image-placeholder">
            <span className="room-image-icon" aria-hidden="true">
              ▦
            </span>
            <span>Gambar Ruang Rapat</span>
          </div>
        )}
        {availabilityKnown && (
          <span
            className={`availability-badge ${room.isAvailable ? "is-available" : "is-unavailable"}`}
          >
            <span aria-hidden="true" />
            {room.isAvailable ? "Tersedia" : "Tidak tersedia"}
          </span>
        )}
      </div>

      <div className="room-card-body">
        <div className="room-card-title-row">
          <h2>{room.name}</h2>
          <span className="room-type-badge">
            {room.type.toLowerCase() === "online" ? "Online" : "Onsite"}
          </span>
        </div>
        <div className="room-facts">
          <div>
            <span className="room-fact-icon" aria-hidden="true">
              ◉
            </span>
            <span>Maks. {room.capacity} orang</span>
          </div>
          <div>
            <span className="room-fact-icon" aria-hidden="true">
              ◷
            </span>
            <span>
              {room.openTime} s.d {room.closeTime}
            </span>
          </div>
          <div>
            <span className="room-fact-icon" aria-hidden="true">
              ⌖
            </span>
            <span>{room.location || "Lokasi tidak disebutkan"}</span>
          </div>
        </div>

        {room.notes && (
          <div className="room-note-badge">
            <span aria-hidden="true">!</span>
            <span>{room.notes}</span>
          </div>
        )}

        <div className="room-facilities">
          <h3>Fasilitas Ruangan</h3>
          {facilities.length ? (
            <ul className="facility-chips">
              {facilities.map((facility) => (
                <li key={facility}>{facility}</li>
              ))}
            </ul>
          ) : (
            <p className="facility-empty">Tidak disebutkan</p>
          )}
        </div>

        {!previewOnly && (
          <div className="room-card-actions">
            <Link
              className="button button-outline room-detail-button"
              to={detailPath}
              state={roomLinkState}
            >
              Detail Ruangan
            </Link>
            {!isAdmin && (
              <Link
                className={`button button-primary room-book-button${bookingDisabled ? " room-book-disabled" : ""}`}
                to={bookingDisabled ? "#" : detailPath}
                state={roomLinkState}
                aria-disabled={bookingDisabled}
                onClick={(event) => {
                  if (bookingDisabled) event.preventDefault();
                }}
                aria-describedby={bookingDisabled ? `unavailable-${room.id}` : undefined}
              >
                Pesan Ruangan
              </Link>
            )}
            {bookingDisabled && (
              <span className="sr-only" id={`unavailable-${room.id}`}>
                {unavailable
                  ? "Tidak dapat dipesan karena tidak tersedia pada jadwal terpilih."
                  : "Ketersediaan jadwal belum dapat diverifikasi."}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
