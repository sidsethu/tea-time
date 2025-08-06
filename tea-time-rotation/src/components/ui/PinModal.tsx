import { useState, useEffect } from 'react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  correctPin: string;
}

const PinModal = ({ isOpen, onClose, onConfirm, title, message, correctPin }: PinModalProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (pin === correctPin) {
      onConfirm();
      onClose();
    } else {
      setError('Incorrect PIN. Please try again.');
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0'}`} onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 transform transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-t-2xl p-4 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <div className="p-6 text-center">
          <p className="text-gray-700 text-base leading-relaxed mb-4">{message}</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-center"
            maxLength={4}
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity duration-200"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinModal;
