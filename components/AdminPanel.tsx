import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, addDoc, deleteDoc } from 'firebase/firestore';
import { UserProfile, Notification, Signal, AppState } from '../types';
import { Users, Clock, ShieldAlert, Search, Bell, CheckCircle2, Signal as SignalIcon, Trash2, X, TrendingUp, Activity, AlertTriangle } from 'lucide-react';

// Helper for countdown string
const getCountdown = (target: number) => {
  const diff = target - Date.now();
  if (diff <= 0) return "00h 00m 00s";
  const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  return `${h}h ${m}m ${s}s`;
};

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [_, setTick] = useState(0); // Force re-render for timer

  // Signal Form State
  const [newSignal, setNewSignal] = useState({ pair: 'EUR/USD', direction: 'CALL', minutesUntilStart: 2, duration: 5 });

  // User Detail Modal State
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Subscribe to Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(userList);
    });

    // Subscribe to Notifications
    const qNotify = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
    const unsubNotify = onSnapshot(qNotify, (snapshot) => {
      const notifyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notifyList);
    });

    // Subscribe to Signals
    const qSignals = query(collection(db, 'signals'), orderBy('startTime', 'asc'));
    const unsubSignals = onSnapshot(qSignals, (snapshot) => {
      const sigList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Signal));
      // Filter out very old signals (older than 1 hour) locally to keep UI clean
      const freshSignals = sigList.filter(s => s.startTime > Date.now() - 3600000);
      setSignals(freshSignals);
    });

    return () => {
      unsubUsers();
      unsubNotify();
      unsubSignals();
    };
  }, []);

  // Timer & Auto-Reactivation Logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      
      // Check for expired deactivations and auto-reactivate
      users.forEach(async (user) => {
        if (!user.isActive && user.deactivatedUntil && user.deactivatedUntil <= Date.now()) {
          try {
            console.log(`Auto-reactivating user ${user.email}`);
            await updateDoc(doc(db, 'users', user.uid), {
              isActive: true,
              deactivatedUntil: null,
              'tradingState.dailyTargetHit': false,
              'tradingState.maxLossHit': false
            });
          } catch (e) {
            console.error("Auto-reactivation failed", e);
          }
        }
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [users]);

  const toggleUserActive = async (user: UserProfile) => {
    const willBeActive = !user.isActive;
    const updateData: any = {
        isActive: willBeActive,
        deactivatedUntil: null
    };

    // If activating, reset the daily flags so they can trade again immediately
    if (willBeActive && user.tradingState) {
        updateData['tradingState.dailyTargetHit'] = false;
        updateData['tradingState.maxLossHit'] = false;
    }

    await updateDoc(doc(db, 'users', user.uid), updateData);
  };

  const deactivateUserForTime = async (uid: string, minutes: number) => {
    const until = Date.now() + (minutes * 60 * 1000);
    await updateDoc(doc(db, 'users', uid), {
      isActive: false,
      deactivatedUntil: until
    });
  };

  const markNotificationRead = async (id: string) => {
     await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const handleCreateSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    const startTime = Date.now() + (newSignal.minutesUntilStart * 60 * 1000);
    
    try {
      await addDoc(collection(db, 'signals'), {
        pair: newSignal.pair.toUpperCase(),
        direction: newSignal.direction,
        startTime,
        expiresInMinutes: newSignal.duration,
        status: 'PENDING'
      });
      alert('Signal Broadcasted!');
    } catch (error) {
      console.error("Error adding signal", error);
    }
  };

  const deleteSignal = async (id: string) => {
    if(confirm("Delete this signal?")) {
      await deleteDoc(doc(db, 'signals', id));
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8">
      {/* Signal Management */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 animate-glow-blue">
         <div className="flex items-center gap-3 mb-6">
           <SignalIcon className="text-neon-blue" />
           <h2 className="text-xl font-bold text-white">Signal Broadcaster</h2>
         </div>
         
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Form */}
            <div className="lg:col-span-1 bg-gray-900/50 p-5 rounded-xl border border-gray-700">
               <h3 className="text-sm font-bold text-gray-300 mb-4">New Signal</h3>
               <form onSubmit={handleCreateSignal} className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500">Asset Pair</label>
                    <input 
                      type="text" 
                      value={newSignal.pair}
                      onChange={e => setNewSignal({...newSignal, pair: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm focus:border-neon-blue outline-none"
                      placeholder="EUR/USD"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Direction</label>
                      <select 
                        value={newSignal.direction}
                        onChange={e => setNewSignal({...newSignal, direction: e.target.value as any})}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm outline-none"
                      >
                        <option value="CALL">CALL (Buy)</option>
                        <option value="PUT">PUT (Sell)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Duration (Min)</label>
                      <input 
                        type="number" 
                        value={newSignal.duration}
                        onChange={e => setNewSignal({...newSignal, duration: Number(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Starts In (Minutes)</label>
                    <input 
                      type="number" 
                      value={newSignal.minutesUntilStart}
                      onChange={e => setNewSignal({...newSignal, minutesUntilStart: Number(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-sm outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full bg-neon-blue text-black font-bold py-2 rounded hover:bg-cyan-400 transition-colors">
                    Broadcast Signal
                  </button>
               </form>
            </div>

            {/* Active Signals List */}
            <div className="lg:col-span-2">
               <h3 className="text-sm font-bold text-gray-300 mb-4">Active Broadcasts</h3>
               <div className="overflow-y-auto max-h-64 space-y-2">
                 {signals.length === 0 && <div className="text-gray-500 text-sm italic">No active signals</div>}
                 {signals.map(sig => {
                   const timeUntil = sig.startTime - Date.now();
                   const isStarted = timeUntil <= 0;
                   return (
                     <div key={sig.id} className="flex items-center justify-between p-3 bg-gray-800/40 border border-gray-700 rounded hover:bg-gray-800/60">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${isStarted ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                          <div>
                            <div className="font-bold text-white text-sm">{sig.pair} <span className={sig.direction === 'CALL' ? 'text-green-400' : 'text-red-400'}>{sig.direction}</span></div>
                            <div className="text-xs text-gray-500">Duration: {sig.expiresInMinutes}m</div>
                          </div>
                        </div>
                        <div className="text-right">
                           <div className="text-mono text-sm font-bold text-white">
                             {isStarted ? 'ACTIVE' : `Starts in ${Math.ceil(timeUntil/60000)}m`}
                           </div>
                        </div>
                        <button onClick={() => deleteSignal(sig.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={16}/></button>
                     </div>
                   )
                 })}
               </div>
            </div>
         </div>
      </div>

      {/* Notifications Section */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 animate-glow-purple">
        <div className="flex items-center gap-3 mb-4">
           <Bell className="text-neon-purple" />
           <h2 className="text-xl font-bold text-white">Live Alerts</h2>
        </div>
        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
          {notifications.length === 0 && <p className="text-gray-500 text-sm">No recent alerts.</p>}
          {notifications.map(notif => (
            <div key={notif.id} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${notif.read ? 'bg-gray-900/30 border-gray-800 opacity-60' : 'bg-neon-purple/10 border-neon-purple/30 shadow-[0_0_10px_rgba(188,19,254,0.1)]'}`}>
              <div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{notif.userEmail}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                      {new Date(notif.timestamp).toLocaleTimeString()}
                    </span>
                    {(notif.type === 'TARGET_HIT' || notif.type === 'LOSS_LIMIT') && (
                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 font-bold border border-red-500/20">
                         LOCKED
                       </span>
                    )}
                </div>
                <p className="text-sm text-gray-300 mt-1">{notif.message}</p>
              </div>
              {!notif.read && (
                <button onClick={() => markNotificationRead(notif.id)} className="p-1 hover:text-neon-blue transition-colors">
                  <CheckCircle2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* User Management Section */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Users className="text-neon-blue" />
            <h2 className="text-xl font-bold text-white">User Management</h2>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-neon-blue transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white outline-none transition-all input-glow focus:bg-gray-800 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-500 uppercase bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Current Balance</th>
                <th className="px-4 py-3 text-center">Quick Actions</th>
                <th className="px-4 py-3 text-right rounded-r-lg">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredUsers.map(user => (
                <tr 
                  key={user.uid} 
                  className="hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={(e) => {
                    // Prevent row click if clicking a button
                    if ((e.target as HTMLElement).closest('button')) return;
                    setSelectedUser(user);
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{user.email}</div>
                    <div className="text-[10px] font-mono text-gray-500">{user.uid}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.role === 'ADMIN' ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' : 'bg-gray-700 text-gray-300'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                     {user.isActive ? (
                       <span className="text-neon-green flex items-center gap-1"><CheckCircle2 size={12} /> Active</span>
                     ) : (
                       <div className="text-red-400 flex flex-col">
                         <span className="flex items-center gap-1"><ShieldAlert size={12} /> Inactive</span>
                         {user.deactivatedUntil ? (
                           <span className="text-[10px] text-orange-400 font-mono font-bold mt-1 animate-pulse">
                             {getCountdown(user.deactivatedUntil)}
                           </span>
                         ) : (
                           <span className="text-[10px] text-red-500 font-mono font-bold">Indefinitely Suspended</span>
                         )}
                       </div>
                     )}
                  </td>
                  <td className="px-4 py-3 font-mono text-white">
                    ${user.tradingState?.currentCapital.toFixed(2) || '0.00'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => deactivateUserForTime(user.uid, 15)}
                        className="px-2 py-1 bg-gray-800 hover:bg-red-900/30 border border-gray-700 hover:border-red-500/50 rounded text-[10px] transition-all flex items-center gap-1 hover:shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                        title="Timeout 15m"
                      >
                        <Clock size={10} /> 15m
                      </button>
                      <button 
                        onClick={() => deactivateUserForTime(user.uid, 60)}
                        className="px-2 py-1 bg-gray-800 hover:bg-red-900/30 border border-gray-700 hover:border-red-500/50 rounded text-[10px] transition-all flex items-center gap-1 hover:shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                        title="Timeout 1h"
                      >
                        <Clock size={10} /> 1h
                      </button>
                      <button 
                        onClick={() => deactivateUserForTime(user.uid, 1440)}
                        className="px-2 py-1 bg-gray-800 hover:bg-red-900/30 border border-gray-700 hover:border-red-500/50 rounded text-[10px] transition-all flex items-center gap-1 hover:shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                        title="Timeout 24h"
                      >
                         <Clock size={10} /> 24h
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                     <button 
                       onClick={() => toggleUserActive(user)}
                       className={`px-3 py-1 rounded text-xs font-bold transition-all hover:scale-105 ${user.isActive ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 hover:shadow-[0_0_10px_rgba(34,197,94,0.2)]'}`}
                     >
                       {user.isActive ? 'Deactivate' : 'Reactivate'}
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedUser(null)}>
           <div className="bg-[#0f172a] border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-gray-900 to-[#0f172a]">
                 <div>
                    <h3 className="text-xl font-bold text-white">{selectedUser.email}</h3>
                    <p className="text-xs text-gray-400">UID: {selectedUser.uid}</p>
                 </div>
                 <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-800 rounded-full transition-colors"><X size={20} /></button>
              </div>
              
              <div className="p-6 max-h-[80vh] overflow-y-auto">
                 {!selectedUser.tradingState ? (
                   <div className="text-center text-gray-500 py-8">No trading data available yet.</div>
                 ) : (
                   <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                           <div className="text-gray-500 text-xs uppercase">Start Cap</div>
                           <div className="text-xl font-bold text-white">${selectedUser.tradingState.settings?.startCapital || 0}</div>
                         </div>
                         <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                           <div className="text-gray-500 text-xs uppercase">Current</div>
                           <div className="text-xl font-bold text-neon-blue">${selectedUser.tradingState.currentCapital.toFixed(2)}</div>
                         </div>
                         <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                           <div className="text-gray-500 text-xs uppercase">Net P/L</div>
                           <div className={`text-xl font-bold ${selectedUser.tradingState.currentCapital - (selectedUser.tradingState.settings?.startCapital || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${(selectedUser.tradingState.currentCapital - (selectedUser.tradingState.settings?.startCapital || 0)).toFixed(2)}
                           </div>
                         </div>
                         <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                           <div className="text-gray-500 text-xs uppercase">Streak</div>
                           <div className="text-xl font-bold text-white">{selectedUser.tradingState.currentStreak}</div>
                         </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2"><Activity size={16} /> Recent History</h4>
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                           <table className="w-full text-xs text-left text-gray-400">
                             <thead className="bg-gray-800">
                               <tr>
                                 <th className="px-4 py-2">Time</th>
                                 <th className="px-4 py-2">Type</th>
                                 <th className="px-4 py-2">Result</th>
                                 <th className="px-4 py-2 text-right">Profit</th>
                               </tr>
                             </thead>
                             <tbody>
                               {selectedUser.tradingState.history.slice().reverse().slice(0, 5).map((t, i) => (
                                 <tr key={i} className="border-b border-gray-800/50">
                                   <td className="px-4 py-2">{new Date(t.timestamp).toLocaleTimeString()}</td>
                                   <td className="px-4 py-2">{t.type}</td>
                                   <td className={`px-4 py-2 font-bold ${t.outcome === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>{t.outcome}</td>
                                   <td className="px-4 py-2 text-right text-white font-mono">{t.profit.toFixed(2)}</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                           {selectedUser.tradingState.history.length === 0 && <div className="p-4 text-center text-gray-500">No trades recorded</div>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="p-4 rounded-xl bg-red-900/10 border border-red-900/30">
                            <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-sm">
                              <AlertTriangle size={16} /> Risk Status
                            </div>
                            <div className="space-y-2 text-xs text-gray-300">
                               <div className="flex justify-between"><span>Daily Target Hit:</span> <span className={selectedUser.tradingState.dailyTargetHit ? 'text-green-400 font-bold' : 'text-gray-500'}>{selectedUser.tradingState.dailyTargetHit ? 'YES' : 'NO'}</span></div>
                               <div className="flex justify-between"><span>Max Loss Hit:</span> <span className={selectedUser.tradingState.maxLossHit ? 'text-red-400 font-bold' : 'text-gray-500'}>{selectedUser.tradingState.maxLossHit ? 'YES' : 'NO'}</span></div>
                               <div className="flex justify-between"><span>Account Active:</span> <span className={selectedUser.isActive ? 'text-green-400' : 'text-red-400'}>{selectedUser.isActive ? 'YES' : 'NO'}</span></div>
                            </div>
                         </div>
                         <div className="p-4 rounded-xl bg-blue-900/10 border border-blue-900/30">
                            <div className="flex items-center gap-2 mb-2 text-neon-blue font-bold text-sm">
                              <TrendingUp size={16} /> Settings
                            </div>
                            <div className="space-y-2 text-xs text-gray-300">
                               <div className="flex justify-between"><span>Win Rate:</span> <span>{selectedUser.tradingState.settings.winRatePercent}%</span></div>
                               <div className="flex justify-between"><span>Risk/Day:</span> <span>{selectedUser.tradingState.settings.dailyRiskPercent}%</span></div>
                               <div className="flex justify-between"><span>Payout:</span> <span>{selectedUser.tradingState.settings.profitPayoutPercent}%</span></div>
                            </div>
                         </div>
                      </div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};