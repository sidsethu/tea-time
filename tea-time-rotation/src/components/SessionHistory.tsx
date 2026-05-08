import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface SessionHistoryProps {
  userId: string;
  onBack: () => void;
}

interface HistoryEntry {
  sessionId: string;
  endedAt: string;
  myDrink: string;
  mySugar: string;
  isExcused: boolean;
  assigneeName: string | null;
  summarizerName: string | null;
}

interface OrderRow {
  drink_type: string;
  sugar_level: string;
  is_excused: boolean;
  sessions: {
    id: string;
    ended_at: string;
    assignee_name: string | null;
    summarized_by: string | null;
  };
}

const SUGAR_EMOJI: Record<string, string> = {
  'No Sugar': '🚫',
  Less: '🤏🏽',
  Normal: '🍯',
};

const drinkEmoji = (drink: string): string => {
  const d = drink.trim();
  if (d.includes('Tea')) return '🍵';
  if (d.includes('Coffee')) return '☕';
  return '🫖';
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
};

const formatRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
};

const SessionHistory = ({ userId, onBack }: SessionHistoryProps) => {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          drink_type,
          sugar_level,
          is_excused,
          sessions!inner (
            id,
            ended_at,
            status,
            assignee_name,
            summarized_by
          )
        `)
        .eq('user_id', userId)
        .eq('sessions.status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data) {
        setEntries([]);
        return;
      }

      const rows = data as unknown as OrderRow[];

      const summarizerIds = Array.from(
        new Set(
          rows
            .map((r) => r.sessions.summarized_by)
            .filter((id): id is string => !!id),
        ),
      );

      const summarizerMap: Record<string, string> = {};
      if (summarizerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name')
          .in('id', summarizerIds);
        if (users) {
          for (const u of users as { id: string; name: string }[]) {
            summarizerMap[u.id] = u.name;
          }
        }
      }

      const mapped: HistoryEntry[] = rows
        .map((r) => ({
          sessionId: r.sessions.id,
          endedAt: r.sessions.ended_at,
          myDrink: r.drink_type,
          mySugar: r.sugar_level,
          isExcused: r.is_excused,
          assigneeName: r.sessions.assignee_name,
          summarizerName: r.sessions.summarized_by
            ? summarizerMap[r.sessions.summarized_by] ?? null
            : null,
        }))
        .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());

      setEntries(mapped);
    };

    fetchHistory();
  }, [userId]);

  const subtitle =
    entries === null
      ? 'Loading…'
      : entries.length === 0
        ? 'No entries yet'
        : entries.length === 1
          ? 'Your last sip'
          : `Your last ${entries.length} sips`;

  return (
    <div className="text-center space-y-6 sm:space-y-8 animate-fade-in">
      <div className="space-y-4 sm:space-y-6 px-4">
        <div className="inline-block bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl px-6 py-4 border-2 border-amber-200">
          <div className="flex items-center justify-center mb-2">
            <span className="text-3xl sm:text-4xl mr-3">📓</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Tea Journal</h2>
          </div>
          <p className="text-gray-700 text-base sm:text-lg font-medium">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-4 px-2 sm:px-4 max-w-xl mx-auto">
        {entries === null ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-gray-100 animate-pulse rounded-2xl h-32" />
            ))}
          </>
        ) : entries.length === 0 ? (
          <div className="bg-white/95 border-2 border-gray-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-lg">
            <div className="text-5xl mb-3">🫖</div>
            <p className="text-gray-700 text-base sm:text-lg font-medium">
              No tea time entries yet. Your first sip will land here.
            </p>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.sessionId}
              className="bg-white/95 border-2 border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-lg text-left animate-slide-up hover:scale-[1.01] transition-transform duration-200"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full px-3 py-1 text-sm font-semibold text-amber-900">
                  <span className="mr-1.5">📓</span>
                  {formatDate(entry.endedAt)}
                </span>
                <span className="text-xs text-gray-500">{formatRelative(entry.endedAt)}</span>
              </div>

              <div className="border-t border-dashed border-gray-200 my-3" />

              {entry.isExcused ? (
                <div className="flex items-center gap-3 opacity-60">
                  <span className="text-3xl">🛌</span>
                  <span className="font-bold text-gray-900">You sat this one out</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-3xl">{drinkEmoji(entry.myDrink)}</span>
                  <span className="font-bold text-gray-900 text-base sm:text-lg">
                    {entry.myDrink.trim()}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="inline-flex items-center bg-gray-100 border border-gray-300 rounded-full px-3 py-1 text-sm">
                    <span className="mr-1">{SUGAR_EMOJI[entry.mySugar] ?? '?'}</span>
                    <span className="font-medium text-gray-700">{entry.mySugar}</span>
                  </span>
                </div>
              )}

              <div className="border-t border-dashed border-gray-200 my-3" />

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <span>💸</span>
                  <span className="text-gray-500">Sponsored by:</span>
                  <span className="font-semibold text-gray-900">
                    {entry.assigneeName ?? '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span>📋</span>
                  <span className="text-gray-500">Summarized by:</span>
                  <span className="font-semibold text-gray-900">
                    {entry.summarizerName ?? '—'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col items-center pt-2 pb-4 px-4">
        <button
          onClick={onBack}
          className="btn-primary text-lg sm:text-xl font-bold px-6 sm:px-8 py-3 sm:py-4 group relative overflow-hidden rounded-xl sm:rounded-2xl w-full max-w-xs sm:max-w-sm"
        >
          <span className="relative z-10 flex items-center justify-center">
            <span className="mr-3 text-xl sm:text-2xl group-hover:animate-bounce">←</span>
            <span className="text-base sm:text-lg">Back to Home</span>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
        </button>
      </div>
    </div>
  );
};

export default SessionHistory;
