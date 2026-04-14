import React, { useState } from 'react';
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, googleProvider } from '../firebase';
import { Sprout, Mail, Lock, User, ArrowRight, Eye, EyeOff, Zap } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false); // Default to Register so new users don't get confused
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name.trim()) { setError('Name is required'); setLoading(false); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Store name in localStorage temporarily until profile is created
        localStorage.setItem('pendingName', name);
      }
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
        setError('No account found with this email. Click "Sign Up" below to register first.');
      else if (code === 'auth/email-already-in-use') setError('Email already registered. Switch to Sign In below.');
      else if (code === 'auth/weak-password') setError('Password must be at least 6 characters');
      else if (code === 'auth/invalid-email') setError('Invalid email address');
      else if (code === 'auth/wrong-password') setError('Wrong password. Please try again.');
      else setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    // Demo account — pre-created
    const demoEmail = 'demo@harvestoptima.app';
    const demoPass = 'demo1234';
    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPass);
    } catch {
      try {
        // Create demo account if not exists
        await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
        localStorage.setItem('pendingName', 'Demo User');
      } catch (err2: any) { setError('Demo login failed. Please use Email/Google.'); }
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Try email/password instead.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-20 w-72 h-72 bg-amber-200/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-100/20 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
            <Sprout className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-emerald-950">HarvestOptima</h1>
          <p className="text-emerald-900/50 text-sm mt-1">Predictive Agricultural Marketplace</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-xl border border-emerald-100">
          <h2 className="text-xl font-bold text-emerald-950 mb-1">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-emerald-900/50 mb-6">
            {isLogin ? 'Sign in to your account' : 'Join the farming revolution'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name"
                  className="w-full pl-10 pr-4 py-3 bg-emerald-50/50 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required
                className="w-full pl-10 pr-4 py-3 bg-emerald-50/50 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required minLength={6}
                className="w-full pl-10 pr-10 py-3 bg-emerald-50/50 rounded-xl border border-emerald-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-emerald-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-200">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-emerald-100" />
            <span className="text-xs text-emerald-900/30 font-medium">OR</span>
            <div className="flex-1 h-px bg-emerald-100" />
          </div>

          <button onClick={handleGoogle} disabled={loading}
            className="w-full py-3 bg-white hover:bg-gray-50 border-2 border-emerald-100 rounded-xl font-bold text-sm text-emerald-950 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mb-3">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <button onClick={handleDemoLogin} disabled={loading}
            className="w-full py-3 bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-xl font-bold text-sm text-amber-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            <Zap className="w-4 h-4 text-amber-600" /> Try Demo (No signup needed)
          </button>

          <p className="mt-6 text-center text-sm text-emerald-900/50">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-emerald-600 font-bold hover:underline">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-emerald-900/30 mt-6">
          🌾 SDG 2 & 12 Aligned • Reducing food waste through technology
        </p>
      </div>
    </div>
  );
}
