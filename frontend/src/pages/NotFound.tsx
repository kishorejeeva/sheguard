import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
      <div className="text-6xl mb-4">🛡️</div>
      <h1 className="text-2xl font-bold text-navy">Page not found</h1>
      <p className="text-slate-500 mt-2">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 px-5 py-2 rounded-xl bg-violet text-white font-medium">
        Back to Home
      </Link>
    </div>
  );
}
