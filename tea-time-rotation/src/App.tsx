import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OrderForm from './components/OrderForm';
import Summary from './components/Summary';
import AddUserModal from './components/AddUserModal';
import Analytics from './components/Analytics';
import BottomNavigation from './components/BottomNavigation';

interface Session {
  id: string;
  status: 'active' | 'completed';
  ended_at?: string;
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
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentTab, setCurrentTab] = useState<'home' | 'analytics'>('home');
  
  // Hidden feature: teapot click counter and modal state
  const [teapotClickCount, setTeapotClickCount] = useState(0);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Reset teapot click count after a delay if user stops clicking
  useEffect(() => {
    if (teapotClickCount > 0 && teapotClickCount < 5) {
      const timer = setTimeout(() => setTeapotClickCount(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [teapotClickCount]);

  useEffect(() => {
    const fetchAllData = async (currentSession: Session) => {
      const [ordersData, usersData] = await Promise.all([
        supabase.from('orders').select('user_id, drink_type, sugar_level').eq('session_id', currentSession.id),
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

  // Separate useEffect for orders listener that depends on session
  useEffect(() => {
    if (!session) return;

    const fetchAllData = async (currentSession: Session) => {
      const [ordersData, usersData] = await Promise.all([
        supabase.from('orders').select('user_id, drink_type, sugar_level').eq('session_id', currentSession.id),
        supabase.from('users').select('id, name, last_ordered_drink, last_sugar_level'),
      ]);
      if (ordersData.data) setOrders(ordersData.data);
      if (usersData.data) setUsers(usersData.data);
    };

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

    return () => {
      supabase.removeChannel(ordersListener);
    };
  }, [session]);

  const handleStartSession = async () => {
    // Clear orders state before starting new session
    setOrders([]);
    const { data } = await supabase.from('sessions').insert([{ status: 'active' }]).select().single();
    setSession(data);
  };

  const handleSummarizeSession = async () => {
    if (!session) return;

    if (!window.confirm('Are you sure? This will finalize the session for everyone.')) {
      return;
    }

    const { error } = await supabase.functions.invoke('summarize', {
      body: { session_id: session.id },
    });

    if (error) {
      alert(`Error summarizing session: ${error.message}`);
    } else {
      // Update local session state to trigger UI change immediately
      setSession({
        ...session,
        status: 'completed',
        ended_at: new Date().toISOString()
      });
    }
  };

  const handleOrderUpdate = async () => {
    if (!session) return;
    
    const [ordersData, usersData] = await Promise.all([
      supabase.from('orders').select('user_id, drink_type, sugar_level').eq('session_id', session.id),
      supabase.from('users').select('id, name, last_ordered_drink, last_sugar_level'),
    ]);
    if (ordersData.data) setOrders(ordersData.data);
    if (usersData.data) setUsers(usersData.data);
  };

  const handleTeapotClick = () => {
    setTeapotClickCount(prev => {
      const newCount = prev + 1;
      if (newCount === 5) {
        setIsAddUserModalOpen(true);
        return 0; // Reset counter
      }
      return newCount;
    });
  };

  const handleUserAdded = async () => {
    // Refresh users list when a new user is added
    const { data: usersData } = await supabase.from('users').select('id, name, last_ordered_drink, last_sugar_level');
    if (usersData) setUsers(usersData);
  };

    return (
    <div className="min-h-screen bg-black text-white">
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-black to-purple-900/20 pointer-events-none" />
      
      {/* Main Container */}
      <div className="relative z-10 min-h-screen pb-20">
        {currentTab === 'home' ? (
          <>
            {/* Header */}
            <header className="px-6 py-8">
              <div className="max-w-4xl mx-auto text-center">
                {/* Tea Icon */}
                <div className="mb-6">
                  <span 
                    className="text-7xl cursor-pointer select-none animate-pulse-glow hover:scale-110 transition-transform duration-300 inline-block"
                    onClick={handleTeapotClick}
                    role="img" 
                    aria-label="tea emoji"
                  >
                    🫖
                  </span>
                </div>
                
                {/* Title */}
                <h1 className="display-large mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Tea Time
                </h1>
                
                {/* Subtitle */}
                <p className="body-medium text-gray-400 max-w-lg mx-auto">
                  Modern team tea management system
                </p>
              </div>
            </header>

            {/* Main Content */}
            <main className="px-6 pb-8">
              <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Start Session Card */}
                {!session && (
                  <div className="material-card p-8 animate-fade-in">
                    <div className="text-center">
                      <div className="badge-inactive mb-6">
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                        No Active Session
                      </div>
                      <h2 className="headline-medium mb-3">Ready to Start?</h2>
                      <p className="body-medium text-gray-400 mb-8">
                        Begin a new tea time session for your team
                      </p>
                     
                     <button
                       onClick={handleStartSession}
                       className="btn-primary text-lg px-8 py-4"
                     >
                       <span className="mr-3 text-xl">🚀</span>
                       Start Tea Time
                     </button>
                   </div>
                  </div>
                )}

                {/* Dynamic Content */}
                {session && (
                  <div className="space-y-8">
                    {session.status === 'active' ? (
                      <>
                        {/* Order Form */}
                        <div className="material-card p-8 animate-slide-up">
                          <OrderForm 
                            key={session.id} 
                            session={session} 
                            orders={orders} 
                            users={users} 
                            onOrderUpdate={handleOrderUpdate} 
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-center animate-slide-up">
                          <button
                            onClick={handleSummarizeSession}
                            className="btn-destructive text-lg px-8 py-4"
                          >
                            <span className="mr-3 text-xl">📋</span>
                            Summarize Tea Time
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="material-card p-8 animate-slide-up">
                        <Summary session={session} onNewSession={handleStartSession} onClose={() => setSession(null)} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>

            {/* Footer */}
            <footer className="px-6 py-8">
              <div className="max-w-4xl mx-auto text-center">
                <p className="body-medium text-gray-500">
                  Built with <span className="text-red-400 animate-pulse">❤️</span> for tea enthusiasts
                </p>
              </div>
            </footer>
          </>
        ) : (
          /* Analytics Screen */
          <main className="px-6 py-8">
            <div className="max-w-4xl mx-auto">
              <Analytics />
            </div>
          </main>
        )}
      </div>
      
      {/* Bottom Navigation */}
      <BottomNavigation currentTab={currentTab} onTabChange={setCurrentTab} />
      
      {/* Add User Modal */}
      <AddUserModal 
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onUserAdded={handleUserAdded}
      />
    </div>
  );
}

export default App;
