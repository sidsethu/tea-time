import { useState } from 'react';
import { supabase } from '../supabaseClient';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void;
}

const AddUserModal = ({ isOpen, onClose, onUserAdded }: AddUserModalProps) => {
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userName.trim()) {
      setError('Please enter a name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const trimmedName = userName.trim();
      
      // Check if user with this name already exists (case-insensitive)
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id')
        .ilike('name', trimmedName);

      if (checkError) {
        console.error('Database check error:', checkError);
        throw new Error('Failed to check existing user: ' + checkError.message);
      }

      if (existingUsers && existingUsers.length > 0) {
        setError('A user with this name already exists');
        return;
      }

      // Add the new user
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ name: trimmedName }]);

      if (insertError) {
        throw insertError;
      }

      // Success
      setUserName('');
      onUserAdded();
      onClose();
      alert(`🎉 User "${trimmedName}" added successfully!`);
    } catch (error: unknown) {
      console.error('Error adding user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add user. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUserName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in">
      <div className="material-card max-w-md w-full animate-scale-in">
        {/* Header */}
        <div className="p-8 pb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-material-lg">
            <span className="text-2xl">👤</span>
          </div>
          <h2 className="headline-medium mb-2">Add New User</h2>
                      <p className="body-medium text-gray-400">Add a new tea enthusiast to the team!</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
          <div className="space-y-3">
            <label htmlFor="userName" className="label-large block">
              Name
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter user name"
              className="material-input"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="body-medium text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn-surface flex-1"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Adding...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span className="text-lg">➕</span>
                  Add User
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal; 