import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { sendOtpToGmail, verifyOtpWithAppsScript } from '../../services/appsScriptClient.ts';
import {
  BookOpen,
  Mail,
  Lock,
  User,
  Building,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, resetPassword, error, setError } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // OTP Verification States
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Mode switcher
  const handleSwitchMode = (newMode: 'login' | 'signup' | 'forgot') => {
    setMode(newMode);
    setSignupStep('form');
    setError(null);
    setValidationError(null);
    setOtpSuccessMessage(null);
    setOtp('');
    setPassword('');
    setConfirmPassword('');
  };

  // 1. Send OTP Request (Directly to Google Apps Script Web App)
  const handleRequestOtp = async (targetEmail: string) => {
    setValidationError(null);
    setError(null);
    setOtpSuccessMessage(null);

    setOtpLoading(true);
    try {
      const data = await sendOtpToGmail(targetEmail);

      if (!data.success) {
        if (data.cooldownRemaining) {
          setCooldownSeconds(data.cooldownRemaining);
        }
        setValidationError(data.error || t('error'));
        return false;
      } else {
        setCooldownSeconds(60);
        setOtpSuccessMessage(data.message || t('otpSentSuccess'));
        return true;
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Network error sending verification code.');
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  // 2. Submit initial Signup Form (Step 1 -> Sends OTP -> Step 2)
  const handleInitialSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setValidationError(t('requiredField'));
      return;
    }

    if (!trimmedEmail) {
      setValidationError(t('requiredField'));
      return;
    }

    // Enforce Gmail address validation
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(trimmedEmail)) {
      setValidationError(t('gmailOnlyNotice'));
      return;
    }

    if (!password) {
      setValidationError(t('requiredField'));
      return;
    }

    if (password.length < 6) {
      setValidationError(
        language === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
          : 'Password must be at least 6 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setValidationError(t('passwordMismatch'));
      return;
    }

    // Request OTP via Google Apps Script
    const success = await handleRequestOtp(trimmedEmail);
    if (success) {
      setSignupStep('otp');
    }
  };

  // 3. Verify OTP & Register (Step 2 -> Apps Script verifies OTP -> Firebase SDK creates account & logs in)
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);
    setOtpSuccessMessage(null);

    const cleanedOtp = otp.trim().replace(/\D/g, '');
    if (!cleanedOtp || cleanedOtp.length !== 6) {
      setValidationError(t('otpEnterPrompt'));
      return;
    }

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();

      // 1. Verify OTP with Apps Script backend
      const verifyResult = await verifyOtpWithAppsScript(trimmedEmail, cleanedOtp);

      if (!verifyResult.success || !verifyResult.verified) {
        setValidationError(verifyResult.error || t('otpInvalid'));
        setLoading(false);
        return;
      }

      // 2. ONLY upon successful OTP verification, create Firebase account using Firebase SDK!
      await signUpWithEmail(trimmedEmail, password, name.trim(), businessName.trim());
    } catch (err: any) {
      if (err?.code === 'auth/email-already-exists') {
        setValidationError(
          language === 'bn'
            ? 'এই Gmail ঠিকানা দিয়ে ইতিমধ্যে একটি একাউন্ট খোলা আছে।'
            : 'This Gmail address is already registered.'
        );
      } else {
        setValidationError(err?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. Form Submit for Login and Forgot Password
  const handleLoginOrForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setValidationError(t('requiredField'));
      return;
    }

    if (mode === 'login') {
      if (!password) {
        setValidationError(t('requiredField'));
        return;
      }
      setLoading(true);
      try {
        await signInWithEmail(trimmedEmail, password);
      } catch (err: any) {
        // Error caught in context
      } finally {
        setLoading(false);
      }
    } else if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(trimmedEmail);
        setResetSuccess(true);
      } catch (err: any) {
        // Error caught in context
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8">
      {/* Language Switcher */}
      <div className="w-full max-w-sm flex justify-end mb-4">
        <button
          onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {language === 'bn' ? 'English' : 'বাংলা'}
        </button>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-center text-white">
          <div className="w-12 h-12 mx-auto rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 mb-3 shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {mode === 'login' && t('loginTitle')}
            {mode === 'signup' && (signupStep === 'otp' ? (language === 'bn' ? 'ইমেইল যাচাইকরণ' : 'Verify Email') : t('signupTitle'))}
            {mode === 'forgot' && t('forgotPasswordTitle')}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            {mode === 'login' && t('loginSubtitle')}
            {mode === 'signup' && (signupStep === 'otp' ? (language === 'bn' ? 'জিমেইলে প্রেরিত ৬-সংখ্যার কোডটি প্রবেশ করান' : 'Enter the 6-digit code sent to your Gmail') : (language === 'bn' ? 'জিমেইল ওটিপি ভেরিফিকেশনের মাধ্যমে নতুন একাউন্ট খুলুন' : 'Secure registration with verified Gmail'))}
            {mode === 'forgot' && t('forgotPasswordSubtitle')}
          </p>
        </div>

        {/* Tab switch between Login and Signup (only when not in OTP step or forgot) */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => handleSwitchMode('login')}
              className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'border-teal-600 text-teal-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('loginTitle')}
            </button>
            <button
              onClick={() => handleSwitchMode('signup')}
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

        {/* Body Container */}
        <div className="p-6">
          {/* Error Message */}
          {(error || validationError) && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-words flex-1">{validationError || error}</div>
            </div>
          )}

          {/* Success Notification */}
          {otpSuccessMessage && (
            <div className="mb-4 p-3 rounded-lg bg-teal-50 border border-teal-200 flex items-start space-x-2 text-teal-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
              <div className="break-words flex-1">{otpSuccessMessage}</div>
            </div>
          )}

          {/* Forgot Password Success Screen */}
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
                  handleSwitchMode('login');
                  setResetSuccess(false);
                }}
                className="inline-flex items-center text-xs font-medium text-teal-700 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> {t('backToLogin')}
              </button>
            </div>
          ) : mode === 'signup' && signupStep === 'otp' ? (
            /* ========================================================================= */
            /* STEP 2: OTP VERIFICATION & ACCOUNT CREATION SCREEN                        */
            /* ========================================================================= */
            <form onSubmit={handleVerifyAndRegister} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-500 block mb-1">
                  {t('otpStepNotice')}
                </span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {email}
                </span>
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => setSignupStep('form')}
                    className="text-[11px] text-teal-700 font-semibold hover:underline cursor-pointer inline-flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-0.5" />
                    {t('editDetailsBtn')}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-950">
                    {t('otpLabel')} *
                  </label>
                  <span className="text-[10px] text-teal-700 font-medium">৫ মিনিট কার্যকর</span>
                </div>

                <div className="relative">
                  <KeyRound className="w-4 h-4 text-teal-600 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2 text-xl font-bold tracking-widest text-teal-900 bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-center"
                  />
                </div>

                {/* Resend Button with Cooldown */}
                <button
                  type="button"
                  onClick={() => handleRequestOtp(email.trim().toLowerCase())}
                  disabled={otpLoading || cooldownSeconds > 0}
                  className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-teal-200 text-teal-800 text-[11px] font-semibold rounded-lg flex items-center justify-center space-x-1 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                  <span>
                    {cooldownSeconds > 0
                      ? `${t('otpCooldownNotice')} (${cooldownSeconds}s)`
                      : t('resendOtpBtn')}
                  </span>
                </button>
              </div>

              {/* Verify & Create Account Button */}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-bold rounded-lg shadow-sm text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                {loading ? (
                  <span>{t('processing')}</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t('verifyAndRegisterBtn')}</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ========================================================================= */
            /* STEP 1: INITIAL REGISTRATION OR LOGIN/FORGOT FORM                         */
            /* ========================================================================= */
            <form
              onSubmit={mode === 'signup' ? handleInitialSignupSubmit : handleLoginOrForgotSubmit}
              className="space-y-4"
            >
              {/* Name & Business Name (Signup Only) */}
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

              {/* Email Input */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {mode === 'signup' ? (language === 'bn' ? 'জিমেইল অ্যাড্রেস *' : 'Gmail Address *') : `${t('emailLabel')} *`}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 border border-slate-300 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Password Fields (For Login OR For Signup Form) */}
              {mode !== 'forgot' && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-slate-700">
                        {t('passwordLabel')} *
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => handleSwitchMode('forgot')}
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

                  {/* Confirm Password (Signup only) */}
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('confirmPasswordLabel')} *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          aria-label="Toggle confirm password visibility"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || otpLoading}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-semibold rounded-lg shadow-sm text-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                {loading || otpLoading ? (
                  <span>{t('processing')}</span>
                ) : (
                  <span>
                    {mode === 'login' && t('loginButton')}
                    {mode === 'signup' && t('signupButton')}
                    {mode === 'forgot' && t('resetButton')}
                  </span>
                )}
              </button>

              {/* Back to Login link from Forgot Password */}
              {mode === 'forgot' && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    {t('backToLogin')}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer info (No Google sign in, clean branding) */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500 leading-normal">
            {language === 'bn'
              ? 'নিরাপদ ডিজিটাল খাতা ও হিসাব সংরক্ষণ ব্যবস্থা।'
              : 'Secure digital ledger & debt accounting system.'}
          </p>
        </div>
      </div>
    </div>
  );
};
