import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../store/AuthContext';

type AuthMode = 'login' | 'signup' | 'reset';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, resetPassword, isLoading, error, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    clearError();
    setLocalError(null);
    setSuccessMessage(null);
  };

  const displayError = localError || error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        await signUp(email, password);
        setSuccessMessage('Account created! Check your email to verify your account.');
      } else if (mode === 'reset') {
        await resetPassword(email);
        setSuccessMessage('Password reset link sent. Check your inbox.');
      }
    } catch {
      // error is handled by AuthContext
    }
  };

  return (
    <div className="min-h-screen bg-[#030207] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-purple-900/8 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[5%] right-[5%] w-[500px] h-[500px] bg-pink-900/8 rounded-full filter blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-950/50">
            <div className="absolute inset-0.5 rounded-full bg-[#030207] flex items-center justify-center">
              <Brain className="w-7 h-7 text-purple-400 animate-cosmic-pulse" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              Black<span className="text-purple-400">Hole</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">Zero Friction. AI-profiled Cloud Storage.</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0b0a12]/90 backdrop-blur-xl border border-purple-950/30 rounded-2xl p-8 shadow-2xl shadow-purple-950/20">
          {/* Mode Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-[#070610]/60 rounded-xl">
            {(['login', 'signup'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer capitalize ${
                  mode === m
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Title */}
              <div className="mb-2">
                <h2 className="text-lg font-bold text-white">
                  {mode === 'login' && 'Welcome back'}
                  {mode === 'signup' && 'Create your vault'}
                  {mode === 'reset' && 'Reset password'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {mode === 'login' && 'Sign in to access your file vault.'}
                  {mode === 'signup' && 'Set up your encrypted personal vault.'}
                  {mode === 'reset' && "Enter your email and we'll send a reset link."}
                </p>
              </div>

              {/* Error Banner */}
              <AnimatePresence>
                {displayError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-start gap-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl p-3"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-300">{displayError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Banner */}
              <AnimatePresence>
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-start gap-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-300">{successMessage}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete={mode === 'login' ? 'email' : 'email'}
                  className="w-full bg-[#070610]/80 border border-purple-950/40 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600/60 focus:ring-1 focus:ring-purple-600/30 transition-all"
                />
              </div>

              {/* Password */}
              {mode !== 'reset' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="w-full bg-[#070610]/80 border border-purple-950/40 rounded-xl px-4 py-3 pr-12 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600/60 focus:ring-1 focus:ring-purple-600/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="w-full bg-[#070610]/80 border border-purple-950/40 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600/60 focus:ring-1 focus:ring-purple-600/30 transition-all"
                  />
                </div>
              )}

              {/* Forgot password link */}
              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => handleModeChange('reset')}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' && 'Sign In'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'reset' && 'Send Reset Link'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Back to login (from reset) */}
              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors mt-2 cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              )}
            </motion.form>
          </AnimatePresence>
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-6">
          Secured with Supabase Auth · End-to-end encrypted vault
        </p>
      </motion.div>
    </div>
  );
};
