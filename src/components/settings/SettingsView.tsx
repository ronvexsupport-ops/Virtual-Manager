import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Globe,
  User,
  Building,
  LogOut,
  Shield,
  Database,
  CheckCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, userProfile, logOut, updateUserProfileData } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || user?.displayName || ''
  );
  const [businessName, setBusinessName] = useState(userProfile?.businessName || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await updateUserProfileData({
        displayName: displayName.trim(),
        businessName: businessName.trim(),
        language,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (newLang: 'bn' | 'en') => {
    setLanguage(newLang);
    if (user) {
      try {
        await updateUserProfileData({ language: newLang });
      } catch (e) {
        // Ignored
      }
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Language Preference Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center space-x-2.5 mb-3">
          <Globe className="w-5 h-5 text-teal-700" />
          <h3 className="text-sm font-bold text-slate-900">{t('languageSetting')}</h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handleLanguageChange('bn')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer min-h-[44px] ${
              language === 'bn'
                ? 'bg-teal-50 border-teal-600 text-teal-900 ring-2 ring-teal-500/20 font-bold'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="text-sm">বাংলা (Bengali)</span>
            <span className="block text-[11px] text-teal-700 mt-0.5">ডিফল্ট</span>
          </button>

          <button
            onClick={() => handleLanguageChange('en')}
            className={`p-3 rounded-xl border text-center transition-all cursor-pointer min-h-[44px] ${
              language === 'en'
                ? 'bg-teal-50 border-teal-600 text-teal-900 ring-2 ring-teal-500/20 font-bold'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="text-sm">English</span>
            <span className="block text-[11px] text-slate-500 mt-0.5">English UI</span>
          </button>
        </div>
      </div>

      {/* 2. Business Profile Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center space-x-2.5 mb-3">
          <Building className="w-5 h-5 text-teal-700" />
          <h3 className="text-sm font-bold text-slate-900">{t('profileSection')}</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('ownerName')}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="মালিকের নাম"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('businessName')}
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="যেমন: মদিনা ট্রেডার্স"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            {savedSuccess ? (
              <span className="inline-flex items-center text-xs font-semibold text-emerald-700">
                <CheckCircle className="w-4 h-4 mr-1" />
                {t('profileUpdated')}
              </span>
            ) : (
              <span></span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="py-2 px-4 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[40px]"
            >
              {saving ? t('saving') : t('saveProfileBtn')}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Account Details & Cloud Connection */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2.5">
          <Database className="w-5 h-5 text-teal-700" />
          <h3 className="text-sm font-bold text-slate-900">{t('systemStatus')}</h3>
        </div>

        <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 space-y-1">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-teal-900">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
            <span>{t('cloudConnected')}</span>
          </div>
          <p className="text-[11px] text-teal-800">{t('cloudConnectedSub')}</p>
        </div>

        <div className="text-xs text-slate-600 space-y-1.5 pt-1">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">{t('emailLabel')}</span>
            <span className="font-semibold text-slate-800">{user?.email || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">User ID</span>
            <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]">
              {user?.uid || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Security & Audit Trail Information */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs space-y-2 text-slate-700">
        <div className="flex items-center space-x-2 font-bold text-slate-900">
          <Shield className="w-4 h-4 text-teal-700" />
          <span>{t('dataSecurityTitle')}</span>
        </div>
        <p className="leading-relaxed text-slate-600">{t('dataSecurityDesc')}</p>

        <div className="flex items-center space-x-2 font-bold text-slate-900 pt-2">
          <FileText className="w-4 h-4 text-teal-700" />
          <span>{t('auditTrailTitle')}</span>
        </div>
        <p className="leading-relaxed text-slate-600">{t('auditTrailDesc')}</p>
      </div>

      {/* 5. Logout Section */}
      <div className="pt-2">
        {showLogoutConfirm ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
            <div className="flex items-start space-x-2 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold">{t('logoutConfirm')}</span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-3 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer min-h-[40px]"
              >
                {t('cancelBtn')}
              </button>
              <button
                onClick={logOut}
                className="flex-1 py-2 px-3 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg cursor-pointer min-h-[40px]"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-3 px-4 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
