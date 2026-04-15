export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="page-card">
      <h1>{title}</h1>
      <p>{description}</p>
      <p className="muted">
        This page is intentionally lightweight in this phase. Feature modules will plug into this route.
      </p>
    </section>
  );
}
