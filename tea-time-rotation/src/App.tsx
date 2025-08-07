import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OrderForm from './components/OrderForm';
import Summary from './components/Summary';
import DangerZone from './components/DangerZone';
import Modal from './components/ui/Modal';
import { useModal } from './hooks/useModal';
import AddUserModal from './components/AddUserModal';
import { useAddUserModal } from './hooks/useAddUserModal';
import PinModal from './components/ui/PinModal';
import { usePinModal } from './hooks/usePinModal';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';

interface Session {
  id: string;
  status: 'active' | 'completed';
}

interface Order {
  user_id: string;
  drink_type: string;
  sugar_level: string;
}

interface User {
  id: string;
  name: string;
  last_ordered_drink: string;
  last_sugar_level: string;
}

function App() {
  const { session: authSession, profile, loading } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lastAssignee, setLastAssignee] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const { isOpen, config, onConfirm, closeModal, showError, showConfirm } = useModal();
  const { isModalOpen, openModal, closeModal: closeAddUserModal } = useAddUserModal();
  const { isPinModalOpen, onConfirm: onPinConfirm, showPinModal, closePinModal } = usePinModal();
  const [kettleClicks, setKettleClicks] = useState(0);

  useEffect(() => {
    const fetchAllData = async (currentSession: Session) => {
      const [ordersData, usersData] = await Promise.all([
        supabase.from('orders').select('*').eq('session_id', currentSession.id),
        supabase.from('users').select('id, name, last_ordered_drink, last_sugar_level'),
      ]);
      if (ordersData.data) setOrders(ordersData.data);
      if (usersData.data) setUsers(usersData.data);
    };

    const fetchSession = async () => {
      const { count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true });
      
      if (count) setTotalSessions(count);

      const { data: lastSession } = await supabase
        .from('sessions')
        .select('assignee_name')
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

      if (lastSession) {
        setLastAssignee(lastSession.assignee_name);
      }

      // First, try to find an active session
      const { data: sessionData, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active')
        .single();

      // If no active session, check for a recently completed one
      if (!sessionData && (!error || error.code === 'PGRST116')) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: completedData } = await supabase
          .from('sessions')
          .select('*, assignee_name')
          .eq('status', 'completed')
          .gte('ended_at', fiveMinutesAgo)
          .order('ended_at', { ascending: false })
          .limit(1)
          .single();
        setSession(completedData);
        if (completedData) {
          fetchAllData(completedData);
        }
      } else {
        setSession(sessionData);
        if (sessionData) fetchAllData(sessionData);
      }
    };

    fetchSession();

    const sessionListener = supabase
      .channel('sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          fetchSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionListener);
    };
  }, []);

  // Function to fetch all data for a session
  const fetchAllData = async (currentSession: Session) => {
    const [ordersData, usersData] = await Promise.all([
      supabase.from('orders').select('*').eq('session_id', currentSession.id),
      supabase.from('users').select('id, name, last_ordered_drink, last_sugar_level'),
    ]);
    if (ordersData.data) setOrders(ordersData.data);
    if (usersData.data) setUsers(usersData.data);
  };

  // Separate useEffect for orders listener that depends on session
  useEffect(() => {
    if (!session) return;

    const ordersListener = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchAllData(session);
        }
      )
      .subscribe();

    // Fetch initial data for this session
    fetchAllData(session);

    return () => {
      supabase.removeChannel(ordersListener);
    };
  }, [session]);

  const handleStartSession = async () => {
    const { data } = await supabase.from('sessions').insert([{ status: 'active' }]).select().single();
    setSession(data);
  };

  const handleUserAdded = async () => {
    if (session) {
      fetchAllData(session);
    }
  };

  const handleKettleClick = () => {
    if (profile?.permissions.includes('can_add_user')) {
      const newClicks = kettleClicks + 1;
      setKettleClicks(newClicks);
      if (newClicks >= 5) {
        openModal();
        setKettleClicks(0); // Reset after opening
      }
    }
  };

  const handleSummarizeSession = async () => {
    if (!session || !profile?.permissions.includes('can_summarize_session')) {
      showError('Permission Denied', 'You do not have permission to summarize the session.');
      return;
    }

    showConfirm(
      'Finalize Tea Time?',
      'This will complete the session and assign someone to make tea. Everyone will see the results.',
      async () => {
        try {
          const { error } = await supabase.functions.invoke('summarize', {
            body: { session_id: session.id },
          });

          if (error) {
            console.error('Summarize function error:', error);
            showError('Session Error', `Could not finalize the session: ${error.message}`);
            return;
          }
          
          // Force refresh the session data to get updated status
          const { data: updatedSession } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', session.id)
            .single();
          
          if (updatedSession) {
            setSession(updatedSession);
          }
        } catch (err) {
          console.error('Unexpected error during summarize:', err);
          showError('Unexpected Error', 'Something went wrong. Please try again.');
        }
      },
      'Finalize Session',
      'Cancel'
    );
  };

  const handleAbandonSession = async () => {
    if (!session || !profile?.permissions.includes('can_abandon_session')) {
      showError('Permission Denied', 'You do not have permission to abandon the session.');
      return;
    }

    showPinModal(async () => {
      try {
        // First, delete all orders associated with the session
        const { error: deleteOrdersError } = await supabase
          .from('orders')
          .delete()
          .eq('session_id', session.id);

        if (deleteOrdersError) {
          throw deleteOrdersError;
        }

        // Then, delete the session itself
        const { error: deleteSessionError } = await supabase
          .from('sessions')
          .delete()
          .eq('id', session.id);

        if (deleteSessionError) {
          throw deleteSessionError;
        }

        setSession(null);
        setOrders([]);
      } catch (err) {
        console.error('Unexpected error during abandon:', err);
        showError('Unexpected Error', 'Something went wrong. Please try again.');
      }
    });
  };

  const handleShowLastSession = async () => {
    const { data: lastSession } = await supabase
      .from('sessions')
      .select('*, assignee_name')
      .eq('status', 'completed')
      .order('ended_at', { ascending: false })
      .limit(1)
      .single();

    if (lastSession) {
      setSession(lastSession);
      fetchAllData(lastSession);
    } else {
      showError('No Sessions Found', 'There are no completed sessions to display.');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authSession) {
    return <Auth />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20 flex flex-col sm:flex-row items-end sm:items-center sm:space-x-4">
        <span className="text-gray-700">Welcome, {profile?.name}</span>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-2 sm:mt-0"
        >
          Logout
        </button>
      </div>
      {/* Enhanced Background for Better Visibility */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-primary-50 to-chai-100"></div>
      
      {/* Subtle Tea Elements - Reduced for Better Visibility */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-4xl opacity-5 floating" style={{animationDelay: '0s'}}>🍃</div>
        <div className="absolute top-32 right-20 text-3xl opacity-8 floating" style={{animationDelay: '2s'}}>🫖</div>
        <div className="absolute bottom-40 left-16 text-4xl opacity-5 floating" style={{animationDelay: '4s'}}>☕</div>
        <div className="absolute bottom-20 right-32 text-2xl opacity-8 floating" style={{animationDelay: '1s'}}>🍃</div>
        <div className="absolute top-1/2 left-4 text-3xl opacity-5 floating" style={{animationDelay: '3s'}}>🍵</div>
      </div>
      
      {/* Enhanced Mobile-Friendly Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 pt-24 sm:pt-6">
        {/* Enhanced Mobile-First Logo/Header Section */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in px-4">
          <div className="relative inline-block" onClick={handleKettleClick} style={{ cursor: 'pointer' }}>
            <div className="absolute -inset-4 bg-gradient-to-r from-primary-500 to-chai-500 rounded-full blur-lg opacity-20 animate-pulse-slow"></div>
            <div className="relative text-6xl sm:text-7xl lg:text-8xl animate-bounce-subtle">🫖</div>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-gray-800 leading-tight mt-3 sm:mt-4 mb-2 drop-shadow-sm">
            Tea Time
          </h1>
          <p className="text-gray-700 text-sm sm:text-base lg:text-lg font-semibold">Your premium quali-tea experience</p>
        </div>

        {/* Enhanced Mobile-First Main Card */}
        <div className="w-full max-w-2xl bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl lg:rounded-3xl p-3 sm:p-6 lg:p-10 animate-scale-in shadow-2xl border border-gray-200 mx-3 sm:mx-4">
          <div className="space-y-6 sm:space-y-8">
            {session ? (
              session.status === 'active' ? (
                <div className="animate-slide-up">
                  <OrderForm 
                    session={session} 
                    orders={orders} 
                    users={users} 
                    onOrderUpdate={() => fetchAllData(session)}
                  />
                </div>
              ) : (
                <div className="animate-scale-in">
                  <Summary session={session} onNewSession={handleStartSession} />
                </div>
              )
            ) : (
              <div className="text-center space-y-6 sm:space-y-8 animate-fade-in">
                {/* Enhanced Welcome Section */}
                <div className="space-y-4 sm:space-y-6 px-4">
                  <div className="inline-block bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl px-6 py-4 border-2 border-green-200">
                    <div className="flex items-center justify-center mb-3">
                      <span className="text-3xl sm:text-4xl mr-3">☕</span>
                      <span className="text-3xl sm:text-4xl mr-3">🍵</span>
                      <span className="text-3xl sm:text-4xl">🫖</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Ready for Tea Time?</h2>
                    <p className="text-gray-700 text-base sm:text-lg font-medium">Gather everyone and start brewing memories!</p>
                  </div>
                  
                  {/* Stats */}
                  <div className="mt-6 bg-white/80 border border-gray-200 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Session Stats</h3>
                    <div className="text-left text-gray-600 space-y-1">
                      {totalSessions > 0 && (
                        <p>📈 Total Sessions: <strong>{totalSessions}</strong></p>
                      )}
                      {lastAssignee && (
                        <p>🏆 Last Sponsor: <strong>{lastAssignee}</strong></p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-center space-y-4">
                  <button
                    onClick={handleStartSession}
                    className="btn-primary text-lg sm:text-xl font-bold px-6 sm:px-8 py-3 sm:py-4 group relative overflow-hidden rounded-xl sm:rounded-2xl w-full max-w-xs sm:max-w-sm"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      <span className="mr-3 text-xl sm:text-2xl group-hover:animate-bounce">🚀</span>
                      <span className="text-base sm:text-lg">Start Tea Time</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  </button>
                  <button
                    onClick={handleShowLastSession}
                    className="btn-primary text-lg sm:text-xl font-bold px-6 sm:px-8 py-3 sm:py-4 group relative overflow-hidden rounded-xl sm:rounded-2xl w-full max-w-xs sm:max-w-sm"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      <span className="mr-3 text-xl sm:text-2xl group-hover:animate-bounce">🧐</span>
                      <span className="text-base sm:text-lg">Show Last Tea Time</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                  </button>
                </div>
              </div>
            )}
            
            {session && session.status === 'active' && (
              <DangerZone title="Danger Zone">
                <div className="pt-8 flex flex-col items-center space-y-4 animate-slide-up" style={{animationDelay: '0.2s'}}>
                  <button
                    onClick={handleSummarizeSession}
                    className="btn-secondary text-lg sm:text-xl font-bold px-6 sm:px-8 py-3 sm:py-4 group relative overflow-hidden rounded-xl sm:rounded-2xl w-full max-w-xs sm:max-w-sm"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      <span className="mr-3 text-xl sm:text-2xl group-hover:animate-pulse">📋</span>
                      <span className="text-base sm:text-lg">Summarize Tea Time</span>
                    </span>
                  </button>
                  <button
                    onClick={handleAbandonSession}
                    className="btn-danger text-lg sm:text-xl font-bold px-6 sm:px-8 py-3 sm:py-4 group relative overflow-hidden rounded-xl sm:rounded-2xl w-full max-w-xs sm:max-w-sm"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      <span className="mr-3 text-xl sm:text-2xl group-hover:animate-spin">🗑️</span>
                      <span className="text-base sm:text-lg">Abandon Tea Time</span>
                    </span>
                  </button>
                </div>
              </DangerZone>
            )}
          </div>
        </div>
        
        {/* Enhanced Footer */}
        <footer className="text-center mt-12 px-4 animate-fade-in" style={{animationDelay: '0.5s'}}>
          <div className="bg-white/90 border-2 border-gray-200 rounded-2xl px-8 py-4 inline-block shadow-lg">
            <p className="text-gray-700 text-lg font-semibold">
              Crafted with <span className="text-2xl mx-2 animate-pulse">💛</span> for tea enthusiasts
            </p>
            <div className="flex justify-center space-x-4 mt-2 text-2xl">
              <span className="animate-bounce-subtle" style={{animationDelay: '0s'}}>🍵</span>
              <span className="animate-bounce-subtle" style={{animationDelay: '0.2s'}}>☕</span>
              <span className="animate-bounce-subtle" style={{animationDelay: '0.4s'}}>🫖</span>
              <span className="animate-bounce-subtle" style={{animationDelay: '0.6s'}}>🍃</span>
            </div>
          </div>
        </footer>
      </div>
      
      {/* Subtle Pattern Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23f5862d' fill-opacity='1'%3E%3Cpath d='M30 30m-12 0a12 12 0 1 1 24 0a12 12 0 1 1 -24 0'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} className="w-full h-full"></div>
      </div>

      {/* Enhanced Modal System */}
      {config && (
        <Modal
          isOpen={isOpen}
          onClose={closeModal}
          title={config.title}
          message={config.message}
          type={config.type}
          showCancel={config.showCancel}
          onConfirm={onConfirm || (() => {})}
          confirmText={config.confirmText}
          cancelText={config.cancelText}
        />
      )}

      <AddUserModal
        isOpen={isModalOpen}
        onClose={closeAddUserModal}
        onUserAdded={handleUserAdded}
      />

      <PinModal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        onConfirm={onPinConfirm || (() => {})}
        title="Abandon Session?"
        message="Enter the PIN to confirm abandoning this session. This action cannot be undone."
        correctPin="1428"
      />
    </div>
  );
}

export default App;
