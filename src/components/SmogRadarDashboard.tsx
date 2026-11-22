import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Info,
  ShieldCheck,
  Wind,
} from 'lucide-react';
import type {
  AirQualityTelemetry,
  HouseholdProfile,
  PollutantKey,
} from '../types';
import {
  POLLUTANT_DEFINITIONS,
  calculateRiskMultiplier,
  getAqiSeverity,
  getPersonalizedAdvisory,
} from '../utils/airQuality';

interface SmogRadarDashboardProps {
  telemetry: AirQualityTelemetry | null;
  profile: HouseholdProfile;
  isLoading: boolean;
  onRetry: () => void;
  onAskVayuQuestion: (question: string) => void;
}

export const SmogRadarDashboard: React.FC<SmogRadarDashboardProps> = ({
  telemetry,
  profile,
  isLoading,
  onRetry,
  onAskVayuQuestion,
}) => {
  const [selectedPollutant, setSelectedPollutant] = useState<PollutantKey>('pm25');
  const [chartMetric, setChartMetric] = useState<'usAqi' | 'pm25'>('usAqi');
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);

  const risk = useMemo(() => calculateRiskMultiplier(profile), [profile]);

  if (isLoading && !telemetry) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-52 bg-white border border-slate-200 rounded-xl p-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (!telemetry) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600 mb-3">
          Unable to load air quality telemetry right now.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
        >
          Retry Telemetry Sync
        </button>
      </div>
    );
  }

  const severity = getAqiSeverity(telemetry.current.usAqi);
  const advisory = getPersonalizedAdvisory(telemetry.current.usAqi, profile);
  const effectiveAqi = Math.round(telemetry.current.usAqi * risk.multiplier);
  const effectiveSeverity = getAqiSeverity(effectiveAqi);
  const activePollutantDef = POLLUTANT_DEFINITIONS[selectedPollutant];
  const activePollutantValue = telemetry.current[selectedPollutant];

  const pollutantList: Array<{ key: PollutantKey; value: number }> = [
    { key: 'pm25', value: telemetry.current.pm25 },
    { key: 'pm10', value: telemetry.current.pm10 },
    { key: 'no2', value: telemetry.current.no2 },
    { key: 'o3', value: telemetry.current.o3 },
    { key: 'so2', value: telemetry.current.so2 },
    { key: 'co', value: telemetry.current.co },
  ];

  // Chart calculations (SVG 760 x 230 viewBox)
  const chartPoints = telemetry.hourly24h;
  const values = chartPoints.map((p) => (chartMetric === 'usAqi' ? p.usAqi : p.pm25));
  const maxVal = Math.max(
    chartMetric === 'usAqi' ? 120 : 40,
    ...values
  );
  const minVal = 0;

  const svgWidth = 760;
  const svgHeight = 220;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 34;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const getX = (idx: number) =>
    padLeft + (chartPoints.length <= 1 ? 0 : (idx / (chartPoints.length - 1)) * plotW);
  const getY = (val: number) =>
    padTop + plotH - ((val - minVal) / (maxVal - minVal || 1)) * plotH;

  const linePath = chartPoints
    .map((p, idx) => {
      const x = getX(idx);
      const y = getY(chartMetric === 'usAqi' ? p.usAqi : p.pm25);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPath =
    chartPoints.length > 0
      ? `${linePath} L ${getX(chartPoints.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${getX(
          0
        ).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const safeStartIdx = chartPoints.findIndex(
    (p) => p.hourLabel === telemetry.safestWindow.startTime
  );
  const safeEndIdx = chartPoints.findIndex(
    (p) => p.hourLabel === telemetry.safestWindow.endTime
  );
  const peakStartIdx = chartPoints.findIndex(
    (p) => p.hourLabel === telemetry.peakSmogWindow.startTime
  );
  const peakEndIdx = chartPoints.findIndex(
    (p) => p.hourLabel === telemetry.peakSmogWindow.endTime
  );

  const activePoint =
    hoveredHourIndex !== null && chartPoints[hoveredHourIndex]
      ? chartPoints[hoveredHourIndex]
      : null;

  return (
    <div className="space-y-6">
      {telemetry.isFallback && (
        <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Live Open-Meteo station unreachable right now ({telemetry.fallbackReason}). Displaying seasonal advisory baseline for {telemetry.city.name}.
            </span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold text-amber-900 underline hover:no-underline cursor-pointer"
          >
            Retry Live Fetch
          </button>
        </div>
      )}

      {/* Hero Real-Time AQI Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Primary AQI Figure & Location */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 pb-5 lg:pb-0 lg:pr-6 border-b lg:border-b-0 lg:border-r border-slate-200">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {telemetry.city.name}
                  {telemetry.city.admin1 ? `, ${telemetry.city.admin1}` : ''} · {telemetry.city.country}
                </span>
                <span className="font-mono tabular-nums">
                  {telemetry.city.latitude.toFixed(2)}°N, {telemetry.city.longitude.toFixed(2)}°E
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-4 flex-wrap">
                <div className="font-mono font-bold text-6xl tracking-tight text-slate-900 tabular-nums">
                  {telemetry.current.usAqi}
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">US AQI Scale</div>
                  <div
                    className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border rounded-md ${severity.bgTint} ${severity.textColor} ${severity.borderColor}`}
                  >
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: severity.barColor }}
                    />
                    <span>{severity.label}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
              <div>
                <div className="text-[11px] text-slate-500">European AQI</div>
                <div className="text-base font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {telemetry.current.europeanAqi}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Dominant</div>
                <div className="text-base font-mono font-semibold text-slate-900 mt-0.5">
                  {telemetry.dominantPollutant.label}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Profile Risk AQI</div>
                <div className={`text-base font-mono font-semibold tabular-nums mt-0.5 ${effectiveSeverity.textColor}`}>
                  {effectiveAqi}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Sensory Summary + Household Advisory */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <h2 className="text-xs font-semibold text-slate-500">
                  What the air feels like right now
                </h2>
                <p className="mt-1.5 text-base font-medium text-slate-900 leading-relaxed">
                  {severity.feelsLike}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-800">
                  <span>Household Advisory ({risk.multiplier.toFixed(2)}× Sensitivity)</span>
                  <span className="font-mono text-slate-500">
                    {telemetry.dominantPollutant.label}: {telemetry.dominantPollutant.value}{' '}
                    {telemetry.dominantPollutant.unit} ({telemetry.dominantPollutant.ratioToLimit}× WHO limit)
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed">{advisory}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    Safest window: <strong className="text-slate-800 font-mono">{telemetry.safestWindow.label}</strong>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-700" />
                  <span>
                    Peak smog: <strong className="text-slate-800 font-mono">{telemetry.peakSmogWindow.label}</strong>
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onAskVayuQuestion(
                    `With ${telemetry.city.name} at US AQI ${telemetry.current.usAqi} (PM2.5 ${telemetry.current.pm25} µg/m³), what specific precautions should my household take today?`
                  )
                }
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                Ask Vayu about today&apos;s air →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Pollutant Breakdown Grid + Inspector */}
      <section aria-label="Live Pollutant Breakdown">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Live Pollutant Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Click any pollutant card to inspect its health pathway and WHO safe-limit ratio
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Updated {telemetry.current.time.replace('T', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {pollutantList.map(({ key, value }) => {
            const def = POLLUTANT_DEFINITIONS[key];
            const ratio = value / def.whoSafeLimit;
            const pctClamped = Math.min(100, Math.round(ratio * 100));
            const isSelected = selectedPollutant === key;
            const barColor =
              ratio <= 0.75
                ? 'bg-emerald-600'
                : ratio <= 1.25
                ? 'bg-amber-500'
                : ratio <= 2.5
                ? 'bg-orange-600'
                : 'bg-rose-600';

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPollutant(key)}
                aria-pressed={isSelected}
                className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isSelected
                    ? 'bg-white border-teal-700 ring-1 ring-teal-700/20'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-900">{def.symbol}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {ratio.toFixed(1)}× WHO
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                    {key === 'co' ? Math.round(value) : value.toFixed(1)}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{def.unit}</span>
                </div>
                <div className="mt-2.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.max(4, pctClamped)}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[11px] text-slate-500 truncate">{def.name}</div>
              </button>
            );
          })}
        </div>

        {/* Click-to-Inspect Pollutant Health Impact Panel */}
        <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <Info className="w-3.5 h-3.5 text-teal-700" />
              <span>
                {activePollutantDef.symbol} · {activePollutantDef.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Current:{' '}
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {activePollutantValue} {activePollutantDef.unit}
              </span>{' '}
              · {activePollutantDef.limitBasis}
            </p>
            <p className="text-xs text-slate-600 mt-2">
              <strong className="text-slate-800">Primary Sources:</strong> {activePollutantDef.sources}
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Physiological Health Impact</div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {activePollutantDef.healthImpact}
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Immediate Protection Tip</div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {activePollutantDef.protectionTip}
            </p>
          </div>
        </div>
      </section>

      {/* 24-Hour Smog Forecast & Safe Window Finder */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              24-Hour Smog Forecast & Safe Window Finder
            </h2>
            <p className="text-xs text-slate-500">
              Hover or tap any hour on the curve to inspect hourly dispersion trends
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setChartMetric('usAqi')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                chartMetric === 'usAqi'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              US AQI
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('pm25')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                chartMetric === 'pm25'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PM2.5 (µg/m³)
            </button>
          </div>
        </div>

        {/* Highlight Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-emerald-900">
                Safest Outdoor Window
              </div>
              <div className="text-sm font-mono font-bold text-emerald-800 mt-0.5 tabular-nums">
                {telemetry.safestWindow.label}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-emerald-700">Window Avg</div>
              <div className="text-sm font-mono font-semibold text-emerald-900 tabular-nums">
                AQI {telemetry.safestWindow.avgAqi} · {telemetry.safestWindow.avgPm25} µg/m³
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-rose-900">
                Peak Smog Alert Hours
              </div>
              <div className="text-sm font-mono font-bold text-rose-800 mt-0.5 tabular-nums">
                {telemetry.peakSmogWindow.label}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-rose-700">Peak Avg</div>
              <div className="text-sm font-mono font-semibold text-rose-900 tabular-nums">
                AQI {telemetry.peakSmogWindow.avgAqi} · {telemetry.peakSmogWindow.avgPm25} µg/m³
              </div>
            </div>
          </div>
        </div>

        {/* Interactive SVG Chart */}
        <div className="relative w-full overflow-x-auto">
          <div className="min-w-[560px]">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-56 select-none"
              role="img"
              aria-label="24-hour air quality forecast chart"
              onMouseLeave={() => setHoveredHourIndex(null)}
            >
              <defs>
                <linearGradient id="vayuAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F766E" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0F766E" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Safest Window Shaded Band */}
              {safeStartIdx >= 0 && safeEndIdx >= safeStartIdx && (
                <rect
                  x={getX(safeStartIdx)}
                  y={padTop}
                  width={Math.max(18, getX(safeEndIdx) - getX(safeStartIdx))}
                  height={plotH}
                  fill="#10B981"
                  fillOpacity="0.14"
                />
              )}

              {/* Peak Smog Shaded Band */}
              {peakStartIdx >= 0 && peakEndIdx >= peakStartIdx && (
                <rect
                  x={getX(peakStartIdx)}
                  y={padTop}
                  width={Math.max(18, getX(peakEndIdx) - getX(peakStartIdx))}
                  height={plotH}
                  fill="#E11D48"
                  fillOpacity="0.11"
                />
              )}

              {/* Horizontal Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padTop + plotH - t * plotH;
                const labelVal = Math.round(minVal + t * (maxVal - minVal));
                return (
                  <g key={t}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {labelVal}
                    </text>
                  </g>
                );
              })}

              {/* Area + Line */}
              {areaPath && <path d={areaPath} fill="url(#vayuAreaGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#0F766E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* X-Axis Ticks every 3 hours */}
              {chartPoints.map((p, idx) => {
                const x = getX(idx);
                const val = chartMetric === 'usAqi' ? p.usAqi : p.pm25;
                const y = getY(val);
                const isHovered = hoveredHourIndex === idx;

                return (
                  <g key={p.time + idx}>
                    {idx % 3 === 0 && (
                      <text
                        x={x}
                        y={svgHeight - 10}
                        textAnchor="middle"
                        className="fill-slate-500 text-[10px] font-mono"
                      >
                        {p.hourLabel}
                      </text>
                    )}

                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5 : 2.5}
                      fill={isHovered ? '#0F766E' : '#FFFFFF'}
                      stroke="#0F766E"
                      strokeWidth="2"
                    />

                    {/* Invisible wide hover target */}
                    <rect
                      x={x - plotW / (chartPoints.length * 2)}
                      y={padTop}
                      width={plotW / chartPoints.length}
                      height={plotH}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoveredHourIndex(idx)}
                      onClick={() => setHoveredHourIndex(idx)}
                    />
                  </g>
                );
              })}

              {/* Crosshair Vertical Line */}
              {hoveredHourIndex !== null && chartPoints[hoveredHourIndex] && (
                <line
                  x1={getX(hoveredHourIndex)}
                  y1={padTop}
                  x2={getX(hoveredHourIndex)}
                  y2={padTop + plotH}
                  stroke="#0F172A"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
          </div>

          {/* Interactive Inspection Bar */}
          <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 text-xs flex-wrap">
            {activePoint ? (
              <div className="flex items-center gap-4 flex-wrap font-mono tabular-nums text-slate-700">
                <span className="font-semibold text-slate-900">
                  Hour {activePoint.hourLabel}
                </span>
                <span>US AQI: {activePoint.usAqi}</span>
                <span>PM2.5: {activePoint.pm25} µg/m³</span>
                <span>NO₂: {activePoint.no2} µg/m³</span>
                <span>O₃: {activePoint.o3} µg/m³</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <Wind className="w-3.5 h-3.5" />
                <span>Hover or tap any point along the 24-hour curve for exact pollutant readings.</span>
              </div>
            )}
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/30 border border-emerald-500/50" />
                <span>Safest Window</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/25 border border-rose-500/40" />
                <span>Peak Smog</span>
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
