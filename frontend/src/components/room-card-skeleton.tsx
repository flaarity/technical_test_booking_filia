export function RoomCardSkeleton() {
  return (
    <div className="room-card room-card-skeleton" aria-hidden="true">
      <div className="skeleton-image" />
      <div className="skeleton-content">
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line" />
        <span className="skeleton-line" />
        <span className="skeleton-line skeleton-short" />
        <span className="skeleton-line skeleton-button" />
      </div>
    </div>
  );
}
