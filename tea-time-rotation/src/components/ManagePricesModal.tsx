import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import type { Drink } from '../utils';
import ModalPortal from './ui/ModalPortal';

interface DrinkPrice {
  id: string;
  drink_type: string;
  sugar_level: string;
  price: number;
}

interface ManagePricesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUGAR_LEVELS = ['No Sugar', 'Less', 'Normal', '*'];

const ManagePricesModal = ({ isOpen, onClose }: ManagePricesModalProps) => {
  const { profile } = useAuth();
  const [prices, setPrices] = useState<DrinkPrice[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [newDrink, setNewDrink] = useState('Tea');
  const [newSugar, setNewSugar] = useState('Normal');
  const [newPrice, setNewPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) fetchPrices();
  }, [isOpen]);

  const fetchPrices = async () => {
    const [pricesResult, drinksResult] = await Promise.all([
      supabase.from('drink_prices').select('*').order('drink_type').order('sugar_level'),
      supabase.from('drinks').select('name, emoji, is_popular').eq('is_active', true).order('name'),
    ]);
    if (pricesResult.data) setPrices(pricesResult.data as DrinkPrice[]);
    if (drinksResult.data) setDrinks(drinksResult.data as Drink[]);
  };

  if (!isOpen || !profile?.permissions.includes('can_manage_prices')) return null;

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(newPrice);
    if (!newPrice || isNaN(priceNum) || priceNum < 0) {
      setError('Enter a valid price.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const { error: upsertError } = await supabase
      .from('drink_prices')
      .upsert(
        { drink_type: newDrink, sugar_level: newSugar, price: priceNum },
        { onConflict: 'drink_type,sugar_level' }
      );
    if (upsertError) {
      setError(upsertError.message);
    } else {
      setNewPrice('');
      fetchPrices();
    }
    setIsLoading(false);
  };

  const handlePriceEdit = async (id: string, drinkType: string, sugarLevel: string) => {
    const val = editingPrices[id];
    if (val === undefined) return;
    const priceNum = parseInt(val);
    if (isNaN(priceNum) || priceNum < 0) return;
    await supabase
      .from('drink_prices')
      .upsert(
        { drink_type: drinkType, sugar_level: sugarLevel, price: priceNum },
        { onConflict: 'drink_type,sugar_level' }
      );
    fetchPrices();
    setEditingPrices(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 opacity-100">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 transform transition-all duration-300 scale-100 translate-y-0 max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl p-4 text-center">
          <h3 className="text-xl font-bold text-white">Manage Drink Prices</h3>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <h4 className="font-semibold text-gray-700 mb-3">Current Prices</h4>
          <div className="space-y-2 mb-6">
            {prices.length === 0 ? (
              <p className="text-gray-500 text-sm">No prices set yet.</p>
            ) : (
              prices.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div className="text-sm font-medium text-gray-800">
                    <span className="font-bold">{p.drink_type === '*' ? '* (all drinks)' : p.drink_type}</span>
                    {' / '}
                    <span>{p.sugar_level === '*' ? '* (all sugars)' : p.sugar_level}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={editingPrices[p.id] !== undefined ? editingPrices[p.id] : p.price}
                      onChange={e => setEditingPrices(prev => ({ ...prev, [p.id]: e.target.value }))}
                      onBlur={() => handlePriceEdit(p.id, p.drink_type, p.sugar_level)}
                      min="0"
                    />
                    <span className="text-gray-500 text-sm">₹</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <h4 className="font-semibold text-gray-700 mb-3">Add / Update Price</h4>
          <form onSubmit={handleAddOrUpdate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 font-medium">Drink Type</label>
                <select
                  value={newDrink}
                  onChange={e => setNewDrink(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                >
                  {[...drinks.map(d => d.name), '*'].map(d => (
                    <option key={d} value={d}>{d === '*' ? '* (wildcard)' : d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium">Sugar Level</label>
                <select
                  value={newSugar}
                  onChange={e => setNewSugar(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                >
                  {SUGAR_LEVELS.map(s => (
                    <option key={s} value={s}>{s === '*' ? '* (wildcard)' : s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium">Price (₹)</label>
              <input
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                placeholder="e.g. 20"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mt-1 text-sm"
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors duration-200 text-sm"
                disabled={isLoading}
              >
                Close
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity duration-200 text-sm"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Price'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default ManagePricesModal;
