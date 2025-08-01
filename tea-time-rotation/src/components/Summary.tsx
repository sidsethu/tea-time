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
  onClose: () => void;
}

const Summary = ({ session, onNewSession, onClose }: SummaryProps) => {
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

  // Generate readable order string
  const generateOrderString = () => {
    const orderItems: string[] = [];
    
    Object.entries(orderSummary).forEach(([drink, sugarLevels]) => {
      Object.entries(sugarLevels).forEach(([sugar, count]) => {
        const countText = count === 1 ? '1' : count.toString();
        const drinkText = count === 1 ? drink : `${drink}s`;
        const sugarText = sugar === 'No Sugar' ? 'with no sugar' : 
                         sugar === 'Less' ? 'with less sugar' : 
                         'with normal sugar';
        
        orderItems.push(`${countText} ${drinkText} ${sugarText}`);
      });
    });
    
    if (orderItems.length === 0) return 'No orders to make.';
    if (orderItems.length === 1) return `Please make ${orderItems[0]}.`;
    if (orderItems.length === 2) return `Please make ${orderItems.join(' and ')}.`;
    
    const lastItem = orderItems.pop();
    return `Please make ${orderItems.join(', ')}, and ${lastItem}.`;
  };

  return (
    <div className="space-y-10">
      <div className="text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-accent leading-tight px-4">
          {assignee ? `It's ${assignee}'s turn to get the tea!` : 'Calculating...'}
        </h2>
      </div>
      
      <div className="flex flex-col items-center space-y-6">
        <div className="w-full max-w-sm p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border border-gray-200 shadow-inner">
          <h3 className="text-xl font-bold mb-2 text-gray-800 text-center flex items-center justify-center">
            <span role="img" aria-label="summary emoji" className="mr-2">📋</span>
            Order Summary
          </h3>
          <h4 className="text-lg font-semibold mb-4 text-gray-600 text-center">
            Total {orders.length} Drinks
          </h4>
          <div className="space-y-2">
            {Object.entries(orderSummary).map(([drink, sugarLevels]) => {
              const total = Object.values(sugarLevels).reduce((sum, count) => sum + count, 0);
              const sugarMap: Record<string, string> = {
                'No Sugar': '🚫',
                'Less': '🤏',
                'Normal': '🍯',
              };
              const sugarString = Object.entries(sugarLevels)
                .map(([sugar, count]) => `${sugarMap[sugar] || '?'}:${count}`)
                .join(' ');
              return (
                <div key={drink} className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm">
                  <span className="text-base font-medium text-gray-700 truncate pr-2">
                    {drink} - ({sugarString})
                  </span>
                  <span className="text-lg font-bold text-accent bg-green-100 px-2 py-1 rounded-full min-w-[2rem] text-center">
                    {total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Script */}
        <div className="w-full max-w-2xl p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl border-2 border-blue-500/30 shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-blue-300 text-center flex items-center justify-center">
            <span role="img" aria-label="script emoji" className="mr-2">🗣️</span>
            Order Script
          </h3>
          <div className="bg-gray-800/50 p-4 rounded-2xl border border-blue-500/30 mb-4">
            <p className="text-lg text-gray-100 leading-relaxed text-center font-medium">
              "{generateOrderString()}"
            </p>
          </div>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => navigator.clipboard.writeText(generateOrderString())}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
            >
              <span role="img" aria-label="copy emoji" className="mr-2">📋</span>
              Copy Script
            </button>
            <button
              onClick={() => {
                if ('speechSynthesis' in window) {
                  const utterance = new SpeechSynthesisUtterance(generateOrderString());
                  speechSynthesis.speak(utterance);
                }
              }}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
            >
              <span role="img" aria-label="speak emoji" className="mr-2">🔊</span>
              Read Aloud
            </button>
          </div>
        </div>
        
        <details className="group w-full max-w-sm">
          <summary className="cursor-pointer font-bold text-base text-gray-700 hover:text-accent transition-colors duration-200 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 flex items-center justify-between">
            <span className="flex items-center">
              <span role="img" aria-label="details emoji" className="mr-2">📝</span>
              Detailed Breakdown
            </span>
            <span className="group-open:rotate-180 transition-transform duration-200">▼</span>
          </summary>
          <div className="mt-3 p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
            {Object.entries(detailedSummary).map(([drink, names]) => (
              <div key={drink} className="flex flex-col space-y-1 p-3 bg-gray-50 rounded-xl">
                <span className="font-bold text-gray-800 text-center">{drink}</span>
                <span className="text-sm text-gray-600 text-center">{names.join(', ')}</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="flex flex-col items-center space-y-5 pt-4">
        <button
          onClick={onNewSession}
          className="px-12 py-5 text-xl font-bold text-white bg-primary rounded-2xl hover:bg-blue-600 hover:scale-105 transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary/50 shadow-lg hover:shadow-xl"
        >
          <span role="img" aria-label="new session emoji" className="mr-3">🔄</span>
          Start New Tea Time
        </button>
        
        <button
          onClick={onClose}
          className="px-10 py-4 text-lg font-semibold text-gray-700 bg-gray-200 rounded-2xl hover:bg-gray-300 hover:scale-105 transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-400/50 shadow-md hover:shadow-lg"
        >
          <span role="img" aria-label="close emoji" className="mr-3">❌</span>
          Close Tea Time
        </button>
      </div>
    </div>
  );
};

export default Summary;
