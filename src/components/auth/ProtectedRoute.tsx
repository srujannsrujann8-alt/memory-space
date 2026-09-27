import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps protected routes. Redirects unauthenticated users to /login.
 * Shows nothing while the initial session is being resolved.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-[#030712]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-mono tracking-widest">RESTORING SESSION…</p>
        </div>
      </div>
    );
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
