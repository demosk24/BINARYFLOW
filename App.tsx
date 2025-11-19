import React, { useState, useEffect } from 'react';
import { SettingsForm } from './components/SettingsForm';
import { Dashboard } from './components/Dashboard';
import { PlanGenerator } from './components/PlanGenerator';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { AppState, TradeSettings, UserRole, UserProfile } from './types';
import { FileText, LayoutDashboard, LogOut, RotateCcw, Users, AlertTriangle } from 'lucide-react';
import { auth, db, ensureAdminUser } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, writeBatch, collection, getDocs, deleteField } from 'firebase/firestore';

const INITIAL_STATE: AppState = {
  settings: {} as TradeSettings,
  currentCapital: 0,
  currentStreak: 0,
  history: [],
  cycles: [{ id: 1, trades: [], netProfit: 0, status: 'ACTIVE' }],
  currentCycleId: 1,
  isRecoveryNext: false,
  dailyTargetHit: false,
  maxLossHit: false
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [view, setView] = useState<'DASHBOARD' | 'PLAN' | 'ADMIN'>('DASHBOARD');
  
  // Trading State
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [started, setStarted] = useState(false);

  // Auth Listener & Admin Check
  useEffect(() => {
    // Attempt to seed admin (optional check on load)
    ensureAdminUser();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Listen to user profile changes (live updates for activation status)
        const userRef = doc(db, 'users', user.uid);
        const unsubProfile = onSnapshot(userRef, (docSnap) => {
           if (docSnap.exists()) {
             const userData = docSnap.data() as UserProfile;
             setCurrentUser(userData);
             
             // If user has saved state in DB, load it
             if (userData.tradingState && userData.tradingState.settings && !started) {
                setState(userData.tradingState);
                setStarted(true);
             }
           }
        });
        setLoadingAuth(false);
        return () => unsubProfile();
      } else {
        setCurrentUser(null);
        setStarted(false);
        setState(INITIAL_STATE);
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleStart = (settings: TradeSettings) => {
    const newState: AppState = {
      settings,
      currentCapital: settings.startCapital,
      currentStreak: 0,
      history: [],
      cycles: [{ id: 1, trades: [], netProfit: 0, status: 'ACTIVE' }],
      currentCycleId: 1,
      isRecoveryNext: false,
      dailyTargetHit: false,
      maxLossHit: false
    };
    setState(newState);
    setStarted(true);
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset all trading data? This action cannot be undone and will clear data for ALL users.")) {
      // Local Reset
      setStarted(false);
      setState(INITIAL_STATE);
      setView('DASHBOARD');

      // Global Firebase Reset for all users
      try {
        const batch = writeBatch(db);
        const usersSnap = await getDocs(collection(db, 'users'));
        
        usersSnap.forEach((document) => {
          batch.update(document.ref, { 
             tradingState: deleteField() 
          });
        });
        
        await batch.commit();
        alert("System-wide reset complete.");
      } catch (e) {
        console.error("Global reset failed:", e);
        alert("Global reset failed. Check console for details.");
      }
    }
  };

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-neon-blue font-mono bg-[#020203]">Initializing System...</div>;
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen pb-12 px-4 sm:px-6">
      {/* Header */}
      <header className="max-w-7xl mx-auto py-8 flex flex-col md:flex-row justify-between items-center gap-6 mb-6">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-gradient-to-br from-neon-blue to-blue-600 rounded-xl flex items-center justify-center font-bold text-black text-2xl shadow-lg shadow-neon-blue/20">B</div>
           <div className="flex flex-col justify-center">
             <div className="flex items-center gap-2">
               <span className="text-2xl font-bold text-white tracking-wider leading-none">BINARY<span className="text-neon-blue">FLOW</span></span>
               {currentUser.role === 'ADMIN' && (
                 <span className="px-2 py-0.5 bg-neon-purple/20 border border-neon-purple/50 text-neon-purple text-[10px] font-bold rounded uppercase">
                   Admin
                 </span>
               )}
             </div>
             <span className="text-[10px] text-gray-400 font-medium tracking-[0.2em] uppercase mt-1">Professional Management</span>
           </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Only Admin can reset data manually */}
          {started && view !== 'ADMIN' && currentUser.role === 'ADMIN' && (
            <button 
              onClick={handleReset} 
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all text-xs font-bold uppercase tracking-wide"
            >
              <RotateCcw size={14} /> Admin Reset
            </button>
          )}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
            <img src={auth.currentUser?.photoURL || "https://www.gravatar.com/avatar/?d=mp"} alt="User" className="w-8 h-8 rounded-full border border-gray-700" />
            <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-white transition-colors"
            >
                <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex gap-6 mb-8 border-b border-gray-800 pb-1">
            <button 
              onClick={() => setView('DASHBOARD')}
              className={`flex items-center gap-2 px-2 py-3 text-sm font-bold border-b-2 transition-all ${view === 'DASHBOARD' ? 'border-neon-blue text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              <LayoutDashboard size={18} /> Live Dashboard
            </button>
            
            {started && (
              <button 
                onClick={() => setView('PLAN')}
                className={`flex items-center gap-2 px-2 py-3 text-sm font-bold border-b-2 transition-all ${view === 'PLAN' ? 'border-neon-blue text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <FileText size={18} /> Daily Plan
              </button>
            )}

            {currentUser.role === 'ADMIN' && (
              <button 
                onClick={() => setView('ADMIN')}
                className={`flex items-center gap-2 px-2 py-3 text-sm font-bold border-b-2 transition-all ${view === 'ADMIN' ? 'border-neon-purple text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <Users size={18} /> Admin Panel
              </button>
            )}
        </div>

        {view === 'ADMIN' && currentUser.role === 'ADMIN' ? (
          <AdminPanel />
        ) : view === 'PLAN' && started ? (
          <PlanGenerator settings={state.settings} />
        ) : (
          !started ? (
            <SettingsForm onStart={handleStart} />
          ) : (
            <Dashboard 
              state={state} 
              userProfile={currentUser}
              onUpdateState={setState} 
              onReset={handleReset} 
            />
          )
        )}
      </main>
    </div>
  );
};

export default App;