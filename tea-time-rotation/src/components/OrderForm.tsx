import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface User {
  id: string;
  name: string;
  last_ordered_drink: string;
  last_sugar_level: string;
}

interface Order {
  user_id: string;
}

interface OrderFormProps {
  session: {
    id: string;
  };
  orders: Order[];
  users: User[];
}

const OrderForm = ({ session, orders, users }: OrderFormProps) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [drinkType, setDrinkType] = useState('Tea');
  const [sugarLevel, setSugarLevel] = useState('Normal');
  const [isExcused, setIsExcused] = useState(false);

  useEffect(() => {
    if (selectedUser) {
      const user = users.find(u => u.id === selectedUser);
      if (user) {
        if (user.last_ordered_drink) {
          setDrinkType(user.last_ordered_drink);
        } else {
          setDrinkType('Tea');
        }
        if (user.last_sugar_level) {
          setSugarLevel(user.last_sugar_level);
        } else {
          setSugarLevel('Normal');
        }
      }
    }
  }, [selectedUser, users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      alert('Please select your name.');
      return;
    }

    await supabase.from('orders').upsert(
      {
        session_id: session.id,
        user_id: selectedUser,
        drink_type: drinkType,
        sugar_level: sugarLevel,
        is_excused: isExcused,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,user_id' }
    );

    localStorage.setItem('tea-time-user', selectedUser);
    setSelectedUser('');
    setDrinkType('Tea');
    setSugarLevel('Normal');
    setIsExcused(false);
  };

  const submittedUsers = orders.map((order) => order.user_id);
  const totalUsers = users.length;
  const hasSubmitted = submittedUsers.includes(selectedUser);

  const handleRevokeOrder = async () => {
    if (!selectedUser) {
      alert('Please select your name.');
      return;
    }

    if (!window.confirm('Are you sure you want to revoke your order?')) {
      return;
    }

    await supabase.from('orders').delete().match({ session_id: session.id, user_id: selectedUser });
    setSelectedUser('');
    setDrinkType('Tea');
    setSugarLevel('Normal');
    setIsExcused(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-16">
      <div className="space-y-6">
        <div className="space-y-3 flex flex-col items-center">
          <label htmlFor="user" className="block text-lg font-semibold text-gray-700 text-center">
            👤 Your Name
          </label>
          <select
            id="user"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-80 max-w-full pl-4 pr-10 py-4 text-lg border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-brand-yellow/50 focus:border-brand-yellow rounded-2xl bg-gray-50 hover:bg-white transition-all duration-200"
          >
            <option value="" disabled>Select your name</option>
            {users.sort((a, b) => a.name.localeCompare(b.name)).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 flex flex-col items-center">
          <label htmlFor="drink" className="block text-lg font-semibold text-gray-700 text-center">
            🍵 Your Drink
          </label>
          <select
            id="drink"
            value={drinkType}
            onChange={(e) => setDrinkType(e.target.value)}
            className="w-80 max-w-full pl-4 pr-10 py-4 text-lg border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-brand-yellow/50 focus:border-brand-yellow rounded-2xl bg-gray-50 hover:bg-white transition-all duration-200"
          >
            <option>Badam Milk 🥛</option>
            <option>Black Coffee ☕</option>
            <option>Black Tea 🍵</option>
            <option>Coffee ☕</option>
            <option>Fruit Juice 🧃</option>
            <option>Lemon Tea 🍋</option>
            <option>Plain Milk 🥛</option>
            <option>Tea 🍵</option>
          </select>
        </div>

        <div className="space-y-3 flex flex-col items-center">
          <label className="block text-lg font-semibold text-gray-700 text-center">
            🍯 Sugar Level
          </label>
          <div className="flex space-x-4">
            {['No Sugar', 'Less', 'Normal'].map((level) => (
              <label key={level} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="sugar"
                  value={level}
                  checked={sugarLevel === level}
                  onChange={(e) => setSugarLevel(e.target.value)}
                  className="w-5 h-5 text-brand-yellow bg-gray-100 border-gray-300 focus:ring-brand-yellow focus:ring-2"
                />
                <span className="text-lg font-medium text-gray-700">{level}</span>
              </label>
            ))}
          </div>
        </div>

        {/* <div className="flex items-center space-x-3 p-4 bg-amber-50 rounded-2xl border border-amber-200">
          <input
            type="checkbox"
            id="excused"
            checked={isExcused}
            onChange={(e) => setIsExcused(e.target.checked)}
            className="w-5 h-5 text-brand-yellow bg-gray-100 border-gray-300 rounded focus:ring-brand-yellow focus:ring-2"
          />
          <label htmlFor="excused" className="text-lg font-medium text-gray-700">
            🚫 I'm excused from making tea today
          </label>
        </div> */}
      </div>

      <div className="space-y-8">
        <div className="flex justify-center space-x-4">
          <button
            type="submit"
            className="px-12 py-4 text-xl font-bold text-gray-800 bg-brand-yellow rounded-2xl hover:bg-yellow-300 hover:scale-105 transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-brand-yellow/50 shadow-lg hover:shadow-xl"
          >
            <span role="img" aria-label="coffee emoji" className="mr-3">☕</span>
            {hasSubmitted ? 'Update my Order' : 'Submit my Order'}
          </button>
          {hasSubmitted && (
            <button
              type="button"
              onClick={handleRevokeOrder}
              className="px-6 py-4 text-lg font-bold text-white bg-red-500 rounded-2xl hover:bg-red-600 hover:scale-105 transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-red-500/50 shadow-lg hover:shadow-xl"
            >
              Revoke Order
            </button>
          )}
        </div>

        <div className="text-center p-4 bg-gray-50 rounded-2xl">
          <p className="text-lg font-medium text-gray-600">
            <span className="text-2xl font-bold text-accent">{submittedUsers.length}</span>
            <span className="mx-2">/</span>
            <span className="text-2xl font-bold text-gray-800">{totalUsers}</span>
            <span className="block mt-1 text-base">People have submitted</span>
          </p>
        </div>
      </div>
    </form>
  );
};

export default OrderForm;
