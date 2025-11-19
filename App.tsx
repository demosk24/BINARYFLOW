import React, { useState, useEffect } from 'react';
import { SettingsForm } from './components/SettingsForm';
import { Dashboard } from './components/Dashboard';
import { PlanGenerator } from './components/PlanGenerator';
import { Login } from './components/Login';
import { AppState, TradeSettings, UserRole } from './types';
import { FileText, LayoutDashboard, LogOut, RotateCcw, Save, AlertTriangle } from 'lucide-react';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('USER');
  const [started, setStarted] = useState(false);
  const [view, setView] = useState<'DASHBOARD' | 'PLAN'>('DASHBOARD');
  
  // New State for "Resume" Modal
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [pendingState, setPendingState] = useState<AppState | null>(null);

  const [state, setState] = useState<AppState>(INITIAL_STATE);

  // 1. Initial Load check (Auth)
  useEffect(() => {
    const savedAuth = localStorage.getItem('binaryFlowAuth');
    const savedRole = localStorage.getItem('binaryFlowRole') as UserRole | null;
    
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
      if (savedRole) setUserRole(savedRole);
      
      // Check for saved data immediately after auth confirm
      checkForSavedSession();
    }
  }, []);

  // 2. Save Data Effect
  useEffect(() => {
    if (started && state.settings && state.settings.startCapital) {
      localStorage.setItem('binaryFlowData', JSON.stringify(state));
    }
  }, [state, started]);

  const checkForSavedSession = () => {
    const savedData = localStorage.getItem('binaryFlowData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.settings && parsedData.settings.startCapital) {
           setPendingState(parsedData);
           setShowResumePrompt(true);
           return;
        }
      } catch (e) {
        console.error("Failed to load saved data", e);
        localStorage.removeItem('binaryFlowData');
      }
    }
  };

  const handleLogin = (role: UserRole) => {
    setIsAuthenticated(true);
    setUserRole(role);
    localStorage.setItem('binaryFlowAuth', 'true');
    localStorage.setItem('binaryFlowRole', role);
    checkForSavedSession();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setStarted(false);
    setShowResumePrompt(false);
    setPendingState(null);
    localStorage.removeItem('binaryFlowAuth');
    localStorage.removeItem('binaryFlowRole');
  };

  const confirmResume = () => {
    if (pendingState) {
      setState(pendingState);
      setStarted(true);
      setShowResumePrompt(false);
    }
  };

  const confirmNewSession = () => {
    localStorage.removeItem('binaryFlowData');
    setPendingState(null);
    setState(INITIAL_STATE);
    setShowResumePrompt(false);
    setStarted(false);
  };

  const handleStart = (settings: TradeSettings) => {
    setState({
      settings,
      currentCapital: settings.startCapital,
      currentStreak: 0,
      history: [],
      cycles: [{ id: 1, trades: [], netProfit: 0, status: 'ACTIVE' }],
      currentCycleId: 1,
      isRecoveryNext: false,
      dailyTargetHit: false,
      maxLossHit: false
    });
    setStarted(true);
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all trading data? This action cannot be undone.")) {
      setStarted(false);
      localStorage.removeItem('binaryFlowData');
      setState(INITIAL_STATE);
      setView('DASHBOARD');
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Resume Prompt Modal
  if (showResumePrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl border border-neon-blue/30 pro-glow">
           <div className="text-center mb-8">
             <div className="w-14 h-14 bg-neon-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
               <Save className="text-neon-blue" />
             </div>
             <h2 className="text-2xl font-bold text-white">Resume Session?</h2>
             <p className="text-gray-400 text-sm mt-3">
               We found a previous trading session with a balance of
               <span className="text-white font-bold mx-1 text-lg">${pendingState?.currentCapital.toFixed(2)}</span>.
             </p>
           </div>
           <div className="grid grid-cols-2 gap-4">
             <button 
               onClick={confirmNewSession}
               className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-bold transition-colors"
             >
               Start New
             </button>
             <button 
               onClick={confirmResume}
               className="px-4 py-3 bg-neon-blue hover:bg-cyan-400 text-black rounded-lg font-bold transition-colors shadow-lg shadow-neon-blue/20"
             >
               Resume
             </button>
           </div>
        </div>
      </div>
    );
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
               {userRole === 'ADMIN' && (
                 <span className="px-2 py-0.5 bg-neon-purple/20 border border-neon-purple/50 text-neon-purple text-[10px] font-bold rounded uppercase">
                   Admin
                 </span>
               )}
             </div>
             <span className="text-[10px] text-gray-400 font-medium tracking-[0.2em] uppercase mt-1">Work with RAJIB</span>
           </div>
        </div>
        <div className="flex items-center gap-4">
          {started && (
            <button 
              onClick={handleReset} 
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all text-xs font-bold uppercase tracking-wide"
            >
              <RotateCcw size={14} /> Reset Data
            </button>
          )}
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-white transition-colors"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {!started ? (
          <SettingsForm onStart={handleStart} />
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex gap-6 mb-8 border-b border-gray-800 pb-1">
               <button 
                 onClick={() => setView('DASHBOARD')}
                 className={`flex items-center gap-2 px-2 py-3 text-sm font-bold border-b-2 transition-all ${view === 'DASHBOARD' ? 'border-neon-blue text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
               >
                 <LayoutDashboard size={18} /> Live Dashboard
               </button>
               <button 
                 onClick={() => setView('PLAN')}
                 className={`flex items-center gap-2 px-2 py-3 text-sm font-bold border-b-2 transition-all ${view === 'PLAN' ? 'border-neon-blue text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
               >
                 <FileText size={18} /> Daily Plan & Projections
               </button>
            </div>

            {view === 'DASHBOARD' ? (
              <Dashboard 
                state={state} 
                userRole={userRole}
                onUpdateState={setState} 
                onReset={handleReset} 
              />
            ) : (
              <PlanGenerator settings={state.settings} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;