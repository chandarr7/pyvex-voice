import React, { useState } from 'react';
import { Disc, Menu, X, ArrowUpRight, Sparkles, Database, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onOpenStudio: () => void;
  onOpenPricing: () => void;
  onOpenDocs: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenStudio, onOpenPricing, onOpenDocs, onOpenAuth }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, userProfile } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#0D0F13]/90 backdrop-blur-xl border-b border-[#292B3A] transition-all">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between gap-6">
        {/* Brand Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-9 h-9 rounded-full border border-[#34365C] bg-gradient-to-b from-[#7047FF]/20 to-transparent flex items-center justify-center shadow-[0_0_12px_rgba(112,71,255,0.25)]">
            <Disc className="w-4 h-4 text-[#845CFF] group-hover:rotate-180 transition-transform duration-700" />
          </div>
          <div className="flex items-center gap-1.5 font-sans">
            <span className="text-lg font-bold tracking-tight text-[#F4F2F8]">
              Tilted
            </span>
            <span className="text-lg font-bold tracking-tight text-[#845CFF]">
              STUDIO
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-mono uppercase tracking-[0.14em] text-[#A4A3B2]">
          <a
            href="#platform"
            className="hover:text-[#F4F2F8] transition-colors"
          >
            Platform
          </a>
          <a
            href="#solutions"
            className="hover:text-[#F4F2F8] transition-colors"
          >
            Solutions
          </a>
          <a
            href="#gemini-chat"
            className="hover:text-[#F4F2F8] transition-colors flex items-center gap-1.5 text-[#D8B4FE]"
          >
            <Sparkles className="w-3 h-3 text-[#24D8ED]" />
            <span>Tilted Sales Agent</span>
          </a>
          <a
            href="#architecture"
            className="hover:text-[#F4F2F8] transition-colors"
          >
            Architecture
          </a>
          <button
            onClick={onOpenPricing}
            className="hover:text-[#F4F2F8] transition-colors uppercase"
          >
            Pricing
          </button>
          <button
            onClick={onOpenDocs}
            className="hover:text-[#F4F2F8] transition-colors uppercase flex items-center gap-1"
          >
            Docs
            <ArrowUpRight className="w-3 h-3 text-[#666879]" />
          </button>
        </nav>

        {/* Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Database / Auth Button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#292B3A] hover:border-[#3E4259] bg-[#12141A] text-xs font-mono text-[#F4F2F8] transition-all"
            title="Manage Accounts & Cloud Database"
          >
            {user ? (
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-5 h-5 rounded-full object-cover border border-[#3E4259]"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="max-w-[100px] truncate text-[11px] text-[#F4F2F8]">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${user.isDemo ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  title={user.isDemo ? 'Demo Mode (Local DB)' : 'Firestore Connected'}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[#A4A3B2] hover:text-[#F4F2F8]">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] uppercase tracking-wider">Log in / DB</span>
              </div>
            )}
          </button>

          <button
            id="launch-studio-header-button"
            onClick={onOpenStudio}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F2F8] transition-all shadow-[0_4px_16px_rgba(112,71,255,0.35)] hover:shadow-[0_4px_22px_rgba(150,85,255,0.5)] active:scale-95"
            style={{
              background: 'linear-gradient(90deg, #7047FF, #9655FF)',
              color: '#F4F2F8',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F4F2F8]" />
            <span>Launch Studio</span>
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg border border-[#292B3A] text-[#A4A3B2] hover:text-[#F4F2F8]"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#292B3A] bg-[#0D0F13]/98 px-6 py-6 space-y-4 font-mono text-xs uppercase tracking-wider">
          <a
            href="#platform"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#A4A3B2] hover:text-[#F4F2F8]"
          >
            Platform
          </a>
          <a
            href="#solutions"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#A4A3B2] hover:text-[#F4F2F8]"
          >
            Solutions
          </a>
          <a
            href="#gemini-chat"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 py-2 text-[#D8B4FE] hover:text-[#F4F2F8]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#24D8ED]" />
            <span>Tilted Sales Agent</span>
          </a>
          <a
            href="#architecture"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#A4A3B2] hover:text-[#F4F2F8]"
          >
            Architecture
          </a>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenPricing();
            }}
            className="block py-2 text-left w-full text-[#A4A3B2] hover:text-[#F4F2F8] uppercase"
          >
            Pricing
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenDocs();
            }}
            className="block py-2 text-left w-full text-[#A4A3B2] hover:text-[#F4F2F8] uppercase"
          >
            Docs
          </button>
          <div className="pt-4 border-t border-[#292B3A] flex flex-col gap-3">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth();
              }}
              className="w-full py-2.5 rounded-xl border border-[#34365C] text-center text-[#F4F2F8] bg-[#12141A] flex items-center justify-center gap-2"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>{user ? `Account (${user.displayName || user.email})` : 'Log in / Database'}</span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenStudio();
              }}
              className="w-full py-3 rounded-full text-center font-semibold text-[#F4F2F8] shadow-lg"
              style={{
                background: 'linear-gradient(90deg, #7047FF, #9655FF)',
              }}
            >
              Launch Studio
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
