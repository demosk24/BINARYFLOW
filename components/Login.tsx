import React, { useState } from 'react';
import { Lock, ArrowRight, UserCircle } from 'lucide-react';
import { UserRole } from '../types';

interface Props {
  onLogin: (role: UserRole) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@gmail.com' && password === 'admin') {
      onLogin('ADMIN');
    } else if (email === 'user@gmail.com' && password === 'user') {
      onLogin('USER');
    } else {
      setError('Invalid credentials. Access denied.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden intl-glow">
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700 shadow-[0_0_15px_rgba(0,243,255,0.3)]">
            <Lock className="text-neon-blue w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Secure Access</h1>
          <p className="text-gray-400 text-sm mt-2">BinaryFlow Pro Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Authorized Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-neon-blue outline-none focus:ring-1 focus:ring-neon-blue transition-all"
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Security Key</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-neon-purple outline-none focus:ring-1 focus:ring-neon-purple transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-4 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold rounded-lg text-lg hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,243,255,0.4)] flex items-center justify-center gap-2"
          >
            Authenticate <ArrowRight size={20} />
          </button>

          <div className="text-center pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Available Test Accounts:</p>
            <div className="flex justify-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><UserCircle size={12} /> Admin: admin/admin</span>
              <span className="flex items-center gap-1"><UserCircle size={12} /> User: user/user</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};