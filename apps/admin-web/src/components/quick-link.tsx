import { Link } from 'react-router-dom';

interface QuickLinkProps {
  to: string;
  title: string;
  description?: string;
}

export function QuickLink({ to, title, description }: QuickLinkProps) {
  return (
    <Link to={to} className="quick-link-card">
      <strong>{title}</strong>
      {description ? <p className="muted">{description}</p> : null}
    </Link>
  );
}
