import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface User {
  name: string;
}

interface Order {
  id: string;
  drink_type: string;
  sugar_level: string;
  users: User | User[] | null;
}

function isUser(user: User | User[] | null): user is User {
  return user !== null && !Array.isArray(user) && typeof (user as User).name === 'string';
}

interface SummaryProps {
  session: {
    id: string;
  };
  onNewSession: () => void;
}

const Summary = ({ session, onNewSession }: SummaryProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [assignee, setAssignee] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, users(name)')
        .eq('session_id', session.id);
      if (data) {
        setOrders(data as Order[]);
      }
    };

    const fetchAssignee = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('assignee_name')
        .eq('id', session.id)
        .single();
      if (data && data.assignee_name) {
        setAssignee(data.assignee_name);
      }
    };

    if (session) {
      fetchOrders();
      fetchAssignee();
    }
  }, [session]);

  const orderSummary = orders.reduce((acc, order) => {
    const drink = order.drink_type.trim();
    const sugar = order.sugar_level;
    if (!acc[drink]) {
      acc[drink] = {};
    }
    if (!acc[drink][sugar]) {
      acc[drink][sugar] = 0;
    }
    acc[drink][sugar]++;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  const detailedSummary = orders.reduce((acc, order) => {
    const key = `${order.drink_type.trim()} (${order.sugar_level})`;
    if (!acc[key]) {
      acc[key] = [];
    }
    if (isUser(order.users)) {
      acc[key].push(order.users.name);
    }
    return acc;
  }, {} as Record<string, string[]>);



  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Celebration Header */}
      <div className="text-center space-y-6 animate-fade-in">
        <div className="relative">
          {/* Celebration Confetti Animation */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-bounce-subtle"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  fontSize: '2rem',
                }}
              >
                {['🎉', '🎊', '✨', '🌟'][Math.floor(Math.random() * 4)]}
              </div>
            ))}
          </div>
          
          <div className="relative z-10">
            <div className="text-8xl mb-4 animate-bounce-subtle">🎉</div>
            <div className="inline-block bg-white/95 border-2 border-gray-200 rounded-2xl sm:rounded-3xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 shadow-lg">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                {assignee ? `${assignee}'s Tea Turn!` : 'Calculating Assignment...'}
              </h2>
              <p className="text-gray-700 text-base sm:text-lg mt-2 font-medium">Session completed successfully</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Order Summary with Data Visualization */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Summary Card */}
        <div className="bg-white/95 border-2 border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 animate-slide-up shadow-lg">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center">
              <span className="mr-3 text-3xl">📊</span>
              Order Analytics
            </h3>
            <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-secondary-100 to-matcha-100 rounded-full px-6 py-2">
              <span className="text-gray-700 font-semibold text-lg">Total Drinks : {orders.length}</span>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(orderSummary).map(([drink, sugarLevels], index) => {
              const total = Object.values(sugarLevels).reduce((sum, count) => sum + count, 0);
              const percentage = (total / orders.length) * 100;
              const sugarMap: Record<string, string> = {
                'No Sugar': '🚫',
                'Less': '🤏🏽',
                'Normal': '🍯',
              };
              
              return (
                <div 
                  key={drink} 
                  className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:scale-105 transition-all duration-300 animate-slide-up shadow-md hover:shadow-lg"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {drink.includes('Tea') ? '🍵' : 
                         drink.includes('Coffee') ? '☕' : 
                         drink.includes('Milk') ? '🥛' : 
                         drink.includes('Juice') ? '🧃' : '🥤'}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900">{drink}</span>
                        <div className="flex space-x-1 mt-1">
                          {Object.entries(sugarLevels).map(([sugar, count]) => (
                            <span key={sugar} className="text-sm bg-gray-100 border border-gray-300 rounded-full px-2 py-1 font-medium">
                              {sugarMap[sugar] || '?'}×{count}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {total}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-surface-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-500 to-chai-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="glass-card rounded-4xl p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-2xl font-bold text-surface-800 mb-6 flex items-center justify-center">
            <span className="mr-3 text-3xl">👥</span>
            Who Ordered What
          </h3>
          
          <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
            {Object.entries(detailedSummary).map(([drink, names], index) => (
              <div 
                key={drink} 
                className="glass-card rounded-2xl p-4 hover:shadow-lg transition-all duration-300 animate-scale-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="text-center mb-3">
                  <span className="font-bold text-lg text-surface-800 bg-gradient-to-r from-primary-100 to-chai-100 px-4 py-2 rounded-full">
                    {drink}
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {names.map((name, nameIndex) => (
                    <span 
                      key={name}
                      className="inline-flex items-center space-x-1 bg-gradient-to-r from-secondary-100 to-matcha-100 text-surface-700 px-3 py-1 rounded-full text-sm font-medium animate-fade-in"
                      style={{ animationDelay: `${(index * 0.05) + (nameIndex * 0.02)}s` }}
                    >
                      <span>👤</span>
                      <span>{name}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
        <button
          onClick={onNewSession}
          className="btn-primary text-lg sm:text-xl font-bold px-6 sm:px-8 py-3 sm:py-4 group relative overflow-hidden rounded-xl sm:rounded-2xl w-full max-w-xs sm:max-w-sm"
        >
          <span className="relative z-10 flex items-center justify-center">
            <span className="mr-3 text-xl sm:text-2xl group-hover:animate-spin">🔄</span>
            <span className="text-base sm:text-lg">Start New Tea Time</span>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
        </button>
        

      </div>


    </div>
  );
};

export default Summary;
