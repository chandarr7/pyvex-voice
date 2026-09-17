import React, { useState } from 'react';
import { Terminal, Trash2, Filter } from 'lucide-react';
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
    <div className="bg-[#121316]/70 border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl flex flex-col h-full min-h-[380px] max-h-[500px]">
      {/* Telemetry Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.015]">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-3.5 h-3.5 text-white/50" />
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-white/70">
            Pipeline Telemetry
          </h2>
          <span className="text-[10px] font-mono text-white/30">
            [{events.length} frames]
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.08] rounded-full p-0.5 text-xs font-mono">
            {(['all', 'transport', 'vad', 'stt', 'llm', 'tts'] as const).map((sourceKey) => (
              <button
                key={sourceKey}
                onClick={() => setFilter(sourceKey)}
                className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider transition-all ${
                  filter === sourceKey
                    ? 'bg-white/15 text-white font-medium shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {sourceKey}
              </button>
            ))}
          </div>

          <button
            id="clear-events-button"
            onClick={onClearEvents}
            className="p-1.5 rounded-full hover:bg-white/[0.06] text-white/40 hover:text-white/80 transition-colors"
            title="Purge Telemetry History"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Telemetry List */}
      <div className="flex-1 p-3.5 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/30 italic text-xs py-8">
            Telemetry buffer empty.
          </div>
        ) : (
          filteredEvents.map((event) => {
            const statusDot =
              event.status === 'success'
                ? 'bg-emerald-400/80'
                : event.status === 'warning'
                ? 'bg-amber-400/80'
                : event.status === 'error'
                ? 'bg-rose-400/80'
                : 'bg-white/40';

            return (
              <div
                key={event.id}
                className="flex items-start gap-2.5 p-2 rounded-lg border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${statusDot}`} />

                <span className="text-white/30 text-[10px] shrink-0 pt-0.5">
                  {event.timestamp}
                </span>

                <span className="text-white/70 font-semibold tracking-tight uppercase text-[10px] shrink-0 pt-0.5">
                  {event.type}
                </span>

                <span className="text-white/50 flex-1 truncate pt-0.5">
                  {event.details}
                </span>

                <span className="text-[9px] uppercase tracking-widest text-white/30 px-1.5 py-0.5 rounded border border-white/[0.05] bg-white/[0.02] shrink-0">
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
