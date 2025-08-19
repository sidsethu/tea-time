// No explicit React import needed with React 17+ JSX transform

export type LeaderboardEntry = {
  name: string;
  total_drinks_bought: number | null;
  drink_count: number | null;
};

interface LeaderboardProps {
  readonly entries: ReadonlyArray<LeaderboardEntry>;
  readonly field: 'total_drinks_bought' | 'drink_count';
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

function Leaderboard({ entries, field }: LeaderboardProps) {
  return (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <p className="text-gray-600">No entries yet.</p>
      ) : (
        entries.map((entry, index) => (
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
              <span className="font-semibold">{entry[field] ?? 0}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default Leaderboard;
