import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import PrivacyModal from '../components/common/PrivacyModal.jsx';

export default function LoginView() {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [isSignUp,    setIsSignUp]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [message,     setMessage]     = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Account created — check your email to confirm, then sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-base px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="text-3xl font-bold text-accent tracking-widest">HangryHippo</div>
          <p className="text-sm text-slate-500">Personal nutrition tracker</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-200">
            {isSignUp ? 'Create account' : 'Sign in'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder={isSignUp ? 'At least 6 characters' : ''}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="text-center text-sm text-slate-500">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              className="text-accent hover:underline"
              onClick={() => { setIsSignUp(s => !s); setError(''); setMessage(''); }}
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 space-y-1">
          <p>
            {isSignUp ? 'By creating an account' : 'By signing in'} you agree to our{' '}
            {isSignUp ? (
              <button className="text-slate-500 hover:text-slate-300 underline underline-offset-2" onClick={() => setShowPrivacy(true)}>
                Privacy Policy
              </button>
            ) : (
              <a href="https://github.com/denny190/hangryhippo/blob/main/PRIVACY.md" className="text-slate-500 hover:text-slate-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            )}
          </p>
          <p>Open source · <a href="https://github.com/denny190/hangryhippo" className="text-slate-500 hover:text-slate-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer">MIT License</a></p>
        </div>
      </div>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
