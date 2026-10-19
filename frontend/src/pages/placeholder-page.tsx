export function PlaceholderPage({ title }: { title: string }) {
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
