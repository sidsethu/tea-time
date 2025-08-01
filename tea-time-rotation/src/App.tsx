import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import OrderForm from './components/OrderForm';
import Summary from './components/Summary';

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

  useEffect(() => {
    const fetchAllData = async (currentSession: Session) => {
      const [ordersData, usersData] = await Promise.all([
        supabase.from('orders').select('user_id').eq('session_id', currentSession.id),
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
        supabase.from('orders').select('user_id').eq('session_id', currentSession.id),
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
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige to-amber-50 flex flex-col items-center justify-center font-sans p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg p-6 sm:p-8 lg:p-10 space-y-8 bg-white rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-800 leading-tight">
            <span role="img" aria-label="tea emoji" className="mr-3">🫖</span>
            Tea Time
          </h1>
          <p className="text-gray-600 text-lg sm:text-xl">Your very own quali-tea assistant!</p>
        </div>
        
        <div className="space-y-6">
          {session ? (
            session.status === 'active' ? (
              <OrderForm session={session} orders={orders} users={users} />
            ) : (
              <Summary session={session} onNewSession={handleStartSession} />
            )
          ) : (
            <div className="text-center space-y-6">
              <button
                onClick={handleStartSession}
                className="px-8 py-4 text-xl font-bold text-gray-800 bg-brand-yellow rounded-2xl hover:bg-yellow-300 hover:scale-105 transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-brand-yellow/50 shadow-lg hover:shadow-xl"
              >
                <span role="img" aria-label="start emoji" className="mr-3">🚀</span>
                Start Tea Time
              </button>
            </div>
          )}
          
          {session && session.status === 'active' && (
            <div className="pt-6 flex justify-center">
              <button
                onClick={handleSummarizeSession}
                className="px-8 py-4 text-xl font-bold text-white bg-secondary rounded-2xl hover:bg-orange-500 hover:scale-105 transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-secondary/50 shadow-lg hover:shadow-xl"
              >
                <span role="img" aria-label="summary emoji" className="mr-3">📋</span>
                Summarize Tea Time
              </button>
            </div>
          )}
        </div>
      </div>
      
      <footer className="text-center text-gray-500 mt-8 px-4">
        <p className="text-lg">
          Built with <span role="img" aria-label="heart emoji" className="text-yellow-500">💛</span> for the tea lovers.
        </p>
      </footer>
    </div>
  );
}

export default App;
