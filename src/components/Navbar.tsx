import { Sparkles, Network, Compass, FileText, User, Bell, LogOut, Brain, MessageSquare } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onResetView?: () => void;
  activeView?: string;
  setActiveView?: (view: string) => void;
}

export const Navbar = ({
  onResetView,
  activeView,
  setActiveView,
}: NavbarProps) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { name: 'AI Assistant', icon: MessageSquare, path: '/assistant' },
    { name: 'Semantic Search', icon: Sparkles, path: '/search' },
    { name: 'Knowledge Graph', icon: Network, path: '/knowledge' },
    { name: 'Memory', icon: Brain, path: '/memory' },
    { name: 'Documents', icon: FileText, path: '/documents' },
  ];

  const currentTab = (() => {
    if (location.pathname.startsWith('/assistant')) return 'AI Assistant';
    if (location.pathname.startsWith('/search')) return 'Semantic Search';
    if (location.pathname.startsWith('/documents')) return 'Documents';
    if (location.pathname.startsWith('/memory')) return 'Memory';
    if (location.pathname.startsWith('/knowledge') || location.pathname.startsWith('/dashboard')) return 'Knowledge Graph';
    return activeView || 'AI Assistant';
  })();

  const handleTabClick = (link: (typeof navLinks)[0]) => {
    if (setActiveView) setActiveView(link.name);
    navigate(link.path);
    if (link.name === 'Knowledge Graph' && onResetView) {
      onResetView();
    }
  };

  const handleLogoClick = () => {
    navigate('/knowledge');
    if (onResetView) onResetView();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 md:px-8 py-3 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
        {/* Brand / Logo */}
        <div
          onClick={handleLogoClick}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 p-[1px] shadow-[0_0_20px_rgba(56,189,248,0.4)] group-hover:shadow-[0_0_30px_rgba(56,189,248,0.7)] transition-all duration-300">
            <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
              <Compass className="w-5 h-5 text-cyan-400 group-hover:rotate-45 transition-transform duration-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                Memory<span className="text-cyan-400 font-extrabold">Space</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wider font-mono block">
              PERSONAL KNOWLEDGE RECOVERY
            </p>
          </div>
        </div>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 glass-panel px-3 py-1.5 rounded-full border border-slate-700/60 shadow-lg">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentTab === link.name;
            return (
              <button
                key={link.name}
                onClick={() => handleTabClick(link)}
                className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'text-cyan-200 bg-cyan-500/15 shadow-[0_0_15px_rgba(56,189,248,0.25)] border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{link.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Status Indicator & Avatar */}
        <div className="flex items-center gap-3">
          {/* Subtle Live Sync Status */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>NEURAL RECOVERY ONLINE</span>
          </div>

          {/* Quick Notification Bell */}
          <button
            title="System Telemetry"
            className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User Avatar + Logout */}
          <div className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full glass-panel border border-slate-700/60 transition-all">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold shadow-inner">
              <User className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-300 hidden sm:inline max-w-[120px] truncate">
              {user?.email ?? 'Guest Mind'}
            </span>
          </div>

          {user && (
            <button
              id="navbar-logout"
              onClick={() => signOut()}
              title="Sign out"
              className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
