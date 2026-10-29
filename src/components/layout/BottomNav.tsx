import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Home, Users, Plus, Settings } from 'lucide-react';

export type TabType = 'dashboard' | 'contacts' | 'settings';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenAddTransaction: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddTransaction,
}) => {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] pb-safe">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around relative">
        {/* 1. Dashboard Tab */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 min-h-[44px] transition-colors cursor-pointer ${
            currentTab === 'dashboard'
              ? 'text-teal-700 font-semibold'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Home className={`w-5 h-5 ${currentTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-1 leading-tight">{t('navDashboard')}</span>
        </button>

        {/* 2. Contacts / Ledgers Tab */}
        <button
          onClick={() => onSelectTab('contacts')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 min-h-[44px] transition-colors cursor-pointer ${
            currentTab === 'contacts'
              ? 'text-teal-700 font-semibold'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className={`w-5 h-5 ${currentTab === 'contacts' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-1 leading-tight">{t('navContacts')}</span>
        </button>

        {/* 3. Center Elevated Add Transaction Action Button */}
        <div className="flex flex-col items-center justify-center flex-1 -mt-4">
          <button
            onClick={onOpenAddTransaction}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-teal-700 to-teal-500 hover:from-teal-800 hover:to-teal-600 active:scale-95 text-white shadow-lg shadow-teal-700/30 flex items-center justify-center transition-all cursor-pointer border-2 border-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
            aria-label={t('navAddTransaction')}
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] mt-0.5 font-medium text-teal-800">
            {t('navAddTransaction')}
          </span>
        </div>

        {/* 4. Settings Tab */}
        <button
          onClick={() => onSelectTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 min-h-[44px] transition-colors cursor-pointer ${
            currentTab === 'settings'
              ? 'text-teal-700 font-semibold'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings className={`w-5 h-5 ${currentTab === 'settings' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[11px] mt-1 leading-tight">{t('navSettings')}</span>
        </button>
      </div>
    </nav>
  );
};
