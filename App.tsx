import React, { useState, useEffect } from 'react';
import { SettingsForm } from './components/SettingsForm';
import { Dashboard } from './components/Dashboard';
import { PlanGenerator } from './components/PlanGenerator';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { AppState, TradeSettings, UserRole, UserProfile } from './types';
import { FileText, LayoutDashboard, LogOut, RotateCcw, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { auth, db, ensureAdminUser } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, writeBatch, collection, getDocs, deleteField, addDoc, updateDoc } from 'firebase/firestore';

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
  const [isResetting, setIsResetting] = useState(false);
  
  // Trading State
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [started, setStarted] = useState(false);

  // Auth Listener & Real-time DB Sync
  useEffect(() => {
    ensureAdminUser();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Listen to user profile changes (live updates for activation status and state sync)
        const userRef = doc(db, 'users', user.uid);
        const unsubProfile = onSnapshot(userRef, (docSnap) => {
           if (docSnap.exists()) {
             const userData = docSnap.data() as UserProfile;
             setCurrentUser(userData);
             
             // CRITICAL: Real-time State Synchronization
             if (userData.tradingState && userData.tradingState.settings) {
                // Server has data, sync local state to match server
                setState(userData.tradingState);
                setStarted(true);
             } else {
                // Server has NO data (e.g., after a Global Reset or fresh account)
                // We must reset local state to ensure UI reflects the "Not Started" state
                setStarted(false);
                setState(INITIAL_STATE);
                
                // If user was deep in the app, bring them back to Dashboard (which shows SettingsForm if !started)
                if (view === 'PLAN' || view === 'DASHBOARD') {
                   setView('DASHBOARD');
                }
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

  const handleStart = async (settings: TradeSettings) => {
    // 1. Create the new Initial State
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

    // 2. Optimistic Local Update
    setState(newState);
    setStarted(true);
    
    // 3. Improved Flow: Show the Plan immediately so user sees what they generated
    setView('PLAN'); 

    // 4. Persist to Firebase Immediately
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          tradingState: newState,
          lastActive: Date.now()
        });
      } catch (e) {
        console.error("Failed to save initial state to DB", e);
        alert("Connection error: Could not save settings. Please check your internet.");
      }
    }
  };

  const handleReset = async () => {
    if (window.confirm("⚠️ DANGER ZONE ⚠️\n\nAre you sure you want to perform a GLOBAL RESET?\n\n1. This clears ALL trading data for ALL users.\n2. It cannot be undone.\n3. Users will see their session reset immediately.")) {
      setIsResetting(true);
      
      try {
        // Global Firebase Reset for all users
        const batch = writeBatch(db);
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(usersRef);
        
        let operationCount = 0;
        usersSnap.forEach((document) => {
          // Remove tradingState and reset activation flags
          batch.update(document.ref, { 
             tradingState: deleteField(),
             lastActive: Date.now()
          });
          operationCount++;
        });
        
        if (operationCount > 0) {
            await batch.commit();
        }

        // Log Activity
        if (currentUser) {
             await addDoc(collection(db, 'activity_logs'), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                type: 'SYSTEM',
                details: `GLOBAL RESET executed by Admin (${operationCount} users affected)`,
                timestamp: Date.now()
            });
        }

        // System Notification
        await addDoc(collection(db, 'notifications'), {
            userId: 'SYSTEM',
            userEmail: 'SYSTEM',
            type: 'SYSTEM',
            message: `System Wide Reset Performed by Admin`,
            timestamp: Date.now(),
            read: false
        });

        // Delay for visual effect
        await new Promise(r => setTimeout(r, 1500));

        alert("✅ SYSTEM WIPE COMPLETE.\n\nAll trading data has been purged.");
      } catch (e) {
        console.error("Global reset failed:", e);
        alert("Global reset encountered an error. Check console.");
      } finally {
        setIsResetting(false);
      }
    }
  };

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-neon-blue font-mono bg-[#020617]">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin w-10 h-10" />
            <span className="text-sm tracking-[0.2em] animate-pulse">INITIALIZING SECURITY PROTOCOLS...</span>
        </div>
    </div>;
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen pb-12 px-4 sm:px-6 relative">
      {/* Global Reset Overlay */}
      {isResetting && (
        <div className="fixed inset-0 z-[100] bg-red-900/90 backdrop-blur-lg flex flex-col items-center justify-center text-white">
           <div className="w-24 h-24 border-4 border-white border-t-transparent rounded-full animate-spin mb-6"></div>
           <h2 className="text-4xl font-black uppercase tracking-widest mb-2">System Purge</h2>
           <p className="text-red-200 font-mono">Wiping Database Records...</p>
        </div>
      )}

      {/* Header */}
      <header className="max-w-7xl mx-auto py-8 flex flex-col md:flex-row justify-between items-center gap-6 mb-6">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-gradient-to-br from-neon-blue to-blue-600 rounded-xl flex items-center justify-center font-bold text-black text-2xl shadow-lg shadow-neon-blue/20 animate-glow-blue">B</div>
           <div className="flex flex-col justify-center">
             <div className="flex items-center gap-2">
               <span className="text-2xl font-bold text-white tracking-wider leading-none">BINARY<span className="text-neon-blue">FLOW</span></span>
               {currentUser.role === 'ADMIN' && (
                 <span className="px-2 py-0.5 bg-neon-purple/20 border border-neon-purple/50 text-neon-purple text-[10px] font-bold rounded uppercase shadow-[0_0_10px_rgba(188,19,254,0.3)]">
                   Admin Mode
                 </span>
               )}
             </div>
             <span className="text-[10px] text-gray-400 font-medium tracking-[0.3em] uppercase mt-1">Professional Trading Intelligence</span>
           </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Only Admin can reset data manually */}
          {view !== 'ADMIN' && currentUser.role === 'ADMIN' && (
            <button 
              onClick={handleReset} 
              className="group flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-lg transition-all text-xs font-bold uppercase tracking-wide hover:shadow-[0_0_20px_rgba(220,38,38,0.6)]"
            >
              <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-500" /> 
              Global Reset
            </button>
          )}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
            <img src={auth.currentUser?.photoURL || "https://www.gravatar.com/avatar/?d=mp"} alt="User" className="w-8 h-8 rounded-full border border-gray-700 shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
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
              disabled={!started}
              className={`flex items-center gap-2 px-2 py-3 text-sm font-bold border-b-2 transition-all ${view === 'DASHBOARD' ? 'border-neon-blue text-white text-shadow-neon' : 'border-transparent text-gray-500 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'}`}
            >
              <LayoutDashboard size={18} /> Live Dashboard
            </button>
            
            <button 
              onClick={() => setView('PLAN')}
              disabled={!started}
              className={`flex items-center gap-2 px-2 py-3 text-sm font-bold border-b-2 transition-all ${view === 'PLAN' ? 'border-neon-blue text-white text-shadow-neon' : 'border-transparent text-gray-500 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'}`}
            >
              <FileText size={18} /> Daily Plan
            </button>

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
          <PlanGenerator settings={state.settings} onStartTrading={() => setView('DASHBOARD')} />
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