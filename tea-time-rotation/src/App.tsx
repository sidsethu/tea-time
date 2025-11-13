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
import ChaiLytics from './components/ChaiLytics';
import type { LeaderboardEntry } from './components/Leaderboard';

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
  id:string;
  name: string;
  last_ordered_drink: string;
  last_sugar_level: string;
  profile_picture_url?: string;
  roles: string[];
  total_drinks_bought: number;
  drink_count: number;
  last_assigned_at: string | null;
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
  const [topBuyers, setTopBuyers] = useState<LeaderboardEntry[]>([]);
  const [topDrinkers, setTopDrinkers] = useState<LeaderboardEntry[]>([]);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [currentUserStats, setCurrentUserStats] = useState<{
    userData: LeaderboardEntry;
    sponsorRank: number;
    drinkerRank: number;
  } | null>(null);

  const fetchTopDrinkers = async () => {
    const { data } = await supabase
      .from('users')
      .select('name, drink_count, total_drinks_bought')
      .order('drink_count', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true })
      .limit(3);
    if (data) {
      setTopDrinkers(data as LeaderboardEntry[]);
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('users')
      .select('name, total_drinks_bought, drink_count')
      .order('total_drinks_bought', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true })
      .limit(3);
    if (data) {
      setTopBuyers(data as LeaderboardEntry[]);
    }
  };

  const fetchCurrentUserStats = async () => {
    if (!profile?.name) {
      setCurrentUserStats(null);
      return;
    }

    try {
      // Get current user's data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, total_drinks_bought, drink_count')
        .eq('name', profile.name)
        .single();

      if (userError || !userData) {
        setCurrentUserStats(null);
        return;
      }

      // Get sponsor rank (count users with more drinks bought)
      const { count: sponsorsAbove } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('total_drinks_bought', userData.total_drinks_bought || 0);

      // Get drinker rank (count users with more drinks consumed)
      const { count: drinkersAbove } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('drink_count', userData.drink_count || 0);

      setCurrentUserStats({
        userData: userData as LeaderboardEntry,
        sponsorRank: (sponsorsAbove || 0) + 1,
        drinkerRank: (drinkersAbove || 0) + 1,
      });
    } catch (error) {
      console.error('Error fetching current user stats:', error);
      setCurrentUserStats(null);
    }
  };

  useEffect(() => {
    const fetchAllData = async (currentSession: Session) => {
      const [ordersData, usersData] = await Promise.all([
        supabase.from('orders').select('*').eq('session_id', currentSession.id),
        supabase.from('users').select('id, name, last_ordered_drink, last_sugar_level, profile_picture_url, total_drinks_bought, drink_count, last_assigned_at, roles:user_roles(roles(name))'),
      ]);
      if (ordersData.data) setOrders(ordersData.data);
      if (usersData.data) {
          const transformedUsers = usersData.data.map(user => {
              const roles = (user.roles as unknown as { roles: { name: string } }[]).map(
                  (r) => r.roles.name
              );
              return { ...user, roles };
          });
          setUsers(transformedUsers as User[]);
      }
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

  // Fetch and live-update leaderboard (independent of session)
  useEffect(() => {
    fetchLeaderboard();
    fetchTopDrinkers();
    fetchCurrentUserStats();
    const usersListener = supabase
      .channel('users-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => {
          fetchLeaderboard();
          fetchTopDrinkers();
          fetchCurrentUserStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersListener);
    };
  }, [profile?.name]); // Re-fetch when user changes

  // Function to fetch all data for a session
  const fetchAllData = async (currentSession: Session) => {
    const [ordersData, usersData] = await Promise.all([
      supabase.from('orders').select('*').eq('session_id', currentSession.id),
      supabase.from('users').select('id, name, last_ordered_drink, last_sugar_level, profile_picture_url, roles:user_roles(roles(name))'),
    ]);
    if (ordersData.data) setOrders(ordersData.data);
    if (usersData.data) {
        const transformedUsers = usersData.data.map(user => {
            const roles = (user.roles as unknown as { roles: { name: string } }[]).map(
                (r) => r.roles.name
            );
            return { ...user, roles };
        });
        setUsers(transformedUsers as User[]);
    }
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

  // Helper function to calculate ratio
  const calculateRatio = (user: User) => {
    if (user.total_drinks_bought > 0) {
      return (user.drink_count / user.total_drinks_bought).toFixed(2);
    }
    return user.drink_count > 0 ? '∞' : '0.00';
  };

  // Helper function to format last assigned date
  const formatLastAssigned = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

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
          // Phase 1: Get candidate list
          const { data, error } = await supabase.functions.invoke('summarize', {
            body: { session_id: session.id },
          });

          if (error) {
            console.error('Summarize function error:', error);
            showError('Session Error', `Could not finalize the session: ${error.message}`);
            return;
          }

          // Check if we need admin confirmation
          if (data?.requiresConfirmation && data?.candidates) {
            setCandidates(data.candidates);
            setSelectedAssignee(data.candidates[0]?.id || ''); // Default to first candidate
            setShowAssigneeModal(true);
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

  const handleConfirmAssignment = async () => {
    if (!session || !selectedAssignee) {
      showError('Selection Required', 'Please select an assignee.');
      return;
    }

    try {
      // Phase 2: Commit with selected assignee
      const { data, error } = await supabase.functions.invoke('summarize', {
        body: { session_id: session.id, confirm_assignee: selectedAssignee },
      });

      if (error) {
        console.error('Summarize function error:', error);
        showError('Session Error', `Could not finalize the session: ${error.message}`);
        return;
      }

      if (data?.committed) {
        setShowAssigneeModal(false);

        // Force refresh the session data to get updated status
        const { data: updatedSession } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', session.id)
          .single();

        if (updatedSession) {
          setSession(updatedSession);
        }
      }
    } catch (err) {
      console.error('Unexpected error during confirm:', err);
      showError('Unexpected Error', 'Something went wrong. Please try again.');
    }
  };

  const handleCancelAssigneeSelection = () => {
    setShowAssigneeModal(false);
    setCandidates([]);
    setSelectedAssignee('');
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
          <button
            type="button"
            className="relative inline-block"
            onClick={handleKettleClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleKettleClick(); } }}
            aria-label="Open admin actions"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-primary-500 to-chai-500 rounded-full blur-lg opacity-20 animate-pulse-slow"></div>
            <div className="relative text-6xl sm:text-7xl lg:text-8xl animate-bounce-subtle">🫖</div>
          </button>
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-gray-800 leading-tight mt-3 sm:mt-4 mb-2 drop-shadow-sm">
            Tea Time
          </h1>
          <p className="text-gray-700 text-sm sm:text-base lg:text-lg font-semibold">Your high quali-tea butler! </p>
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
                  
                  <ChaiLytics
                    topSponsors={topBuyers}
                    topDrinkers={topDrinkers}
                    totalSessions={totalSessions}
                    lastAssignee={lastAssignee}
                    currentUserName={profile?.name}
                    currentUserStats={currentUserStats || undefined}
                  />
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

      {/* Assignee Selection Modal */}
      {showAssigneeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in border-2 border-primary-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary-500 to-chai-500 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold flex items-center">
                <span className="mr-3 text-3xl">🎯</span>
                Confirm Tea Maker Assignment
              </h2>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 bg-white">
              <p className="text-gray-800 text-base font-semibold mb-4">
                Select who should get tea this time:
              </p>

              <div className="space-y-3">
                {candidates.map((candidate, index) => (
                  <label
                    key={candidate.id}
                    className={`block cursor-pointer transition-all duration-200 ${
                      selectedAssignee === candidate.id
                        ? 'bg-primary-200 border-primary-600 shadow-md'
                        : 'bg-white border-gray-400 hover:border-primary-500 hover:bg-primary-100'
                    } border-2 rounded-xl p-4`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="assignee"
                        value={candidate.id}
                        checked={selectedAssignee === candidate.id}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                        className="w-5 h-5 text-primary-500 focus:ring-primary-500 accent-primary-500"
                      />
                      <div className="ml-4 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-lg text-gray-900">
                            {candidate.name}
                          </span>
                          {index === 0 && (
                            <span style={{backgroundColor: '#f5862d'}} className="text-white text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                              <span>⭐</span>
                              <span>Recommended</span>
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-900 mt-2 flex items-center flex-wrap gap-2">
                          <span className="font-medium">Ratio: {calculateRatio(candidate)}</span>
                          <span className="text-gray-500">•</span>
                          <span className="font-medium">Last: {formatLastAssigned(candidate.last_assigned_at)}</span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 flex flex-col sm:flex-row gap-3 bg-white rounded-b-2xl">
              <button
                onClick={handleConfirmAssignment}
                style={{backgroundColor: '#f5862d'}}
                className="flex-1 hover:bg-primary-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg"
              >
                ✓ Confirm Assignment
              </button>
              <button
                onClick={handleCancelAssigneeSelection}
                style={{backgroundColor: '#9ca3af'}}
                className="flex-1 hover:bg-gray-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
