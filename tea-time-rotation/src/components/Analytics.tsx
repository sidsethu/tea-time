import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface User {
  id: string;
  name: string;
  drink_count: number;
}

interface OrderHistory {
  drink_type: string;
  sugar_level: string;
  created_at: string;
}

interface DrinkStats {
  drink: string;
  count: number;
  percentage: number;
}

interface UserStreak {
  current_streak: number;
  longest_streak: number;
  last_order_date: string;
}

interface LeaderboardUser extends User {
  rank: number;
  current_streak: number;
  longest_streak: number;
  recent_orders: number;
}

const Analytics = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [drinkStats, setDrinkStats] = useState<DrinkStats[]>([]);
  const [userStreak, setUserStreak] = useState<UserStreak | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [rankingMode, setRankingMode] = useState<'total' | 'streak' | 'recent'>('total');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      calculateLeaderboard();
    }
  }, [users, timeRange, rankingMode]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserAnalytics();
      calculateStreak();
    }
  }, [selectedUser, timeRange]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, drink_count')
      .order('drink_count', { ascending: false });
    
    if (data) {
      setUsers(data);
      if (data.length > 0 && !selectedUser) {
        setSelectedUser(data[0].id);
      }
    }
  };

  const fetchUserAnalytics = async () => {
    if (!selectedUser) return;
    
    setIsLoadingAnalytics(true);
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('drink_type, sugar_level, created_at')
        .eq('user_id', selectedUser)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user analytics:', error);
        setOrderHistory([]);
        setDrinkStats([]);
        return;
      }

      const ordersData = data || [];
      
      // Calculate drink statistics
      const drinkCounts = ordersData.reduce((acc, order) => {
        acc[order.drink_type] = (acc[order.drink_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const total = ordersData.length;
      const stats = Object.entries(drinkCounts).map(([drink, count]) => ({
        drink,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }));

      // Update both states together to ensure consistency
      setOrderHistory(ordersData);
      setDrinkStats(stats.sort((a, b) => b.count - a.count));
      
      // Debug logging
      console.log(`Fetched ${ordersData.length} orders for user ${selectedUser} in ${timeRange}`);
      
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      setOrderHistory([]);
      setDrinkStats([]);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const calculateStreak = async () => {
    const { data } = await supabase
      .from('orders')
      .select('created_at')
      .eq('user_id', selectedUser)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) {
      setUserStreak({ current_streak: 0, longest_streak: 0, last_order_date: '' });
      return;
    }

    // Group orders by date
    const orderDates = data.map(order => 
      new Date(order.created_at).toDateString()
    );
    
    const uniqueDates = [...new Set(orderDates)].sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

    // Calculate current streak
    for (let i = 0; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i]);
      const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      
      if (currentDate.toDateString() === expectedDate.toDateString()) {
        currentStreak++;
      } else {
        break;
      }
    }

    // If last order wasn't today or yesterday, reset current streak
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      currentStreak = 0;
    }

    // Calculate longest streak
    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const currentDate = new Date(uniqueDates[i]);
        const prevDate = new Date(uniqueDates[i - 1]);
        const dayDiff = Math.abs(prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (dayDiff <= 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    setUserStreak({
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_order_date: uniqueDates[0] || ''
    });
  };

  const calculateLeaderboard = async () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const leaderboardData: LeaderboardUser[] = await Promise.all(
      users.map(async (user) => {
        // Get user's recent orders
        const { data: recentOrders } = await supabase
          .from('orders')
          .select('created_at')
          .eq('user_id', user.id)
          .gte('created_at', startDate);

        // Get all orders for streak calculation
        const { data: allOrders } = await supabase
          .from('orders')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // Calculate streaks
        let currentStreak = 0;
        let longestStreak = 0;

        if (allOrders && allOrders.length > 0) {
          const orderDates = allOrders.map(order => 
            new Date(order.created_at).toDateString()
          );
          
          const uniqueDates = [...new Set(orderDates)].sort((a, b) => 
            new Date(b).getTime() - new Date(a).getTime()
          );

          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

          // Calculate current streak
          for (let i = 0; i < uniqueDates.length; i++) {
            const currentDate = new Date(uniqueDates[i]);
            const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            
            if (currentDate.toDateString() === expectedDate.toDateString()) {
              currentStreak++;
            } else {
              break;
            }
          }

          // If last order wasn't today or yesterday, reset current streak
          if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
            currentStreak = 0;
          }

          // Calculate longest streak
          let tempStreak = 0;
          for (let i = 0; i < uniqueDates.length; i++) {
            if (i === 0) {
              tempStreak = 1;
            } else {
              const currentDate = new Date(uniqueDates[i]);
              const prevDate = new Date(uniqueDates[i - 1]);
              const dayDiff = Math.abs(prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);
              
              if (dayDiff <= 1) {
                tempStreak++;
              } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
              }
            }
          }
          longestStreak = Math.max(longestStreak, tempStreak);
        }

        return {
          ...user,
          rank: 0, // Will be set after sorting
          current_streak: currentStreak,
          longest_streak: longestStreak,
          recent_orders: recentOrders?.length || 0
        };
      })
    );

    // Sort by selected ranking mode
    let sortedData = [...leaderboardData];
    switch (rankingMode) {
      case 'total':
        // Rank by lifetime total orders
        sortedData.sort((a, b) => b.drink_count - a.drink_count);
        break;
      case 'streak':
        sortedData.sort((a, b) => {
          if (b.current_streak !== a.current_streak) {
            return b.current_streak - a.current_streak;
          }
          return b.longest_streak - a.longest_streak;
        });
        break;
      case 'recent':
        sortedData.sort((a, b) => b.recent_orders - a.recent_orders);
        break;
    }

    // Assign ranks
    sortedData.forEach((user, index) => {
      user.rank = index + 1;
    });

    setLeaderboard(sortedData);
    
    // Auto-select first user if none selected
    if (!selectedUser && sortedData.length > 0) {
      setSelectedUser(sortedData[0].id);
    }
  };

  const selectedUserName = users.find(u => u.id === selectedUser)?.name || '';

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="text-center">
        <h1 className="display-large mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          📊 Analytics
        </h1>
        <p className="body-medium text-gray-400">
          Track your tea habits and streaks
        </p>
      </div>

      {/* Ranking Mode Selector */}
      <div className="material-card p-4">
        <div className="flex justify-center space-x-2">
          {[
            { key: 'total', label: '🏆 All-time Leaders', desc: 'Total lifetime orders' },
            { key: 'streak', label: '🔥 Streak Masters', desc: 'Consistency champions' },
            { key: 'recent', label: '⚡ Most Active', desc: `Active in ${timeRange}` }
          ].map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => setRankingMode(key as any)}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex flex-col items-center ${
                rankingMode === key
                  ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 border-2 border-yellow-400/70 text-yellow-100'
                  : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-600'
              }`}
                          >
                <span className="font-bold">{label}</span>
                <span className="text-xs opacity-90 mt-1">{desc}</span>
              </button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="material-card p-6">
        <h3 className="headline-medium mb-6 text-center">🏆 Leaderboard</h3>
        <div className="space-y-3">
          {leaderboard.map((user, index) => {
            const isSelected = selectedUser === user.id;
            let rankIcon = '';
            let rankColor = '';
            
            if (user.rank === 1) {
              rankIcon = '🥇';
              rankColor = 'from-yellow-500/30 to-amber-500/30 border-yellow-500/50';
            } else if (user.rank === 2) {
              rankIcon = '🥈';
              rankColor = 'from-gray-400/30 to-gray-500/30 border-gray-400/50';
            } else if (user.rank === 3) {
              rankIcon = '🥉';
              rankColor = 'from-orange-500/30 to-amber-600/30 border-orange-500/50';
            } else {
              rankIcon = `#${user.rank}`;
              rankColor = 'from-gray-700/50 to-gray-600/50 border-gray-500/50';
            }

            const getMainStat = () => {
              switch (rankingMode) {
                case 'total': return `${user.drink_count} all-time`;
                case 'streak': return `${user.current_streak} days`;
                case 'recent': return `${user.recent_orders} in ${timeRange}`;
                default: return `${user.drink_count} all-time`;
              }
            };

            const getSecondaryStat = () => {
              switch (rankingMode) {
                case 'total': return `⚡ ${user.recent_orders} in ${timeRange}`;
                case 'streak': return `🏆 ${user.drink_count} all-time`;
                case 'recent': return `🔥 ${user.current_streak} streak`;
                default: return '';
              }
            };

            return (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user.id)}
                className={`w-full p-4 rounded-xl transition-all duration-200 border-2 bg-gradient-to-r ${rankColor} ${
                  isSelected 
                    ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-black scale-105 shadow-lg shadow-blue-500/20' 
                    : 'hover:scale-102 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold min-w-[3rem] text-center">
                      {rankIcon}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg text-white">{user.name}</div>
                      <div className="text-sm text-gray-200">{getSecondaryStat()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-blue-300">{getMainStat()}</div>
                    <div className="text-xs text-gray-200">
                      {rankingMode === 'streak' && `Max streak: ${user.longest_streak} days`}
                      {rankingMode === 'total' && `Current streak: ${user.current_streak} days`}
                      {rankingMode === 'recent' && `All-time: ${user.drink_count} orders`}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedUser && (
        <>
          {/* Individual Analysis Header */}
          <div className="material-card p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30">
            <div className="text-center">
              <h3 className="headline-medium mb-2">📊 {selectedUserName}'s Analysis</h3>
              <div className="flex justify-center items-center gap-4 text-sm">
                <span className="bg-blue-500/20 px-3 py-1 rounded-full">
                  Rank #{leaderboard.find(u => u.id === selectedUser)?.rank || '?'}
                </span>
                <span className="text-gray-400">•</span>
                <span>Detailed insights for {timeRange}</span>
              </div>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="material-card p-4">
            <div className="flex justify-center space-x-2">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    timeRange === range
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Streak Card */}
          {userStreak && (
            <div className="material-card p-6">
              <h3 className="headline-medium mb-4 text-center">🔥 {selectedUserName}'s Streaks</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-xl border border-orange-500/30">
                  <div className="text-3xl font-bold text-orange-400">{userStreak.current_streak}</div>
                  <div className="text-sm text-orange-300">Current Streak</div>
                  <div className="text-xs text-orange-200/70 mt-1">
                    {userStreak.current_streak > 0 ? 'days in a row!' : 'Start your streak today!'}
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
                  <div className="text-3xl font-bold text-yellow-400">{userStreak.longest_streak}</div>
                  <div className="text-sm text-yellow-300">Longest Streak</div>
                  <div className="text-xs text-yellow-200/70 mt-1">
                    {userStreak.longest_streak > 0 ? 'Personal best!' : 'Place your first order!'}
                  </div>
                </div>
              </div>
              {userStreak.last_order_date && (
                <div className="text-center mt-4 text-sm text-gray-400">
                  Last order: {new Date(userStreak.last_order_date).toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          {/* Drink Preferences */}
          <div className="material-card p-6">
            <h3 className="headline-medium mb-4 text-center">☕ Drink Preferences</h3>
            {isLoadingAnalytics ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl animate-pulse">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⏳</span>
                      <div className="bg-gray-600 rounded w-16 h-4"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-600 rounded-full w-1/2"></div>
                      </div>
                      <div className="bg-gray-600 rounded w-12 h-4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : drinkStats.length > 0 ? (
              <div className="space-y-3">
                {drinkStats.map((stat, index) => (
                  <div key={stat.drink} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊'}
                      </span>
                      <span className="font-medium">{stat.drink}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-300 min-w-[3rem]">
                        {stat.count} ({stat.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📈</div>
                <p>No orders in the selected time period</p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="material-card p-6">
            <h3 className="headline-medium mb-4 text-center">📅 Recent Activity</h3>
            {isLoadingAnalytics ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">⏳</span>
                      <div>
                        <div className="font-medium text-sm bg-gray-600 rounded w-16 h-4"></div>
                        <div className="text-xs bg-gray-600 rounded w-12 h-3 mt-1"></div>
                      </div>
                    </div>
                    <div className="text-xs bg-gray-600 rounded w-16 h-3"></div>
                  </div>
                ))}
              </div>
            ) : orderHistory.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {orderHistory.slice(0, 10).map((order, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {order.drink_type === 'Tea' ? '🍵' : 
                         order.drink_type === 'Coffee' ? '☕' : 
                         order.drink_type.includes('Milk') ? '🥛' : '🧃'}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{order.drink_type}</div>
                        <div className="text-xs text-gray-400">
                          {order.sugar_level === 'No Sugar' ? '🚫' : 
                           order.sugar_level === 'Less' ? '🤏' : '🍯'} {order.sugar_level}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📋</div>
                <p>No recent activity</p>
              </div>
            )}
          </div>

          {/* Overall Stats */}
          <div className="material-card p-6">
            <h3 className="headline-medium mb-4 text-center">📈 Overall Stats</h3>
            {isLoadingAnalytics ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
                  <div className="text-2xl font-bold text-blue-400 animate-pulse">...</div>
                  <div className="text-sm text-blue-300">Orders in {timeRange}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                  <div className="text-2xl font-bold text-green-400 animate-pulse">...</div>
                  <div className="text-sm text-green-300">Total Orders</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
                  <div className="text-2xl font-bold text-blue-400">{orderHistory.length}</div>
                  <div className="text-sm text-blue-300">Orders in {timeRange}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                  <div className="text-2xl font-bold text-green-400">
                    {users.find(u => u.id === selectedUser)?.drink_count || 0}
                  </div>
                  <div className="text-sm text-green-300">Total Orders</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics; 