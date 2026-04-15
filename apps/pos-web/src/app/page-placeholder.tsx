export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      <p>{description}</p>
      <p className="muted">This route is scaffolded for upcoming POS feature implementation.</p>
    </section>
  );
}
