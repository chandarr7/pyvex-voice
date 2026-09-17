import React, { useState } from 'react';
import { Terminal, Filter, Trash2, CheckCircle2, AlertTriangle, Info, Clock } from 'lucide-react';
import { FrameEvent } from '../types';

interface EventsLogPanelProps {
  events: FrameEvent[];
  onClearEvents: () => void;
}

export const EventsLogPanel: React.FC<EventsLogPanelProps> = ({ events, onClearEvents }) => {
  const [filter, setFilter] = useState<'all' | 'transport' | 'vad' | 'stt' | 'llm' | 'tts'>('all');

  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true;
    return e.source === filter;
  });

  return (
    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-lg flex flex-col h-full min-h-[360px] max-h-[480px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Frame & RTVI Observer</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            {events.length} frames
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Source Filter */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
            {(['all', 'transport', 'vad', 'stt', 'llm', 'tts'] as const).map((sourceKey) => (
              <button
                key={sourceKey}
                onClick={() => setFilter(sourceKey)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono transition-colors ${
                  filter === sourceKey
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {sourceKey.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            id="clear-events-button"
            onClick={onClearEvents}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Clear Event Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 italic">
            No pipeline frame events yet.
          </div>
        ) : (
          filteredEvents.map((event) => {
            const statusBadge =
              event.status === 'success'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : event.status === 'warning'
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : event.status === 'error'
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';

            return (
              <div
                key={event.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-900/80 transition-colors"
              >
                <span className="text-zinc-500 shrink-0 select-none text-[10px] mt-0.5">
                  {event.timestamp}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border shrink-0 ${statusBadge}`}
                >
                  {event.type}
                </span>

                <span className="text-zinc-300 flex-1 truncate">{event.details}</span>

                <span className="text-[10px] text-zinc-500 uppercase px-1.5 py-0.5 rounded bg-zinc-800/80 shrink-0">
                  {event.source}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
