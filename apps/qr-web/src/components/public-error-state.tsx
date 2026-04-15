interface PublicErrorStateProps {
  title: string;
  message: string;
}

export function PublicErrorState({ title, message }: PublicErrorStateProps) {
  return (
    <section className="error-card">
      <h1>{title}</h1>
      <p className="muted">{message}</p>
    </section>
  );
}
