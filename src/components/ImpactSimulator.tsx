import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Flame,
  Leaf,
  Share2,
  Shield,
  Sparkles,
  Train,
} from 'lucide-react';
import type {
  AirQualityTelemetry,
  HabitSwapState,
  HouseholdProfile,
} from '../types';
import { streamImpactSummary } from '../services/api';
import { getAqiSeverity } from '../utils/airQuality';

interface ImpactSimulatorProps {
  telemetry: AirQualityTelemetry | null;
  profile: HouseholdProfile;
  swaps: HabitSwapState;
  onChangeSwaps: (next: HabitSwapState) => void;
  onCopyBrief: (briefText: string) => void;
}

export const ImpactSimulator: React.FC<ImpactSimulatorProps> = ({
  telemetry,
  profile,
  swaps,
  onChangeSwaps,
  onCopyBrief,
}) => {
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedLocal, setCopiedLocal] = useState(false);

  const pm25Ambient = telemetry?.current.pm25 ?? 85;

  const metrics = useMemo(() => {
    // 1. Personal PM2.5 Dose Prevented (µg/day)
    // Adult breathes ~15 m3/day; outdoor commute ~1.8 m3/day at elevated roadside PM2.5 (1.6x ambient)
    const commutePrevented = swaps.commuteSwap
      ? Math.round((swaps.commuteKmPerDay / 12) * pm25Ambient * 0.65)
      : 0;
    const cookingPrevented = swaps.cookingSwap ? Math.round(28 + pm25Ambient * 0.25) : 0;
    const wastePrevented = swaps.wasteSwap ? Math.round(18 + pm25Ambient * 0.12) : 0;
    const maskPrevented = swaps.maskSwap ? Math.round(pm25Ambient * 1.9 * 0.88) : 0;

    const pm25DosePreventedUg =
      commutePrevented + cookingPrevented + wastePrevented + maskPrevented;

    // 2. Community Emissions Reduced (kg CO2e/month)
    const commuteCo2Month = swaps.commuteSwap
      ? Math.round(swaps.commuteKmPerDay * 0.145 * 24 * 10) / 10
      : 0;
    const cookingCo2Month = swaps.cookingSwap ? 16.5 : 0;
    const wasteCo2Month = swaps.wasteSwap ? 24.0 : 0;
    const maskCo2Month = swaps.maskSwap ? 1.8 : 0; // avoided single-use disposable waste/health burden proxy

    const co2ReducedKgMonth =
      Math.round((commuteCo2Month + cookingCo2Month + wasteCo2Month + maskCo2Month) * 10) / 10;

    // 3. Equivalent Mature Trees Planted (1 mature urban tree ~21.7 kg CO2/year)
    const treesEquivalent = Math.round(((co2ReducedKgMonth * 12) / 21.7) * 10) / 10;

    return {
      pm25DosePreventedUg,
      co2ReducedKgMonth,
      treesEquivalent,
      breakdown: [
        { label: 'Commute Swap', ug: commutePrevented, co2: commuteCo2Month },
        { label: 'Clean Cooking', ug: cookingPrevented, co2: cookingCo2Month },
        { label: 'Zero Burning / Waste', ug: wastePrevented, co2: wasteCo2Month },
        { label: 'N95 Respirator', ug: maskPrevented, co2: maskCo2Month },
      ],
    };
  }, [swaps, pm25Ambient]);

  const familyBriefText = useMemo(() => {
    const cityName = telemetry?.city.name ?? 'Your City';
    const aqi = telemetry?.current.usAqi ?? 150;
    const severity = getAqiSeverity(aqi);
    const safeWin = telemetry?.safestWindow.label ?? '13:00 – 16:00';
    const peakWin = telemetry?.peakSmogWindow.label ?? '06:00 – 09:00';
    const pm25 = telemetry?.current.pm25 ?? 55;

    const actions: string[] = [];
    if (swaps.maskSwap || aqi > 150) {
      actions.push('1. Wear a snug N95/FFP2 respirator outdoors—avoid loose cloth masks.');
    } else {
      actions.push('1. Plan outdoor errands strictly inside the cleanest midday window.');
    }
    if (swaps.cookingSwap || profile.homeSetup.includes('gas_stove')) {
      actions.push('2. Run kitchen exhaust 3 min before cooking & keep pot lids closed.');
    } else {
      actions.push('2. Keep windows sealed during peak smog hours and wet-mop floors.');
    }
    if (swaps.commuteSwap) {
      actions.push('3. Take Metro/EV/Carpool today to skip roadside exhaust & cut emissions.');
    } else {
      actions.push('3. Switch car AC to recirculation mode & avoid idling at traffic lights.');
    }

    return [
      `VayuShield Daily Air Brief — ${cityName}`,
      `Live US AQI: ${aqi} (${severity.label}) · PM2.5: ${pm25} µg/m³`,
      `Safest Outdoor Window: ${safeWin}`,
      `Peak Smog Alert Hours: ${peakWin}`,
      ``,
      `Top 3 Family Actions Today:`,
      ...actions,
      ``,
      `Our Swaps Save: ${metrics.pm25DosePreventedUg} µg PM2.5/day & ${metrics.co2ReducedKgMonth} kg CO2e/mo`,
    ].join('\n');
  }, [telemetry, swaps, profile, metrics]);

  const handleExplainImpact = async () => {
    if (!telemetry) return;
    setIsStreaming(true);
    setAiError(null);
    setAiSummary('');
    try {
      await streamImpactSummary(
        {
          telemetry,
          profile,
          swaps,
          metrics: {
            pm25DosePreventedUg: metrics.pm25DosePreventedUg,
            co2ReducedKgMonth: metrics.co2ReducedKgMonth,
            treesEquivalent: metrics.treesEquivalent,
          },
        },
        (chunk) => setAiSummary((prev) => prev + chunk)
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to stream AI impact explanation.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopyBrief = () => {
    onCopyBrief(familyBriefText);
    setCopiedLocal(true);
    setTimeout(() => setCopiedLocal(false), 2200);
  };

  const maxUg = Math.max(100, ...metrics.breakdown.map((b) => b.ug));

  return (
    <div className="space-y-6">
      {/* Live Impact Counter Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="text-xs font-medium text-teal-700">
              Sustainable Alternatives & &ldquo;The Why&rdquo; Impact Engine
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Daily Habit Swap Simulator
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Toggle clean-air habits below to quantify personal lung dose avoided and monthly community carbon saved.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyBrief}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedLocal ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLocal ? 'Copied Family Brief!' : 'Copy Family Smog Brief'}</span>
          </button>
        </div>

        {/* 3 Core Live Impact Counters */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500">Personal PM2.5 Dose Prevented</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-mono font-bold text-teal-700 tabular-nums">
                {metrics.pm25DosePreventedUg}
              </span>
              <span className="text-xs font-mono text-slate-500">µg / day</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500">Community Emissions Reduced</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-mono font-bold text-emerald-700 tabular-nums">
                {metrics.co2ReducedKgMonth}
              </span>
              <span className="text-xs font-mono text-slate-500">kg CO₂e / month</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500">Equivalent Trees Planted</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-3xl font-mono font-bold text-slate-900 tabular-nums">
                {metrics.treesEquivalent}
              </span>
              <span className="text-xs font-mono text-slate-500">mature trees / yr</span>
            </div>
          </div>
        </div>
      </section>

      {/* Swap Toggles + Proportional Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            01. Toggle Everyday Habit Swaps
          </h3>

          {/* Swap 1: Commute */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-700 shrink-0 mt-0.5">
                  <Train className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Daily Commute: Petrol Car / Bike → Metro / EV / Carpool
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cuts tailpipe NOx/PM2.5 emissions and removes you from bumper-to-bumper exhaust plumes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={swaps.commuteSwap}
                onClick={() =>
                  onChangeSwaps({ ...swaps, commuteSwap: !swaps.commuteSwap })
                }
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 cursor-pointer ${
                  swaps.commuteSwap
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {swaps.commuteSwap ? 'Swapped' : 'Enable Swap'}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">Daily Round-Trip Distance</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {swaps.commuteKmPerDay} km/day
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={45}
                value={swaps.commuteKmPerDay}
                onChange={(e) =>
                  onChangeSwaps({ ...swaps, commuteKmPerDay: Number(e.target.value) })
                }
                aria-label="Daily round-trip commute distance in kilometers"
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>
          </div>

          {/* Swap 2: Cooking */}
          <div className="p-4 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 shrink-0 mt-0.5">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Cooking & Heating: Open Frying / Gas → Exhaust Hood + Induction / Lid
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prevents indoor NO₂ and aerosolized cooking-oil PM2.5 spikes that linger for hours.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={swaps.cookingSwap}
              onClick={() =>
                onChangeSwaps({ ...swaps, cookingSwap: !swaps.cookingSwap })
              }
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 cursor-pointer ${
                swaps.cookingSwap
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {swaps.cookingSwap ? 'Swapped' : 'Enable Swap'}
            </button>
          </div>

          {/* Swap 3: Waste & Festive */}
          <div className="p-4 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 shrink-0 mt-0.5">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Waste & Festive Habits: Leaf Burning / Firecrackers → Composting & LEDs
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Eliminates toxic heavy-metal smoke and neighborhood black carbon plumes during winter inversions.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={swaps.wasteSwap}
              onClick={() => onChangeSwaps({ ...swaps, wasteSwap: !swaps.wasteSwap })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 cursor-pointer ${
                swaps.wasteSwap
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {swaps.wasteSwap ? 'Swapped' : 'Enable Swap'}
            </button>
          </div>

          {/* Swap 4: Masking */}
          <div className="p-4 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Masking: Cloth Mask → Certified N95 / FFP2 Respirator
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Electrostatic melt-blown filtration captures &ge;95% of 0.3–2.5 µm soot vs ~15% for loose cloth.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={swaps.maskSwap}
              onClick={() => onChangeSwaps({ ...swaps, maskSwap: !swaps.maskSwap })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 cursor-pointer ${
                swaps.maskSwap
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {swaps.maskSwap ? 'Swapped' : 'Enable Swap'}
            </button>
          </div>
        </section>

        {/* Right Column: Proportional Breakdown + Gemini Streaming Why + Brief Preview */}
        <div className="lg:col-span-5 space-y-5">
          {/* Breakdown Bars */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              02. Dose Prevented by Swap (µg PM2.5/day)
            </h3>
            <div className="space-y-3">
              {metrics.breakdown.map((row) => {
                const widthPct = Math.round((row.ug / maxUg) * 100);
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700">{row.label}</span>
                      <span className="font-mono tabular-nums text-slate-900 font-semibold">
                        {row.ug} µg · {row.co2} kg CO₂/mo
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-700 rounded-full transition-all duration-300"
                        style={{ width: `${row.ug > 0 ? Math.max(4, widthPct) : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Gemini Streaming "The Why" Explanation */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  03. Gemini AI Impact Breakdown
                </h3>
              </div>
              <button
                type="button"
                onClick={handleExplainImpact}
                disabled={isStreaming || !telemetry}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {isStreaming ? 'Explaining...' : aiSummary ? 'Refresh Analysis' : 'Explain My Impact'}
              </button>
            </div>

            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {aiSummary ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {aiSummary}
              </p>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Click &ldquo;Explain My Impact&rdquo; to stream a personalized Gemini explanation of how these exact swaps protect your household&apos;s lungs in {telemetry?.city.name ?? 'your city'} today.
              </p>
            )}
          </section>

          {/* Family Smog Brief Preview */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  WhatsApp / SMS Family Brief Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCopyBrief}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                {copiedLocal ? 'Copied!' : 'Copy Text'}
              </button>
            </div>
            <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-sans whitespace-pre-wrap leading-relaxed">
              {familyBriefText}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
};
