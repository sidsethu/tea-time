import { useState } from 'react';
import type { LeaderboardEntry } from './Leaderboard';
import Leaderboard from './Leaderboard';

interface ChaiLyticsProps {
  readonly topSponsors: ReadonlyArray<LeaderboardEntry>;
  readonly topDrinkers: ReadonlyArray<LeaderboardEntry>;
  readonly totalSessions: number;
  readonly lastAssignee: string | null;
  readonly currentUserName?: string;
  readonly currentUserStats?: {
    userData: LeaderboardEntry;
    sponsorRank: number;
    drinkerRank: number;
  };
}

type Tab = 'sponsors' | 'drinkers';

function ChaiLytics({ topSponsors, topDrinkers, totalSessions, lastAssignee, currentUserName, currentUserStats }: ChaiLyticsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('sponsors');

  return (
    <div className="mt-6 bg-white/80 border border-gray-200 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">📊 Chai-lytics 📈</h3>
      <div className="text-center text-gray-600 space-y-1 mb-4">
        {totalSessions > 0 && (
          <p>📈 Total Sessions: <strong>{totalSessions}</strong></p>
        )}
        {lastAssignee && (
          <p>🏆 Last Sponsor: <strong>{lastAssignee}</strong></p>
        )}
      </div>
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('sponsors')}
          className={`flex-1 py-2 text-sm font-medium text-center ${
            activeTab === 'sponsors'
              ? 'border-b-2 border-green-500 text-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sponsors
        </button>
        <button
          onClick={() => setActiveTab('drinkers')}
          className={`flex-1 py-2 text-sm font-medium text-center ${
            activeTab === 'drinkers'
              ? 'border-b-2 border-green-500 text-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Drinkers
        </button>
      </div>
      <div className="pt-4">
        {activeTab === 'sponsors' && (
          <Leaderboard
            entries={topSponsors}
            field="total_drinks_bought"
            currentUserName={currentUserName}
            currentUserEntry={currentUserStats?.userData}
            currentUserRank={currentUserStats?.sponsorRank}
          />
        )}
        {activeTab === 'drinkers' && (
          <Leaderboard
            entries={topDrinkers}
            field="drink_count"
            currentUserName={currentUserName}
            currentUserEntry={currentUserStats?.userData}
            currentUserRank={currentUserStats?.drinkerRank}
          />
        )}
      </div>
    </div>
  );
}

export default ChaiLytics;
