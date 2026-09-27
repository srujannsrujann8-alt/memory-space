import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Mail, Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { signIn, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen w-screen bg-[#030712] overflow-hidden bg-grid-pattern">
      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Card */}
        <div className="glass-panel-elevated rounded-2xl p-8 border border-slate-700/60">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 p-[1.5px] shadow-[0_0_30px_rgba(56,189,248,0.4)] mb-4">
              <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
                <Compass className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Memory<span className="text-cyan-400 font-extrabold">Space</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-mono tracking-widest text-xs">
              SIGN IN TO YOUR KNOWLEDGE UNIVERSE
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 mb-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-slate-400 tracking-wider uppercase">
                Email
              </label>
              <div className="relative glass-input rounded-xl">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none rounded-xl"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-medium text-slate-400 tracking-wider uppercase">
                Password
              </label>
              <div className="relative glass-input rounded-xl">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent pl-10 pr-11 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-[0_0_25px_rgba(56,189,248,0.25)] hover:shadow-[0_0_35px_rgba(56,189,248,0.4)] transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{' '}
            <Link
              to="/signup"
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
