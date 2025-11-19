import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { auth, db, googleProvider, ADMIN_CREDENTIALS } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const Login: React.FC = () => {
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/admin') {
      setIsAdminLogin(true);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user doc exists, if not create it
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          role: 'USER',
          isActive: true,
          deactivatedUntil: null,
          lastActive: Date.now()
        });
      }
    } catch (err: any) {
      console.error(err);
      setError('Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Hardcoded logic for "admin" / "admin" requirement
    if (username === 'admin' && password === ADMIN_CREDENTIALS.password) {
      try {
        // Try to sign in with the real internal credentials
        await signInWithEmailAndPassword(auth, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
      } catch (err: any) {
         setError('Admin authentication failed.');
           }
    } else {
      setError('Invalid administrative credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#020203]">
      <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden animate-glow-blue">
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700 shadow-[0_0_25px_rgba(0,243,255,0.3)] animate-pulse">
            <Lock className="text-neon-blue w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BinaryFlow Pro</h1>
          <p className="text-gray-400 text-sm mt-2">
            {isAdminLogin ? 'Administrative Access' : 'Secure Trading Portal'}
          </p>
        </div>

        {isAdminLogin ? (
          <form onSubmit={handleAdminLogin} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none transition-all input-glow focus:bg-gray-800"
                placeholder="Enter username"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none transition-all input-glow focus:bg-gray-800"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm text-center flex items-center justify-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="btn-shine w-full py-4 bg-gradient-to-r from-neon-red to-purple-600 text-white font-bold rounded-lg text-lg hover:opacity-90 transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Access Admin Panel'}
            </button>

            <div className="text-center pt-4">
              <button 
                type="button"
                onClick={() => { setIsAdminLogin(false); setError(''); }}
                className="text-sm text-gray-500 hover:text-white transition-colors"
              >
                Back to User Login
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 relative z-10">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn-shine w-full py-4 bg-white text-gray-900 font-bold rounded-lg text-lg hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
              Sign in with Google
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-800"></div>
              <span className="flex-shrink-0 mx-4 text-gray-600 text-xs uppercase">System Access</span>
              <div className="flex-grow border-t border-gray-800"></div>
            </div>
            
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm text-center">
                 {error}
              </div>
            )}

            <div className="text-center">
               <button                 
                 className="flex items-center justify-center gap-2 mx-auto text-sm text-gray-500 hover:text-neon-blue transition-colors hover:underline"
               >
                 <ShieldCheck size={14} /> Admin Login
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
