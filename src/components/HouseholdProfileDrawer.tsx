import React from 'react';
import { Check, Home, ShieldAlert, SlidersHorizontal, Train, X } from 'lucide-react';
import type {
  CommuteMode,
  HomeSetupId,
  HouseholdProfile,
  SensitivityProfileId,
} from '../types';
import {
  COMMUTE_LABELS,
  HOME_SETUP_LABELS,
  SENSITIVITY_LABELS,
  calculateRiskMultiplier,
} from '../utils/airQuality';

interface HouseholdProfileDrawerProps {
  profile: HouseholdProfile;
  onChange: (next: HouseholdProfile) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApplyToRoutine?: () => void;
}

export const HouseholdProfileDrawer: React.FC<HouseholdProfileDrawerProps> = ({
  profile,
  onChange,
  isExpanded,
  onToggleExpand,
  onApplyToRoutine,
}) => {
  const risk = calculateRiskMultiplier(profile);

  const toggleSensitivity = (id: SensitivityProfileId) => {
    const exists = profile.sensitivities.includes(id);
    if (exists && profile.sensitivities.length === 1) {
      return; // Always maintain at least one active profile
    }
    const next = exists
      ? profile.sensitivities.filter((s) => s !== id)
      : [...profile.sensitivities, id];
    onChange({ ...profile, sensitivities: next });
  };

  const setCommute = (mode: CommuteMode) => {
    onChange({ ...profile, commuteMode: mode });
  };

  const toggleHomeSetup = (id: HomeSetupId) => {
    const exists = profile.homeSetup.includes(id);
    const next = exists
      ? profile.homeSetup.filter((h) => h !== id)
      : [...profile.homeSetup, id];
    onChange({ ...profile, homeSetup: next });
  };

  const tierTone =
    risk.tier === 'Critical Care'
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : risk.tier === 'High Sensitivity'
      ? 'text-orange-700 bg-orange-50 border-orange-200'
      : risk.tier === 'Elevated'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  return (
    <section
      aria-label="Household & Sensitivity Profile Engine"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Compact Persistent Profile Strip */}
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-semibold text-slate-900">
                Household Sensitivity Profile
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-md tabular-nums ${tierTone}`}
              >
                <ShieldAlert className="w-3 h-3" />
                {risk.multiplier.toFixed(2)}× Risk Multiplier · {risk.tier}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {profile.sensitivities.map((s) => SENSITIVITY_LABELS[s].label).join(' · ')}
              {' / '}
              {COMMUTE_LABELS[profile.commuteMode].label}
              {profile.homeSetup.length > 0
                ? ` / ${profile.homeSetup.map((h) => HOME_SETUP_LABELS[h].label).join(', ')}`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Done Editing</span>
              </>
            ) : (
              <span>Customize Household</span>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Configuration Matrix */}
      {isExpanded && (
        <div className="px-4 pb-5 pt-4 border-t border-slate-100 bg-slate-50/60 space-y-5">
          {/* 1. Sensitivity Profiles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-700">
                01. Household Sensitivity Groups (Multi-Select)
              </h3>
              <span className="text-xs text-slate-500">
                Recalculates exposure thresholds & AI advisories immediately
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(Object.keys(SENSITIVITY_LABELS) as SensitivityProfileId[]).map((id) => {
                const active = profile.sensitivities.includes(id);
                const meta = SENSITIVITY_LABELS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleSensitivity(id)}
                    aria-pressed={active}
                    className={`text-left p-2.5 rounded-lg border transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                      active
                        ? 'bg-white border-teal-600 ring-1 ring-teal-600/20 text-slate-900'
                        : 'bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span>{meta.label}</span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {meta.weight.toFixed(2)}×
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {meta.note}
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                        active
                          ? 'bg-teal-700 border-teal-700 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Commute Mode + 3. Home Setup */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Train className="w-3.5 h-3.5 text-slate-500" />
                <span>02. Primary Daily Commute Mode</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(COMMUTE_LABELS) as CommuteMode[]).map((mode) => {
                  const active = profile.commuteMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCommute(mode)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {COMMUTE_LABELS[mode].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-slate-500" />
                <span>03. Home Ventilation & Appliance Setup</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(HOME_SETUP_LABELS) as HomeSetupId[]).map((setupId) => {
                  const active = profile.homeSetup.includes(setupId);
                  return (
                    <button
                      key={setupId}
                      type="button"
                      onClick={() => toggleHomeSetup(setupId)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      <span>{HOME_SETUP_LABELS[setupId].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {onApplyToRoutine && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 gap-3 flex-wrap">
              <p className="text-xs text-slate-600">
                All AI routines, indoor air estimates, and Vayu chat responses automatically sync to this profile.
              </p>
              <button
                type="button"
                onClick={onApplyToRoutine}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Open Updated AI Daily Routine
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
