/**
 * The application event log.
 *
 * Entries describe what this application did — a request sent, a transcript
 * received, synthesis started. They are not framework events, and nothing is
 * logged here that did not happen.
 */
import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';

import type { VoiceSessionLogEntry } from '../utils/voiceSession';

interface EventsLogPanelProps {
  events: VoiceSessionLogEntry[];
  onClearEvents: () => void;
}

const LEVEL_TONE: Record<VoiceSessionLogEntry['level'], string> = {
  info: 'text-white/50',
  success: 'text-emerald-300/80',
  warning: 'text-amber-300/80',
  error: 'text-red-300/90',
};

export const EventsLogPanel: React.FC<EventsLogPanelProps> = ({ events, onClearEvents }) => {
  const [levelFilter, setLevelFilter] = useState<'all' | VoiceSessionLogEntry['level']>('all');

  const filtered = useMemo(
    () => (levelFilter === 'all' ? events : events.filter((e) => e.level === levelFilter)),
    [events, levelFilter]
  );

  return (
    <section className="h-full flex flex-col bg-[#0D0F13] border border-white/[0.08] rounded-2xl overflow-hidden">
      <header className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-white/80">Event log</h3>
          <p className="text-[10px] font-mono text-white/35">{events.length} events</p>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
            aria-label="Filter events by level"
            className="bg-transparent border border-white/10 rounded-md text-[10px] text-white/60 px-1.5 py-1"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <button
            type="button"
            onClick={onClearEvents}
            aria-label="Clear event log"
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-white/30 font-mono">No events yet.</p>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className="font-mono text-[10px] leading-relaxed">
              <div className="flex items-baseline gap-2">
                <span className="text-white/25 tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className={LEVEL_TONE[entry.level]}>{entry.event}</span>
              </div>
              <p className="text-white/45 pl-1 break-words">{entry.detail}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
