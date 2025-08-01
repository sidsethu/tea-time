import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { saveLastSelectedUser, getLastSelectedUser } from '../utils/cookies';

interface User {
  id: string;
  name: string;
  last_ordered_drink: string;
  last_sugar_level: string;
}

interface Order {
  user_id: string;
  drink_type: string;
  sugar_level: string;
}

interface OrderFormProps {
  session: {
    id: string;
  };
  orders: Order[];
  users: User[];
  onOrderUpdate?: () => void;
}

interface HistoricalOrder {
  drink_type: string;
  sugar_level: string;
  created_at: string;
}

interface Suggestion {
  drink: string;
  sugar: string;
  confidence: number;
  reason: string;
}

const drinkOptions = [
  { name: 'Tea', emoji: '🍵', category: 'Hot Beverages' },
  { name: 'Coffee', emoji: '☕', category: 'Hot Beverages' },
  { name: 'Black Coffee', emoji: '☕', category: 'Hot Beverages' },
  { name: 'Black Tea', emoji: '🍵', category: 'Hot Beverages' },
  { name: 'Lemon Tea', emoji: '🍋', category: 'Hot Beverages' },
  { name: 'Badam Milk', emoji: '🥛', category: 'Milk Beverages' },
  { name: 'Plain Milk', emoji: '🥛', category: 'Milk Beverages' },
  { name: 'Fruit Juice', emoji: '🧃', category: 'Cold Beverages' },
];

const sugarLevels = [
  { name: 'No Sugar', emoji: '🚫', color: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-300' },
  { name: 'Less', emoji: '🤏', color: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300' },
  { name: 'Normal', emoji: '🍯', color: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-300' },
];

const OrderForm = ({ session, orders, users, onOrderUpdate }: OrderFormProps) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<{drink: string, sugar: string} | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  // Auto-select last user from cookies when component mounts
  useEffect(() => {
    const lastUserId = getLastSelectedUser();
    if (lastUserId && users.some(user => user.id === lastUserId)) {
      setSelectedUser(lastUserId);
    }
  }, [users]);

  // Generate personalized suggestion for user based on historical data and time
  const generateSuggestion = async (userId: string): Promise<Suggestion | null> => {
    try {
      // Fetch user's historical orders from the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('orders')
        .select('drink_type, sugar_level, created_at')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });
      
      const historicalOrders = data as HistoricalOrder[] | null;

      if (!historicalOrders || historicalOrders.length === 0) {
        // No historical data, return most common order overall
        return {
          drink: 'Tea',
          sugar: 'Normal',
          confidence: 0.3,
          reason: 'Popular choice'
        };
      }

      // Get current time in minutes since midnight
      const now = new Date();
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

      // Group orders by date and find closest order for each day
      const ordersByDate = new Map<string, any[]>();
      
      historicalOrders.forEach(order => {
        const orderDate = new Date(order.created_at).toDateString();
        if (!ordersByDate.has(orderDate)) {
          ordersByDate.set(orderDate, []);
        }
        ordersByDate.get(orderDate)!.push(order);
      });

      // Find closest order for each day
      const closestOrdersPerDay: (HistoricalOrder & { timeDiff: number })[] = [];
      
      ordersByDate.forEach((dayOrders) => {
        let closestForDay: any = null;
        let smallestTimeDiff = Infinity;
        
        dayOrders.forEach(order => {
          const orderTime = new Date(order.created_at);
          const orderTimeMinutes = orderTime.getHours() * 60 + orderTime.getMinutes();
          
          // Calculate time difference (considering it's a 24-hour cycle)
          let timeDiff = Math.abs(currentTimeMinutes - orderTimeMinutes);
          
          // Handle day boundary (e.g., current time 1:00 AM vs order time 23:00)
          timeDiff = Math.min(timeDiff, 1440 - timeDiff); // 1440 = 24 * 60 minutes
          
          if (timeDiff < smallestTimeDiff) {
            smallestTimeDiff = timeDiff;
            closestForDay = order;
          }
        });
        
        if (closestForDay) {
          closestOrdersPerDay.push({
            drink_type: closestForDay.drink_type,
            sugar_level: closestForDay.sugar_level,
            created_at: closestForDay.created_at,
            timeDiff: smallestTimeDiff
          });
        }
      });

      // If we have daily closest orders, find the most frequent combination
      if (closestOrdersPerDay.length > 0) {
        const frequencyMap = new Map<string, { count: number; drink: string; sugar: string; avgTimeDiff: number }>();
        
        closestOrdersPerDay.forEach(order => {
          const key = `${order.drink_type}_${order.sugar_level}`;
          const existing = frequencyMap.get(key);
          if (existing) {
            existing.count++;
            existing.avgTimeDiff = (existing.avgTimeDiff + order.timeDiff) / 2;
          } else {
            frequencyMap.set(key, {
              count: 1,
              drink: order.drink_type,
              sugar: order.sugar_level,
              avgTimeDiff: order.timeDiff
            });
          }
        });

        // Find most frequent combination from daily closest orders
        let maxCount = 0;
        let bestOption = null;
        
        for (const option of frequencyMap.values()) {
          if (option.count > maxCount) {
            maxCount = option.count;
            bestOption = option;
          }
        }

        if (bestOption) {
          const confidence = 0.7 + (maxCount / closestOrdersPerDay.length) * 0.25;
          const avgTimeMinutes = Math.round(bestOption.avgTimeDiff);
          const timeDescription = avgTimeMinutes <= 60 ? 
            `around this time` : 
            `usually ${Math.round(avgTimeMinutes / 60)}h from now`;

          return {
            drink: bestOption.drink,
            sugar: bestOption.sugar,
            confidence,
            reason: `Your daily pattern ${timeDescription}`
          };
        }
      }

      // Fall back to frequency-based suggestion
      const frequencyMap = new Map<string, { count: number; drink: string; sugar: string }>();
      
      historicalOrders.forEach(order => {
        const key = `${order.drink_type}_${order.sugar_level}`;
        const existing = frequencyMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          frequencyMap.set(key, {
            count: 1,
            drink: order.drink_type,
            sugar: order.sugar_level
          });
        }
      });

      // Find most frequent combination
      let maxCount = 0;
      let bestOption = null;
      
      for (const option of frequencyMap.values()) {
        if (option.count > maxCount) {
          maxCount = option.count;
          bestOption = option;
        }
      }

      if (bestOption) {
        const confidence = 0.5 + (maxCount / historicalOrders.length) * 0.3;

        return {
          drink: bestOption.drink,
          sugar: bestOption.sugar,
          confidence,
          reason: 'Your most frequent order'
        };
      }

      return null;
    } catch (error) {
      console.error('Error generating suggestion:', error);
      return null;
    }
  };

  // Update selectedOrder when user changes or orders change, and generate suggestions
  useEffect(() => {
    if (selectedUser) {
      const currentOrder = orders.find(order => order.user_id === selectedUser);
      if (currentOrder) {
        setSelectedOrder({ 
          drink: currentOrder.drink_type, 
          sugar: currentOrder.sugar_level 
        });
        setSuggestion(null); // Clear suggestion if user already has an order
      } else {
        if (orders.length > 0) {
          // Only clear selectedOrder if orders have loaded but user has no order
          // This prevents clearing on initial load when orders is empty
          setSelectedOrder(null);
        }
        // Generate suggestion for this user
        generateSuggestion(selectedUser).then(setSuggestion);
      }
    } else {
      setSelectedOrder(null);
      setSuggestion(null);
    }
  }, [selectedUser, orders]);

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    setIsUserDropdownOpen(false);
    saveLastSelectedUser(userId);
  };

  const handleQuickOrder = async (drinkName: string, sugarLevel: string) => {
    if (!selectedUser) return;

    // Check if this is the same selection as currently selected - if so, remove the order
    const isCurrentlySelected = selectedOrder && 
      selectedOrder.drink === drinkName && 
      selectedOrder.sugar === sugarLevel;

    if (isCurrentlySelected) {
      try {
        await supabase.from('orders').delete().match({ 
          session_id: session.id, 
          user_id: selectedUser 
        });
        setSelectedOrder(null);
        onOrderUpdate?.(); // Trigger immediate refetch
      } catch (error) {
        console.error('Error removing order:', error);
      }
      return;
    }

    // Otherwise, place/update the order immediately
    try {
      await supabase.from('orders').upsert(
        {
          session_id: session.id,
          user_id: selectedUser,
          drink_type: drinkName,
          sugar_level: sugarLevel,
          is_excused: false,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,user_id' }
      );
      
      setSelectedOrder({ drink: drinkName, sugar: sugarLevel });
      onOrderUpdate?.(); // Trigger immediate refetch
    } catch (error) {
      console.error('Error placing order:', error);
    }
  };



  const submittedUsers = orders.map((order) => order.user_id);
  const totalUsers = users.length;
  const hasSubmitted = submittedUsers.includes(selectedUser);
  const selectedUserData = users.find(u => u.id === selectedUser);

  // Group drinks by category
  const groupedDrinks = drinkOptions.reduce((acc, drink) => {
    if (!acc[drink.category]) {
      acc[drink.category] = [];
    }
    acc[drink.category].push(drink);
    return acc;
  }, {} as Record<string, typeof drinkOptions>);

  return (
    <div className="space-y-6">
      {/* User Selection Section */}
      <div className="space-y-4">
        <div className="relative max-w-sm mx-auto">
          <button
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="w-full p-4 bg-gray-800 border border-gray-700 rounded-2xl hover:bg-gray-700 transition-all duration-200 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <span className="body-medium font-medium">
              {selectedUserData ? selectedUserData.name : 'Select your name...'}
            </span>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isUserDropdownOpen && (
                         <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-2xl shadow-lg max-h-60 overflow-y-auto z-20 animate-slide-up">
              {users.sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user.id)}
                                     className="w-full p-4 text-left hover:bg-gray-700 transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl border-b border-gray-700 last:border-b-0 focus:outline-none focus:bg-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="body-medium font-medium">{user.name}</span>
                    {submittedUsers.includes(user.id) && (
                      <div className="badge-success">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Ordered
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Order Section */}
      {selectedUser && (
        <div className="animate-fade-in">
          {/* Personalized Suggestion */}
          {suggestion && !selectedOrder && (
            <div className="mb-6 animate-fade-in">
              <div className="text-center mb-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm font-medium">
                  <span>✨</span>
                  {suggestion.reason}
                </span>
              </div>
              
              <div 
                className="flex items-center justify-between p-4 rounded-xl border-2 border-purple-500/40 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 transition-all duration-200 cursor-pointer"
                onClick={() => handleQuickOrder(suggestion.drink, suggestion.sugar)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {drinkOptions.find(d => d.name === suggestion.drink)?.emoji || '🍵'}
                  </span>
                  <div>
                    <span className="body-medium font-medium text-purple-200">{suggestion.drink}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-purple-500/30 text-purple-300 rounded-full">
                        Suggested for you
                      </span>
                      <span className="text-xs text-purple-400/70">
                        {Math.round(suggestion.confidence * 100)}% match
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {sugarLevels.map((sugar) => {
                    const isRecommended = sugar.name === suggestion.sugar;
                    
                    return (
                      <button
                        key={sugar.name}
                        onClick={() => handleQuickOrder(suggestion.drink, sugar.name)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${
                          isRecommended 
                            ? 'bg-purple-500 text-white shadow-lg ring-2 ring-purple-400/50' 
                            : 'bg-purple-700/50 text-purple-300 hover:bg-purple-600/50'
                        }`}
                        title={`${sugar.name} Sugar`}
                      >
                        <span className="text-base">{sugar.emoji}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Minimal Drink List */}
          <div className="space-y-6">
            {Object.entries(groupedDrinks).map(([category, drinks]) => {
              // Filter drinks based on selection - if user has order, show only that drink
              const visibleDrinks = selectedOrder 
                ? drinks.filter(drink => drink.name === selectedOrder.drink)
                : drinks;
              
              if (visibleDrinks.length === 0) return null;
              
              return (
                <div key={category} className="space-y-4">
                  {!selectedOrder && (
                    <h4 className="label-large text-gray-400 text-center">{category}</h4>
                  )}
                  
                  <div className="space-y-3">
                    {visibleDrinks.map((drink) => {
                      const hasOrder = selectedOrder?.drink === drink.name;
                      
                      return (
                        <div 
                          key={drink.name}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                            hasOrder 
                              ? 'bg-green-500/5 border-green-500/30' 
                              : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{drink.emoji}</span>
                            <span className="body-medium font-medium">{drink.name}</span>
                            {hasOrder && (
                              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                                Ordered
                              </span>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            {sugarLevels.map((sugar) => {
                              const isSelected = hasOrder && selectedOrder?.sugar === sugar.name;
                              
                              return (
                                <button
                                  key={sugar.name}
                                  onClick={() => handleQuickOrder(drink.name, sugar.name)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${
                                    isSelected 
                                      ? 'bg-green-500 text-white shadow-lg' 
                                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  }`}
                                  title={`${sugar.name} Sugar`}
                                >
                                  <span className="text-base">{sugar.emoji}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Order Display */}
          {selectedOrder && (
            <div className="text-center animate-fade-in">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-full">
                <span className="text-green-400">✓</span>
                <span className="body-medium text-green-300">
                  {selectedOrder.drink} with {selectedOrder.sugar} sugar
                </span>
                <span className="text-sm text-green-400/70">• Confirmed</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Section */}
      <div className="material-card p-6 text-center">
        <div className="space-y-4">
          <div className="progress-track">
            <div 
              className="progress-indicator"
              style={{ width: `${(submittedUsers.length / totalUsers) * 100}%` }}
            />
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold text-blue-400">{submittedUsers.length}</span>
            <span className="text-lg text-gray-500">/</span>
            <span className="text-2xl font-bold">{totalUsers}</span>
          </div>
          
          {submittedUsers.length === totalUsers && (
            <div className="badge-success text-sm px-4 py-2">
              <span>🎉</span>
              All ordered!
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {!selectedUser && (
        <div className="text-center p-8 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50">
          <div className="text-4xl mb-2">☝️</div>
          <p className="body-medium text-gray-400">Select your name above</p>
        </div>
      )}
    </div>
  );
};

export default OrderForm;
