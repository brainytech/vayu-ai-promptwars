import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type {
  AirQualityTelemetry,
  HouseholdProfile,
  RoutinePlanResponse,
} from '../types';
import { fetchDailyRoutine } from '../services/api';

interface DailyRoutinePlannerProps {
  telemetry: AirQualityTelemetry | null;
  profile: HouseholdProfile;
  completedIds: string[];
  onToggleComplete: (id: string) => void;
  onResetCompleted: () => void;
}

const TAILOR_PRESETS = [
  'School drop-off at 08:00 AM',
  'Evening metro commute at 18:30',
  'Elderly morning walk safely timed',
  'Keep toddler indoors with active play',
];

export const DailyRoutinePlanner: React.FC<DailyRoutinePlannerProps> = ({
  telemetry,
  profile,
  completedIds,
  onToggleComplete,
  onResetCompleted,
}) => {
  const [plan, setPlan] = useState<RoutinePlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tailorInput, setTailorInput] = useState('');
  const [lastContextKey, setLastContextKey] = useState<string>('');

  const contextKey = useMemo(() => {
    if (!telemetry) return '';
    return `${telemetry.city.name}-${telemetry.current.usAqi}-${profile.sensitivities.join(
      ','
    )}-${profile.commuteMode}-${profile.homeSetup.join(',')}`;
  }, [telemetry, profile]);

  const generateRoutine = useCallback(
    async (customInstruction?: string) => {
      if (!telemetry) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchDailyRoutine({
          telemetry,
          profile,
          tailorInstruction: customInstruction ?? tailorInput,
        });
        setPlan(result);
        setLastContextKey(contextKey);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to generate daily routine.');
      } finally {
        setIsLoading(false);
      }
    },
    [telemetry, profile, tailorInput, contextKey]
  );

  // Automatically generate on first entry when telemetry is ready
  useEffect(() => {
    if (telemetry && !plan && !isLoading && !error) {
      generateRoutine();
    }
  }, [telemetry, plan, isLoading, error, generateRoutine]);

  const stats = useMemo(() => {
    const items = plan?.items ?? [];
    const totalPm25 = items.reduce((sum, item) => sum + (item.pm25SavedUg || 0), 0);
    const totalCo2 = items.reduce((sum, item) => sum + (item.co2SavedKg || 0), 0);
    const doneItems = items.filter((item) => completedIds.includes(item.id));
    const savedPm25 = doneItems.reduce((sum, item) => sum + (item.pm25SavedUg || 0), 0);
    const savedCo2 = doneItems.reduce((sum, item) => sum + (item.co2SavedKg || 0), 0);
    return {
      totalCount: items.length,
      doneCount: doneItems.length,
      totalPm25,
      totalCo2: Math.round(totalCo2 * 10) / 10,
      savedPm25,
      savedCo2: Math.round(savedCo2 * 10) / 10,
    };
  }, [plan, completedIds]);

  const isStale = Boolean(plan && lastContextKey && lastContextKey !== contextKey);

  return (
    <div className="space-y-6">
      {/* Header & Progress Tracker */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-teal-700">
              Gemini AI Daily Routine Planner · {telemetry?.city.name ?? 'City'} (US AQI{' '}
              <span className="font-mono tabular-nums">{telemetry?.current.usAqi ?? '—'}</span>)
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Low-Emission Daily Schedule
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              {plan?.headline ??
                'Time-blocked protection and emission-saving actions calibrated to your household profile and live hourly smog dispersion.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
            <div>
              <div className="text-[11px] text-slate-500">Completed</div>
              <div className="text-lg font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {stats.doneCount}/{stats.totalCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">PM2.5 Avoided</div>
              <div className="text-lg font-mono font-bold text-teal-700 tabular-nums mt-0.5">
                {stats.savedPm25} µg
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">CO₂ Saved</div>
              <div className="text-lg font-mono font-bold text-emerald-700 tabular-nums mt-0.5">
                {stats.savedCo2} kg
              </div>
            </div>
          </div>
        </div>

        {/* Tailor / Regenerate Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={tailorInput}
              onChange={(e) => setTailorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  generateRoutine();
                }
              }}
              placeholder="Tailor further (e.g., 'Need to drop kids at 8:15 AM' or 'Night shift worker')..."
              className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
            <button
              type="button"
              onClick={() => generateRoutine()}
              disabled={isLoading || !telemetry}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Generating Plan...' : 'Regenerate / Tailor Further'}</span>
            </button>
            {stats.doneCount > 0 && (
              <button
                type="button"
                onClick={onResetCompleted}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Done</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500">Quick Constraints:</span>
            {TAILOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTailorInput(preset);
                  generateRoutine(preset);
                }}
                disabled={isLoading}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>

          {isStale && !isLoading && (
            <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-900">
              <span>
                Your city or household profile changed since this routine was generated.
              </span>
              <button
                type="button"
                onClick={() => generateRoutine()}
                className="font-semibold underline hover:no-underline cursor-pointer whitespace-nowrap"
              >
                Refresh Schedule Now
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => generateRoutine()}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 bg-white border border-slate-200 rounded-xl p-5" />
          ))}
        </div>
      )}

      {/* Routine Cards */}
      {!isLoading && plan && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan.items.map((item) => {
            const isDone = completedIds.includes(item.id);
            const priorityTone =
              item.priority === 'Critical'
                ? 'text-rose-700 bg-rose-50 border-rose-200'
                : item.priority === 'Recommended'
                ? 'text-teal-800 bg-teal-50 border-teal-200'
                : 'text-slate-600 bg-slate-100 border-slate-200';

            return (
              <article
                key={item.id}
                className={`bg-white border rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isDone ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Metadata Row (Unboxed clean text + subtle priority tag) */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">{item.phase}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3 h-3" />
                        {item.timeRange}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-semibold border rounded-md ${priorityTone}`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <h3
                    className={`mt-2.5 text-base font-semibold ${
                      isDone ? 'line-through text-slate-500' : 'text-slate-900'
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {item.action}
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Why This Matters Impact Box */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-teal-700" />
                        Why This Matters
                      </span>
                      <span className="font-mono tabular-nums text-teal-800">
                        -{item.pm25SavedUg} µg PM2.5 · -{item.co2SavedKg} kg CO₂
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {item.whyThisMatters}
                    </p>
                  </div>

                  {/* Interactive Mark Done Button */}
                  <button
                    type="button"
                    onClick={() => onToggleComplete(item.id)}
                    aria-pressed={isDone}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      isDone
                        ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isDone
                          ? 'bg-white text-emerald-700 border-white'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {isDone && <Check className="w-3 h-3" />}
                    </span>
                    <span>{isDone ? 'Completed · Exposure Saved' : 'Mark Done'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
