interface BottomNavigationProps {
  currentTab: 'home' | 'analytics';
  onTabChange: (tab: 'home' | 'analytics') => void;
}

const BottomNavigation = ({ currentTab, onTabChange }: BottomNavigationProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-700 z-50">
      <div className="max-w-4xl mx-auto px-6 py-3">
        <div className="flex justify-around">
          <button
            onClick={() => onTabChange('home')}
            className={`flex flex-col items-center space-y-1 px-4 py-2 rounded-xl transition-all duration-200 ${
              currentTab === 'home'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="text-2xl">🫖</span>
            <span className="text-xs font-medium">Tea Time</span>
          </button>
          
          <button
            onClick={() => onTabChange('analytics')}
            className={`flex flex-col items-center space-y-1 px-4 py-2 rounded-xl transition-all duration-200 ${
              currentTab === 'analytics'
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <span className="text-2xl">📊</span>
            <span className="text-xs font-medium">Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation; 