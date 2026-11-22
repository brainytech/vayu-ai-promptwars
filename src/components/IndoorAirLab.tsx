import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Fan,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react';
import type {
  AirQualityTelemetry,
  BudgetTier,
  HouseholdProfile,
  IaqHack,
  RoomCategory,
} from '../types';
import { STATIC_IAQ_HACKS } from '../data/iaqHacks';
import { fetchAiIaqHacks } from '../services/api';
import { estimateIndoorAqi } from '../utils/airQuality';

interface IndoorAirLabProps {
  telemetry: AirQualityTelemetry | null;
  profile: HouseholdProfile;
}

const ROOMS: Array<RoomCategory | 'All'> = ['All', 'Kitchen', 'Bedroom', 'Living Room', 'Home Office'];
const BUDGETS: Array<BudgetTier | 'All'> = ['All', 'Zero-Cost Hacks', 'Low-Cost DIY', 'Smart Tech'];

type FilterGrade = 'merv11' | 'merv13' | 'hepa13';
type FanSpeed = 'low' | 'medium' | 'high';

export const IndoorAirLab: React.FC<IndoorAirLabProps> = ({ telemetry, profile }) => {
  const [roomFilter, setRoomFilter] = useState<RoomCategory | 'All'>('All');
  const [budgetFilter, setBudgetFilter] = useState<BudgetTier | 'All'>('All');
  const [aiHacks, setAiHacks] = useState<IaqHack[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // DIY Corsi-Rosenthal Box / Purifier Estimator State
  const [roomSqFt, setRoomSqFt] = useState(180);
  const [ceilingFt, setCeilingFt] = useState(9.5);
  const [filterGrade, setFilterGrade] = useState<FilterGrade>('merv13');
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>('medium');

  // Ventilation Timer & Outdoor-vs-Indoor Delta State
  const outdoorAqi = telemetry?.current.usAqi ?? 150;
  const baselineIndoorAqi = useMemo(
    () => estimateIndoorAqi(outdoorAqi, profile),
    [outdoorAqi, profile]
  );
  const [indoorAqiOverride, setIndoorAqiOverride] = useState<number | null>(null);
  const effectiveIndoorAqi = indoorAqiOverride ?? baselineIndoorAqi;

  const recommendedMinutes = useMemo(() => {
    const delta = outdoorAqi - effectiveIndoorAqi;
    if (outdoorAqi >= 220) return 0; // Keep sealed during severe smog
    if (delta > 60) return 0; // Much dirtier outside than inside
    if (outdoorAqi <= 75) return 45;
    if (outdoorAqi <= 125) return 20;
    if (delta <= 15) return 12; // Stale indoor air nearly equal to outdoor -> short flush
    return 5;
  }, [outdoorAqi, effectiveIndoorAqi]);

  const [secondsLeft, setSecondsLeft] = useState<number>(Math.max(5, recommendedMinutes || 10) * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (!timerRunning) {
      setSecondsLeft((recommendedMinutes > 0 ? recommendedMinutes : 10) * 60);
    }
  }, [recommendedMinutes, timerRunning]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const crEstimate = useMemo(() => {
    const volumeCuFt = Math.round(roomSqFt * ceilingFt);
    const gradeMultiplier = filterGrade === 'merv11' ? 0.85 : filterGrade === 'merv13' ? 1.0 : 0.78;
    const baseCfm = fanSpeed === 'low' ? 240 : fanSpeed === 'medium' ? 390 : 540;
    const cadrCfm = Math.round(baseCfm * gradeMultiplier);
    const ach = Math.round(((cadrCfm * 60) / Math.max(1, volumeCuFt)) * 10) / 10;
    // Time to 90% particulate drop: t = -ln(0.1)*60 / ACH = 138.15 / ACH
    const minutesTo90Pct = Math.max(6, Math.round(138.15 / Math.max(0.5, ach)));
    const costInr = filterGrade === 'merv11' ? 2100 : filterGrade === 'merv13' ? 3100 : 5800;
    return { volumeCuFt, cadrCfm, ach, minutesTo90Pct, costInr };
  }, [roomSqFt, ceilingFt, filterGrade, fanSpeed]);

  const combinedHacks = useMemo(() => {
    const all = [...aiHacks, ...STATIC_IAQ_HACKS];
    return all.filter((hack) => {
      const roomMatch = roomFilter === 'All' || hack.room === roomFilter;
      const budgetMatch = budgetFilter === 'All' || hack.budget === budgetFilter;
      return roomMatch && budgetMatch;
    });
  }, [aiHacks, roomFilter, budgetFilter]);

  const handleGenerateAiHacks = async () => {
    if (!telemetry) return;
    setIsGenerating(true);
    setAiError(null);
    try {
      const hacks = await fetchAiIaqHacks({
        telemetry,
        profile,
        roomFilter,
        budgetFilter,
      });
      setAiHacks(hacks);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI indoor hacks.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatMmSs = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Interactive Lab Calculators Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. DIY Corsi-Rosenthal Box / Purifier Estimator */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Fan className="w-4 h-4 text-teal-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  DIY Corsi-Rosenthal Purifier Estimator
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">CADR & ACH Lab</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Size a 4-filter DIY box fan purifier or HEPA unit for your bedroom or study.
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Room Floor Area</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {roomSqFt} sq ft
                  </span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={600}
                  step={10}
                  value={roomSqFt}
                  onChange={(e) => setRoomSqFt(Number(e.target.value))}
                  aria-label="Room floor area in square feet"
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Ceiling Height</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {ceilingFt} ft
                  </span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={13}
                  step={0.5}
                  value={ceilingFt}
                  onChange={(e) => setCeilingFt(Number(e.target.value))}
                  aria-label="Ceiling height in feet"
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-600 mb-1.5">Filter Grade</div>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'merv11', label: 'MERV-11' },
                        { id: 'merv13', label: 'MERV-13' },
                        { id: 'hepa13', label: 'HEPA H13' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilterGrade(opt.id)}
                        className={`py-1.5 px-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          filterGrade === opt.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-600 mb-1.5">Fan Speed</div>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                    {(['low', 'medium', 'high'] as const).map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setFanSpeed(sp)}
                        className={`py-1.5 px-1 text-[11px] font-medium rounded-md capitalize transition-colors cursor-pointer ${
                          fanSpeed === sp
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            <div>
              <div className="text-[11px] text-slate-500">Est. CADR</div>
              <div className="text-base font-mono font-bold text-slate-900 tabular-nums">
                {crEstimate.cadrCfm} CFM
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Air Changes/Hr</div>
              <div className="text-base font-mono font-bold text-teal-700 tabular-nums">
                {crEstimate.ach} ACH
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">90% PM2.5 Drop</div>
              <div className="text-base font-mono font-bold text-slate-900 tabular-nums">
                {crEstimate.minutesTo90Pct} min
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">DIY Material Est.</div>
              <div className="text-base font-mono font-bold text-slate-900 tabular-nums">
                ₹{crEstimate.costInr.toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Ventilation Timer & Outdoor vs Indoor Delta */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-teal-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Smart Window Ventilation Timer
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">Outdoor vs Indoor Δ</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Avoid guessing when to crack windows—calculated from {telemetry?.city.name ?? 'city'} live AQI and your indoor setup.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Live Outdoor US AQI</div>
                <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                  {outdoorAqi}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500">Est. Indoor US AQI</div>
                <div className="text-2xl font-mono font-bold text-teal-700 tabular-nums mt-0.5">
                  {effectiveIndoorAqi}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">
                  Adjust if you have an indoor monitor reading
                </span>
                <button
                  type="button"
                  onClick={() => setIndoorAqiOverride(null)}
                  className="text-teal-700 hover:underline cursor-pointer text-[11px] font-medium"
                >
                  Auto-Estimate ({baselineIndoorAqi})
                </button>
              </div>
              <input
                type="range"
                min={10}
                max={350}
                value={effectiveIndoorAqi}
                onChange={(e) => setIndoorAqiOverride(Number(e.target.value))}
                aria-label="Estimated indoor US AQI"
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>

            <div
              className={`mt-3 p-3 rounded-lg border text-xs ${
                recommendedMinutes === 0
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {recommendedMinutes === 0 ? (
                <span>
                  <strong>Keep Windows Sealed:</strong> Outdoor AQI ({outdoorAqi}) exceeds indoor air ({effectiveIndoorAqi}) by {Math.max(0, outdoorAqi - effectiveIndoorAqi)} points. Wait for the {telemetry?.safestWindow.label ?? 'midday'} window or flush briefly only with exhaust running.
                </span>
              ) : (
                <span>
                  <strong>Safe Flush Recommendation:</strong> Crack cross-windows for{' '}
                  <strong className="font-mono">{recommendedMinutes} minutes</strong> to purge indoor CO₂ without raising PM2.5 significantly.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {formatMmSs(secondsLeft)}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (secondsLeft === 0) {
                    setSecondsLeft((recommendedMinutes > 0 ? recommendedMinutes : 10) * 60);
                  }
                  setTimerRunning((prev) => !prev);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>
                  {timerRunning
                    ? 'Pause Timer'
                    : `Start ${recommendedMinutes > 0 ? recommendedMinutes : 10}-Min Timer`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsLeft((recommendedMinutes > 0 ? recommendedMinutes : 10) * 60);
                }}
                aria-label="Reset ventilation timer"
                className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Room & Budget Filterable IAQ Hack Library */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Room-by-Room Indoor Air Hacks
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter proven interventions by room and budget, or ask Gemini to tailor fresh hacks to your home setup.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateAiHacks}
            disabled={isGenerating || !telemetry}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating Custom Hacks...' : 'AI Generate Room Hacks'}</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {ROOMS.map((room) => (
              <button
                key={room}
                type="button"
                onClick={() => setRoomFilter(room)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  roomFilter === room
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {room}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {BUDGETS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setBudgetFilter(tier)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  budgetFilter === tier
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        {aiError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Hacks Grid */}
        {combinedHacks.length === 0 ? (
          <div className="mt-6 py-10 text-center border border-dashed border-slate-200 rounded-xl">
            <p className="text-sm text-slate-600">
              No hacks match {roomFilter} + {budgetFilter} yet.
            </p>
            <button
              type="button"
              onClick={handleGenerateAiHacks}
              disabled={isGenerating}
              className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              Generate AI Hacks for This Filter
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {combinedHacks.map((hack) => (
              <article
                key={hack.id}
                className="p-4 border border-slate-200 rounded-xl bg-slate-50/40 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {hack.room} · {hack.budget}
                      {hack.isAiGenerated ? ' · Tailored by Gemini AI' : ''}
                    </span>
                    <span className="font-mono font-semibold text-teal-700 tabular-nums">
                      -{hack.reductionPercent}% particles
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold text-slate-900">
                    {hack.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{hack.steps}</p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-semibold text-slate-700">
                    Direct Impact Explanation
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {hack.directImpact}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
