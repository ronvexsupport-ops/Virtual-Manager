import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Globe, User, CloudCheck } from 'lucide-react';

interface NavbarProps {
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings }) => {
  const { t, language, setLanguage } = useLanguage();
  const { userProfile, user } = useAuth();

  const toggleLanguage = () => {
    setLanguage(language === 'bn' ? 'en' : 'bn');
  };

  const displayName = userProfile?.businessName || userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || '';

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-4xl mx-auto px-4 h-15 flex items-center justify-between">
        {/* Brand & Business */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-white truncate leading-tight">
              {t('appName')}
            </h1>
            {displayName && (
              <p className="text-xs text-teal-300/90 truncate max-w-[180px] sm:max-w-xs">
                {displayName}
              </p>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {/* Cloud Sync Status Indicator */}
          <div
            className="hidden xs:flex items-center space-x-1 px-2 py-1 rounded-md bg-teal-950/60 border border-teal-800/60 text-[11px] text-teal-300"
            title="Firebase Cloud Firestore Connected"
          >
            <CloudCheck className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">{t('networkNotice')}</span>
          </div>

          {/* Language Switcher Button */}
          <button
            onClick={toggleLanguage}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer min-h-[36px]"
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-semibold">{language === 'bn' ? 'English' : 'বাংলা'}</span>
          </button>

          {/* User Profile / Settings Avatar */}
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <User className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
