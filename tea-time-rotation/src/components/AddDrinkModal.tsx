import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import ModalPortal from './ui/ModalPortal';

interface AddDrinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDrinkAdded: () => void;
}

const AddDrinkModal = ({ isOpen, onClose, onDrinkAdded }: AddDrinkModalProps) => {
  const [drinkName, setDrinkName] = useState('');
  const [emoji, setEmoji] = useState('🍵');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  if (!isOpen || !profile?.permissions.includes('can_add_drink')) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!drinkName.trim()) {
      setError('Drink name cannot be empty.');
      setIsLoading(false);
      return;
    }

    const priceNum = parseInt(defaultPrice);
    if (!defaultPrice || isNaN(priceNum) || priceNum < 0) {
      setError('Enter a valid price.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: drinkError } = await supabase
        .from('drinks')
        .insert({ name: drinkName.trim(), emoji: emoji.trim() || '🍵' });

      if (drinkError) throw drinkError;

      const { error: priceError } = await supabase
        .from('drink_prices')
        .upsert(
          { drink_type: drinkName.trim(), sugar_level: '*', price: priceNum },
          { onConflict: 'drink_type,sugar_level' }
        );

      if (priceError) throw priceError;

      onDrinkAdded();
      onClose();
      setDrinkName('');
      setEmoji('🍵');
      setDefaultPrice('');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 opacity-100">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 transform transition-all duration-300 scale-100 translate-y-0">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl p-4 text-center">
          <h3 className="text-xl font-bold text-white">Add New Drink</h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-600 font-medium">Drink Name</label>
              <input
                type="text"
                value={drinkName}
                onChange={(e) => setDrinkName(e.target.value)}
                placeholder="e.g. Masala Chai"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium">Emoji</label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="e.g. ☕"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 mt-1 text-2xl"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium">Default Price (₹)</label>
              <input
                type="number"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="e.g. 25"
                min="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors duration-200"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity duration-200"
                disabled={isLoading}
              >
                {isLoading ? 'Adding...' : 'Add Drink'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default AddDrinkModal;
