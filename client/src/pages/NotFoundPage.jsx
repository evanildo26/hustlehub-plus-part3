import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="page page--narrow center">
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for doesn&apos;t exist.</p>
      <Link to="/" className="btn btn--primary">
        Back to the marketplace
      </Link>
    </section>
  );
}
