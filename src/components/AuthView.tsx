import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import unithaiLogo from '../assets/images/unithai_official_original_logo.jpg';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { SupabaseBadge } from './SupabaseBadge';
import {
  Lock,
  Mail,
  User,
  BadgeAlert,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Anchor,
  Sparkles,
} from 'lucide-react';

export const AuthView: React.FC = () => {
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const { login, register, resetPassword, switchDemoUser, loading, error: authError } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Form State
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setResetSuccess(false);

    if (mode === 'login') {
      if (!email || !password) {
        setFormError(language === 'th' ? 'กรุณากรอกทั้งอีเมลและรหัสผ่าน' : 'Please enter both email and password.');
        return;
      }
      const res = await login(email, password);
      if (!res.success && res.error) {
        setFormError(res.error);
      }
    } else if (mode === 'register') {
      if (!fullName.trim()) {
        setFormError(language === 'th' ? 'กรุณาระบุชื่อ-นามสกุล' : 'Please enter your full name.');
        return;
      }
      if (!employeeId.trim()) {
        setFormError(language === 'th' ? 'กรุณาระบุรหัสพนักงาน (เช่น UT-02488)' : 'Please enter your Employee ID (e.g. UT-02488).');
        return;
      }
      if (!email.trim()) {
        setFormError(language === 'th' ? 'กรุณาระบุอีเมลองค์กรที่ถูกต้อง' : 'Please enter a valid work email.');
        return;
      }
      if (password.length < 6) {
        setFormError(language === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError(language === 'th' ? 'รหัสผ่านไม่ตรงกัน' : 'Passwords do not match.');
        return;
      }

      const res = await register({
        fullName,
        employeeId,
        email,
        password,
      });

      if (!res.success && res.error) {
        setFormError(res.error);
      }
    } else if (mode === 'forgot') {
      if (!email.trim()) {
        setFormError(language === 'th' ? 'กรุณากรอกอีเมลที่ลงทะเบียนไว้' : 'Please enter your registered email address.');
        return;
      }
      const res = await resetPassword(email);
      if (res.success) {
        setResetSuccess(true);
      } else {
        setFormError(res.error || (language === 'th' ? 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้' : 'Failed to send password reset email.'));
      }
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Top Bar with Logo, Language Toggle, Supabase Status & Dark/Bright Toggle */}
      <header
        className={`w-full border-b px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200'
        } backdrop-blur-md sticky top-0 z-20`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-300 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
            <img src={unithaiLogo} alt="Unithai Shipyard Official Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base font-sans">{t.appTitle}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                {t.srmSystem}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <SupabaseBadge />
          <ThemeToggle showLabel={false} />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div
            className={`rounded-2xl border p-6 sm:p-8 shadow-2xl transition-all ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Header info */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-3 shadow-inner">
                <Anchor className="w-7 h-7" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                {mode === 'login' && t.signInTitle}
                {mode === 'register' && t.registerTitle}
                {mode === 'forgot' && t.forgotTitle}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'login' && t.signInSub}
                {mode === 'register' && t.registerSub}
                {mode === 'forgot' && t.forgotSub}
              </p>
            </div>

            {/* Error or Success notification */}
            {(formError || authError) && (
              <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError || authError}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {language === 'th'
                    ? 'ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว'
                    : 'Password reset link has been dispatched to your email address.'}
                </span>
              </div>
            )}

            {/* Forms */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t.fullName}</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t.fullNamePlaceholder}
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-hidden transition-all ${
                          isDark
                            ? 'bg-slate-800/80 border-slate-700 text-white focus:border-cyan-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-600'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {t.employeeId} <span className="text-[10px] text-slate-400">{t.employeeIdSub}</span>
                    </label>
                    <div className="relative">
                      <BadgeAlert className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="UT-02488"
                        className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border font-mono focus:outline-hidden transition-all ${
                          isDark
                            ? 'bg-slate-800/80 border-slate-700 text-white focus:border-cyan-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-600'
                        }`}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t.email}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@unithai.com"
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-hidden transition-all ${
                      isDark
                        ? 'bg-slate-800/80 border-slate-700 text-white focus:border-cyan-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-600'
                    }`}
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">{t.password}</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setFormError(null);
                        }}
                        className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                      >
                        {t.forgotPasswordLink}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-hidden transition-all ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:border-cyan-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-600'
                      }`}
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t.confirmPassword}</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-hidden transition-all ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 text-white focus:border-cyan-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-600'
                      }`}
                    />
                  </div>

                  <div className="mt-2.5 p-2 rounded-lg bg-slate-800/40 border border-slate-700/60 text-[10px] text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{t.securityRuleSRM}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>
                      {mode === 'login' && t.signInBtn}
                      {mode === 'register' && t.registerBtn}
                      {mode === 'forgot' && t.sendResetBtn}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Modes */}
            <div className="mt-6 pt-5 border-t border-slate-800/70 text-center text-xs text-slate-400">
              {mode === 'login' ? (
                <p>
                  {t.noAccountYet}{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setFormError(null);
                    }}
                    className="text-cyan-400 font-semibold hover:underline cursor-pointer"
                  >
                    {t.registerHere}
                  </button>
                </p>
              ) : (
                <p>
                  {t.alreadyHaveAccount}{' '}
                  <button
                    onClick={() => {
                      setMode('login');
                      setFormError(null);
                    }}
                    className="text-cyan-400 font-semibold hover:underline cursor-pointer"
                  >
                    {t.signInInstead}
                  </button>
                </p>
              )}
            </div>

            {/* One-Click Quick Test Accounts */}
            <div className="mt-6 p-3 rounded-xl border border-dashed border-slate-700/80 bg-slate-800/30 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.quickTestAccess}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchDemoUser('ADMIN')}
                  className="py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[11px] text-left transition-all cursor-pointer"
                >
                  <span className="block font-bold">Admin Somchai</span>
                  <span className="text-[9px] text-slate-400">{t.adminSomchaiDesc}</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchDemoUser('SRM')}
                  className="py-1.5 px-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] text-left transition-all cursor-pointer"
                >
                  <span className="block font-bold">SRM Ing (Preecha)</span>
                  <span className="text-[9px] text-slate-400">{t.srmIngDesc}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-800/40">
        <p>© 2026 Unithai Shipyard & Engineering Limited. All Rights Reserved. Laem Chabang Deep Sea Port, Thailand.</p>
      </footer>
    </div>
  );
};
