import { Link, useLocation } from 'react-router-dom';

export default function Placeholder() {
  const { pathname } = useLocation();
  return (
    <div className="card mx-auto max-w-xl text-center">
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="mt-2 text-slate"><code>{pathname}</code> does not exist or is not available to your account.</p>
      <Link to="/dashboard" className="btn-primary mt-4">Back to dashboard</Link>
    </div>
  );
}
