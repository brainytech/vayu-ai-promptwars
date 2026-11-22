import type {
  AirQualityTelemetry,
  CityLocation,
  CommuteMode,
  CurrentAirQuality,
  HomeSetupId,
  HouseholdProfile,
  HourlyForecastPoint,
  PollutantKey,
  SensitivityProfileId,
  WindowSummary,
} from '../types';

export const PRESET_CITIES: CityLocation[] = [
  { name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.209 },
  { name: 'Ahmedabad', admin1: 'Gujarat', country: 'India', latitude: 23.0225, longitude: 72.5714 },
  { name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.076, longitude: 72.8777 },
  { name: 'Bengaluru', admin1: 'Karnataka', country: 'India', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Kolkata', admin1: 'West Bengal', country: 'India', latitude: 22.5726, longitude: 88.3639 },
];

export interface AqiSeverityMeta {
  label: string;
  shortLabel: string;
  textColor: string;
  bgTint: string;
  borderColor: string;
  barColor: string;
  badgeBg: string;
  feelsLike: string;
}

export function getAqiSeverity(aqi: number): AqiSeverityMeta {
  if (aqi <= 50) {
    return {
      label: 'Good',
      shortLabel: 'Good',
      textColor: 'text-emerald-700',
      bgTint: 'bg-emerald-50/70',
      borderColor: 'border-emerald-200',
      barColor: '#059669',
      badgeBg: 'bg-emerald-600',
      feelsLike:
        'Crisp, low-particulate air. Deep breathing feels effortless and natural cross-ventilation helps refresh indoor rooms.',
    };
  }
  if (aqi <= 100) {
    return {
      label: 'Moderate',
      shortLabel: 'Moderate',
      textColor: 'text-amber-700',
      bgTint: 'bg-amber-50/70',
      borderColor: 'border-amber-200',
      barColor: '#D97706',
      badgeBg: 'bg-amber-600',
      feelsLike:
        'Light haze in sunlight. Most adults breathe normally, though prolonged roadside exertion can feel slightly dry in the throat.',
    };
  }
  if (aqi <= 150) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'Sensitive Alert',
      textColor: 'text-orange-700',
      bgTint: 'bg-orange-50/70',
      borderColor: 'border-orange-200',
      barColor: '#EA580C',
      badgeBg: 'bg-orange-600',
      feelsLike:
        'Visible urban haze with subtle exhaust sharpness. Children, seniors, and asthmatic lungs notice chest tightness during brisk walks.',
    };
  }
  if (aqi <= 200) {
    return {
      label: 'Unhealthy',
      shortLabel: 'Unhealthy',
      textColor: 'text-red-700',
      bgTint: 'bg-red-50/70',
      borderColor: 'border-red-200',
      barColor: '#DC2626',
      badgeBg: 'bg-red-600',
      feelsLike:
        'Heavy grey smog layer. Expect mild eye irritation, throat scratchiness, and reduced stamina outdoors within 20–30 minutes.',
    };
  }
  if (aqi <= 300) {
    return {
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      textColor: 'text-purple-800',
      bgTint: 'bg-purple-50/75',
      borderColor: 'border-purple-200',
      barColor: '#7E22CE',
      badgeBg: 'bg-purple-700',
      feelsLike:
        'Dense winter smog with faint smoky odor. Unmasked outdoor breathing causes noticeable airway constriction, coughing, and fatigue.',
    };
  }
  return {
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    textColor: 'text-rose-950',
    bgTint: 'bg-rose-100/75',
    borderColor: 'border-rose-300',
    barColor: '#881337',
    badgeBg: 'bg-rose-900',
    feelsLike:
      'Severe toxic smog blanket. Outdoor air feels acrid and heavy; even brief unmasked exposure irritates eyes, sinuses, and airways.',
  };
}

export interface PollutantDefinition {
  key: PollutantKey;
  symbol: string;
  name: string;
  unit: string;
  whoSafeLimit: number;
  limitBasis: string;
  sources: string;
  healthImpact: string;
  protectionTip: string;
}

export const POLLUTANT_DEFINITIONS: Record<PollutantKey, PollutantDefinition> = {
  pm25: {
    key: 'pm25',
    symbol: 'PM2.5',
    name: 'Fine Particulate Matter',
    unit: 'µg/m³',
    whoSafeLimit: 15,
    limitBasis: 'WHO 24h Guideline (15 µg/m³)',
    sources: 'Tailpipe diesel exhaust, biomass burning, construction dust, secondary winter nitrates.',
    healthImpact:
      'Particles under 2.5 microns bypass nasal filters, penetrate deep into lung alveoli, and cross into the bloodstream—driving airway inflammation and cardiovascular strain.',
    protectionTip: 'Use a sealed N95/FFP2 respirator outdoors and run HEPA or MERV-13 filtration indoors.',
  },
  pm10: {
    key: 'pm10',
    symbol: 'PM10',
    name: 'Coarse Particulate Matter',
    unit: 'µg/m³',
    whoSafeLimit: 45,
    limitBasis: 'WHO 24h Guideline (45 µg/m³)',
    sources: 'Road dust resuspension, unpaved shoulders, demolition debris, and windblown ash.',
    healthImpact:
      'Lodges in the upper respiratory tract, triggering sinus congestion, sore throat, eye watering, and asthma flare-ups.',
    protectionTip: 'Wet-mop floors instead of dry sweeping and wear wraparound glasses on windy commutes.',
  },
  no2: {
    key: 'no2',
    symbol: 'NO₂',
    name: 'Nitrogen Dioxide',
    unit: 'µg/m³',
    whoSafeLimit: 25,
    limitBasis: 'WHO 24h Guideline (25 µg/m³)',
    sources: 'Traffic congestion, petrol/diesel combustion engines, and unvented gas cooking stoves.',
    healthImpact:
      'Directly inflames bronchial linings, lowers immunity to respiratory infections, and sensitizes airways to pollen and cold air.',
    protectionTip: 'Avoid jogging beside arterial roads and always run your kitchen exhaust hood while cooking on gas.',
  },
  o3: {
    key: 'o3',
    symbol: 'O₃',
    name: 'Ground-Level Ozone',
    unit: 'µg/m³',
    whoSafeLimit: 100,
    limitBasis: 'WHO 8h Guideline (100 µg/m³)',
    sources: 'Photochemical reaction of vehicle NOx and volatile organic compounds in afternoon sunlight.',
    healthImpact:
      'Chemically irritates lung tissue like a mild sunburn inside airways, causing pain on deep inhalation and reduced lung capacity.',
    protectionTip: 'Keep intense outdoor training to lower-UV windows and avoid high-traffic afternoon corridors.',
  },
  so2: {
    key: 'so2',
    symbol: 'SO₂',
    name: 'Sulfur Dioxide',
    unit: 'µg/m³',
    whoSafeLimit: 40,
    limitBasis: 'WHO 24h Guideline (40 µg/m³)',
    sources: 'Coal power plants, industrial boilers, brick kilns, and high-sulfur fuels.',
    healthImpact:
      'Rapidly triggers bronchospasm in asthmatics within minutes of exposure and combines with moisture to form fine sulfate aerosols.',
    protectionTip: 'Keep rescue inhalers accessible when SO₂ spikes and seal downwind windows.',
  },
  co: {
    key: 'co',
    symbol: 'CO',
    name: 'Carbon Monoxide',
    unit: 'µg/m³',
    whoSafeLimit: 4000,
    limitBasis: 'WHO 24h Guideline (4,000 µg/m³)',
    sources: 'Idling vehicles in traffic jams, basement garages, and incomplete biomass/charcoal burning.',
    healthImpact:
      'Binds to hemoglobin 200× more strongly than oxygen, starving brain and heart muscles of oxygen—causing headaches and fatigue.',
    protectionTip: 'Switch car AC to recirculation mode in traffic jams and never burn coal/charcoal indoors.',
  },
};

export const SENSITIVITY_LABELS: Record<SensitivityProfileId, { label: string; weight: number; note: string }> = {
  general_adult: { label: 'General Adult', weight: 1.0, note: 'Standard baseline exposure threshold' },
  child_infant: { label: 'Child / Infant', weight: 1.35, note: 'Higher breathing rate per kg body weight' },
  elderly: { label: 'Elderly (65+)', weight: 1.3, note: 'Elevated cardiopulmonary sensitivity' },
  asthma_respiratory: { label: 'Asthma / Respiratory', weight: 1.45, note: 'Hyper-reactive bronchial airways' },
  pregnant: { label: 'Pregnant', weight: 1.25, note: 'Protecting maternal & fetal oxygen transport' },
  outdoor_athlete: { label: 'Outdoor Athlete / Commuter', weight: 1.2, note: '3–5× minute ventilation during exertion' },
};

export const COMMUTE_LABELS: Record<CommuteMode, { label: string; exposureFactor: number; emissionKgPer10Km: number }> = {
  two_wheeler: { label: 'Two-Wheeler', exposureFactor: 1.35, emissionKgPer10Km: 0.72 },
  car: { label: 'Car', exposureFactor: 0.95, emissionKgPer10Km: 1.92 },
  public_transit: { label: 'Public Transit / Metro', exposureFactor: 0.75, emissionKgPer10Km: 0.28 },
  walk_cycle: { label: 'Walk / Cycle', exposureFactor: 1.25, emissionKgPer10Km: 0 },
  work_from_home: { label: 'Work From Home', exposureFactor: 0.55, emissionKgPer10Km: 0 },
};

export const HOME_SETUP_LABELS: Record<HomeSetupId, { label: string; indoorDeltaFactor: number }> = {
  air_purifier: { label: 'Has Air Purifier', indoorDeltaFactor: -0.38 },
  natural_ventilation: { label: 'Natural Ventilation Only', indoorDeltaFactor: 0.14 },
  indoor_plants: { label: 'Indoor Plants', indoorDeltaFactor: -0.04 },
  gas_stove: { label: 'Gas Stove Cooking', indoorDeltaFactor: 0.16 },
};

export function calculateRiskMultiplier(profile: HouseholdProfile): {
  multiplier: number;
  tier: 'Baseline' | 'Elevated' | 'High Sensitivity' | 'Critical Care';
  summary: string;
} {
  let maxSensitivityWeight = 1.0;
  let extraSensitivityCount = 0;

  for (const id of profile.sensitivities) {
    const w = SENSITIVITY_LABELS[id]?.weight ?? 1.0;
    if (w > maxSensitivityWeight) {
      maxSensitivityWeight = w;
    }
    if (id !== 'general_adult') {
      extraSensitivityCount += 1;
    }
  }

  const multiPersonBoost = extraSensitivityCount > 1 ? (extraSensitivityCount - 1) * 0.08 : 0;
  const commuteFactor = COMMUTE_LABELS[profile.commuteMode]?.exposureFactor ?? 1.0;
  const commuteAdjustment = (commuteFactor - 1.0) * 0.35;

  let homeAdjustment = 0;
  for (const setup of profile.homeSetup) {
    homeAdjustment += (HOME_SETUP_LABELS[setup]?.indoorDeltaFactor ?? 0) * 0.25;
  }

  const rawMultiplier = maxSensitivityWeight + multiPersonBoost + commuteAdjustment + homeAdjustment;
  const multiplier = Math.round(Math.max(0.75, Math.min(2.25, rawMultiplier)) * 100) / 100;

  let tier: 'Baseline' | 'Elevated' | 'High Sensitivity' | 'Critical Care' = 'Baseline';
  if (multiplier >= 1.55) tier = 'Critical Care';
  else if (multiplier >= 1.3) tier = 'High Sensitivity';
  else if (multiplier >= 1.1) tier = 'Elevated';

  const activeGroups = profile.sensitivities.map((s) => SENSITIVITY_LABELS[s].label).join(', ');
  const summary = `${tier} (${multiplier.toFixed(2)}×) · ${activeGroups} · ${COMMUTE_LABELS[profile.commuteMode].label}`;

  return { multiplier, tier, summary };
}

export function getPersonalizedAdvisory(aqi: number, profile: HouseholdProfile): string {
  const { multiplier } = calculateRiskMultiplier(profile);
  const effectiveAqi = Math.round(aqi * multiplier);
  const hasAsthma = profile.sensitivities.includes('asthma_respiratory');
  const hasChildOrElderly =
    profile.sensitivities.includes('child_infant') || profile.sensitivities.includes('elderly');
  const hasPurifier = profile.homeSetup.includes('air_purifier');

  if (effectiveAqi <= 75) {
    return 'Conditions are favorable for your household. Enjoy normal outdoor routines and keep windows cracked for fresh circulation.';
  }
  if (effectiveAqi <= 140) {
    return hasAsthma || hasChildOrElderly
      ? 'Keep brisk outdoor activity short for sensitive members and shift exercise to the cleanest midday window.'
      : 'Generally manageable for short errands; switch open-road commutes to enclosed transit where possible.';
  }
  if (effectiveAqi <= 230) {
    return `${hasAsthma ? 'Asthma alert: keep rescue inhalers handy and avoid roadside exertion. ' : ''}Wear a snug N95/FFP2 outdoors${
      hasPurifier ? ' and keep your air purifier on Medium-High.' : ' and seal drafty windows during peak smog hours.'
    }`;
  }
  return `High-exposure alert for your profile (${multiplier.toFixed(2)}× risk). Move all workouts indoors, use certified N95/FFP2 masks for any essential trip, and ${
    hasPurifier ? 'run HEPA filtration continuously in occupied bedrooms.' : 'create a clean-air room using wet sealing or a DIY MERV-13 fan box.'
  }`;
}

export function computeWindowsFromHourly(hourly24h: HourlyForecastPoint[]): {
  safestWindow: WindowSummary;
  peakSmogWindow: WindowSummary;
} {
  if (hourly24h.length < 3) {
    const first = hourly24h[0] ?? {
      time: '',
      hourLabel: '14:00',
      usAqi: 100,
      pm25: 35,
    };
    return {
      safestWindow: {
        startTime: first.hourLabel,
        endTime: first.hourLabel,
        label: first.hourLabel,
        avgAqi: first.usAqi,
        avgPm25: first.pm25,
      },
      peakSmogWindow: {
        startTime: first.hourLabel,
        endTime: first.hourLabel,
        label: first.hourLabel,
        avgAqi: first.usAqi,
        avgPm25: first.pm25,
      },
    };
  }

  let bestStartIdx = 0;
  let bestAvgAqi = Infinity;
  let bestAvgPm = 0;

  let worstStartIdx = 0;
  let worstAvgAqi = -Infinity;
  let worstAvgPm = 0;

  for (let i = 0; i <= hourly24h.length - 3; i++) {
    const slice = hourly24h.slice(i, i + 3);
    const avgAqi = slice.reduce((acc, p) => acc + p.usAqi, 0) / 3;
    const avgPm = slice.reduce((acc, p) => acc + p.pm25, 0) / 3;

    if (avgAqi < bestAvgAqi) {
      bestAvgAqi = avgAqi;
      bestAvgPm = avgPm;
      bestStartIdx = i;
    }
    if (avgAqi > worstAvgAqi) {
      worstAvgAqi = avgAqi;
      worstAvgPm = avgPm;
      worstStartIdx = i;
    }
  }

  const safeStart = hourly24h[bestStartIdx];
  const safeEnd = hourly24h[bestStartIdx + 2];
  const peakStart = hourly24h[worstStartIdx];
  const peakEnd = hourly24h[worstStartIdx + 2];

  return {
    safestWindow: {
      startTime: safeStart.hourLabel,
      endTime: safeEnd.hourLabel,
      label: `${safeStart.hourLabel} – ${safeEnd.hourLabel}`,
      avgAqi: Math.round(bestAvgAqi),
      avgPm25: Math.round(bestAvgPm * 10) / 10,
    },
    peakSmogWindow: {
      startTime: peakStart.hourLabel,
      endTime: peakEnd.hourLabel,
      label: `${peakStart.hourLabel} – ${peakEnd.hourLabel}`,
      avgAqi: Math.round(worstAvgAqi),
      avgPm25: Math.round(worstAvgPm * 10) / 10,
    },
  };
}

export function determineDominantPollutant(current: CurrentAirQuality): AirQualityTelemetry['dominantPollutant'] {
  const candidates: Array<{ key: PollutantKey; value: number }> = [
    { key: 'pm25', value: current.pm25 },
    { key: 'pm10', value: current.pm10 },
    { key: 'no2', value: current.no2 },
    { key: 'o3', value: current.o3 },
    { key: 'so2', value: current.so2 },
    { key: 'co', value: current.co },
  ];

  let best = candidates[0];
  let bestRatio = -1;

  for (const c of candidates) {
    const def = POLLUTANT_DEFINITIONS[c.key];
    const ratio = c.value / def.whoSafeLimit;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }

  const def = POLLUTANT_DEFINITIONS[best.key];
  return {
    key: best.key,
    label: def.symbol,
    value: Math.round(best.value * 10) / 10,
    unit: def.unit,
    ratioToLimit: Math.round(bestRatio * 10) / 10,
  };
}

export function estimateIndoorAqi(outdoorAqi: number, profile: HouseholdProfile): number {
  let factor = 0.72; // closed indoor baseline
  if (profile.homeSetup.includes('air_purifier')) factor -= 0.34;
  if (profile.homeSetup.includes('natural_ventilation')) factor += 0.16;
  if (profile.homeSetup.includes('gas_stove')) factor += 0.14;
  if (profile.homeSetup.includes('indoor_plants')) factor -= 0.03;

  factor = Math.max(0.22, Math.min(0.98, factor));
  return Math.max(12, Math.round(outdoorAqi * factor));
}
