import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { BookOpen, Mail, Lock, User, Building, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, resetPassword, signInWithGoogle, error, setError } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    if (!email.trim()) {
      setValidationError(t('requiredField'));
      return;
    }

    if (mode !== 'forgot' && !password) {
      setValidationError(t('requiredField'));
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setValidationError(language === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, name, businessName);
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setResetSuccess(true);
      }
    } catch (err: any) {
      // Error handled in context or caught
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setValidationError(null);
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      // Error handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8">
      {/* Language switcher on login screen */}
      <div className="w-full max-w-sm flex justify-end mb-4">
        <button
          onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {language === 'bn' ? 'English' : 'বাংলা'}
        </button>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-center text-white">
          <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 mb-3 shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {mode === 'login' && t('loginTitle')}
            {mode === 'signup' && t('signupTitle')}
            {mode === 'forgot' && t('forgotPasswordTitle')}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            {mode === 'login' && t('loginSubtitle')}
            {mode === 'signup' && t('signupSubtitle')}
            {mode === 'forgot' && t('forgotPasswordSubtitle')}
          </p>
        </div>

        {/* Tab switch between Login and Signup */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
                setValidationError(null);
              }}
              className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'border-teal-600 text-teal-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('loginTitle')}
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError(null);
                setValidationError(null);
              }}
              className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'border-teal-600 text-teal-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('signupButton')}
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          {/* Feedback messages */}
          {(error || validationError) && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-words flex-1">
                {validationError || error}
              </div>
            </div>
          )}

          {resetSuccess ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">
                {language === 'bn'
                  ? 'পাসওয়ার্ড রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে।'
                  : 'Password reset link sent to your email.'}
              </p>
              <button
                onClick={() => {
                  setMode('login');
                  setResetSuccess(false);
                }}
                className="inline-flex items-center text-xs font-medium text-teal-700 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t('backToLogin')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name & Business Name (Signup only) */}
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t('nameLabel')} *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={language === 'bn' ? 'আপনার পূর্ণ নাম' : 'Your Full Name'}
                        required
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t('businessNameLabel')}
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder={language === 'bn' ? 'যেমন: মদিনা ট্রেডার্স' : 'e.g. Madina Traders'}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('emailLabel')} *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Password (Login and Signup) */}
              {mode !== 'forgot' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-700">
                      {t('passwordLabel')} *
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                          setValidationError(null);
                        }}
                        className="text-xs text-teal-700 hover:underline cursor-pointer"
                      >
                        {t('forgotPasswordPrompt')}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-semibold rounded-lg shadow-sm text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                {loading ? (
                  <span>{t('processing')}</span>
                ) : (
                  <span>
                    {mode === 'login' && t('loginButton')}
                    {mode === 'signup' && t('signupButton')}
                    {mode === 'forgot' && t('resetButton')}
                  </span>
                )}
              </button>

              {/* Back to login if in forgot mode */}
              {mode === 'forgot' && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    {t('backToLogin')}
                  </button>
                </div>
              )}

              {/* Google Sign-in Divider */}
              {mode !== 'forgot' && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-white text-slate-400">
                        {language === 'bn' ? 'অথবা' : 'or'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-2 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center space-x-2 transition-colors cursor-pointer min-h-[42px]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{t('googleSignIn')}</span>
                  </button>
                </>
              )}
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500 leading-normal">
            {t('demoNotice')}
          </p>
        </div>
      </div>
    </div>
  );
};
