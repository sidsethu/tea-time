import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OrderForm from './components/OrderForm';
import Summary from './components/Summary';
import Modal from './components/ui/Modal';
import { useModal } from './hooks/useModal';

interface Session {
  id: string;
  status: 'active' | 'completed';
}

interface Order {
  user_id: string;
}

interface User {
  id: string;
  name: string;
  last_ordered_drink: string;
  last_sugar_level: string;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const { isOpen, config, onConfirm, closeModal, showError, showConfirm } = useModal();

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
          .select('*')
          .eq('status', 'completed')
          .gte('ended_at', fiveMinutesAgo)
          .order('ended_at', { ascending: false })
          .limit(1)
          .single();
        setSession(completedData);
        if (completedData) fetchAllData(completedData);
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

  const handleSummarizeSession = async () => {
    if (!session) return;

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

  return (
    <div className="min-h-screen relative overflow-hidden">
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
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8">
        {/* Enhanced Mobile-First Logo/Header Section */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in px-4">
          <div className="relative inline-block">
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
                  
                  {/* Features Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
                    <div className="bg-white/80 border border-gray-200 rounded-xl p-3 sm:p-4">
                      <div className="text-2xl mb-2">👥</div>
                      <div className="text-sm font-semibold text-gray-800">Team Orders</div>
                    </div>
                    <div className="bg-white/80 border border-gray-200 rounded-xl p-3 sm:p-4">
                      <div className="text-2xl mb-2">🎯</div>
                      <div className="text-sm font-semibold text-gray-800">Fair Assignment</div>
                    </div>
                    <div className="bg-white/80 border border-gray-200 rounded-xl p-3 sm:p-4">
                      <div className="text-2xl mb-2">⚡</div>
                      <div className="text-sm font-semibold text-gray-800">Real-time Updates</div>
                    </div>
                  </div>
                </div>
                
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
              </div>
            )}
            
            {session && session.status === 'active' && (
              <div className="pt-8 flex justify-center animate-slide-up" style={{animationDelay: '0.2s'}}>
                <button
                  onClick={handleSummarizeSession}
                  className="btn-secondary text-lg sm:text-xl font-bold px-6 sm:px-8 py-3 sm:py-4 group relative overflow-hidden rounded-xl sm:rounded-2xl w-full max-w-xs sm:max-w-sm"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    <span className="mr-3 text-xl sm:text-2xl group-hover:animate-pulse">📋</span>
                    <span className="text-base sm:text-lg">Summarize Tea Time</span>
                  </span>
                </button>
              </div>
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
    </div>
  );
}

export default App;
