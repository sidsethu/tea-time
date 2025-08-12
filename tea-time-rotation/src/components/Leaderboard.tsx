// No explicit React import needed with React 17+ JSX transform

export type LeaderboardEntry = {
  name: string;
  total_drinks_bought: number | null;
};

interface LeaderboardProps {
  readonly entries: ReadonlyArray<LeaderboardEntry>;
}

const medalForIndex = (index: number): string => {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  return '🥉';
};

const containerClassByIndex = (index: number): string => {
  if (index === 0) return 'bg-yellow-50 border-yellow-200 text-yellow-900';
  if (index === 1) return 'bg-gray-50 border-gray-200 text-gray-800';
  return 'bg-amber-50 border-amber-200 text-amber-900';
};

function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="mt-6 bg-white/80 border border-gray-200 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Top Sponsors</h3>
      {entries.length === 0 ? (
        <p className="text-gray-600">No sponsors yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={`${entry.name}-${index}`}
              className={`flex items-center justify-between border rounded-lg px-3 py-2 ${containerClassByIndex(index)}`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl" aria-hidden>
                  {medalForIndex(index)}
                </span>
                <span className="font-medium">{entry.name}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">{entry.total_drinks_bought ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Leaderboard;


