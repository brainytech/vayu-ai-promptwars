export type SensitivityProfileId =
  | 'general_adult'
  | 'child_infant'
  | 'elderly'
  | 'asthma_respiratory'
  | 'pregnant'
  | 'outdoor_athlete';

export type CommuteMode =
  | 'two_wheeler'
  | 'car'
  | 'public_transit'
  | 'walk_cycle'
  | 'work_from_home';

export type HomeSetupId =
  | 'air_purifier'
  | 'natural_ventilation'
  | 'indoor_plants'
  | 'gas_stove';

export interface HouseholdProfile {
  sensitivities: SensitivityProfileId[];
  commuteMode: CommuteMode;
  homeSetup: HomeSetupId[];
}

export interface CityLocation {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface CurrentAirQuality {
  time: string;
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  co: number;
  o3: number;
}

export interface HourlyForecastPoint {
  time: string;
  hourLabel: string;
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
}

export interface WindowSummary {
  startTime: string;
  endTime: string;
  label: string;
  avgAqi: number;
  avgPm25: number;
}

export interface AirQualityTelemetry {
  city: CityLocation;
  timezone: string;
  current: CurrentAirQuality;
  hourly24h: HourlyForecastPoint[];
  safestWindow: WindowSummary;
  peakSmogWindow: WindowSummary;
  dominantPollutant: {
    key: PollutantKey;
    label: string;
    value: number;
    unit: string;
    ratioToLimit: number;
  };
  fetchedAt: string;
  isFallback?: boolean;
  fallbackReason?: string;
}

export type PollutantKey = 'pm25' | 'pm10' | 'no2' | 'o3' | 'so2' | 'co';

export interface RoutineItem {
  id: string;
  phase: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  timeRange: string;
  title: string;
  action: string;
  whyThisMatters: string;
  pm25SavedUg: number;
  co2SavedKg: number;
  priority: 'Critical' | 'Recommended' | 'Optional';
}

export interface RoutinePlanResponse {
  headline: string;
  items: RoutineItem[];
}

export type RoomCategory = 'Kitchen' | 'Bedroom' | 'Living Room' | 'Home Office';
export type BudgetTier = 'Zero-Cost Hacks' | 'Low-Cost DIY' | 'Smart Tech';

export interface IaqHack {
  id: string;
  title: string;
  room: RoomCategory;
  budget: BudgetTier;
  steps: string;
  directImpact: string;
  reductionPercent: number;
  isAiGenerated?: boolean;
}

export interface HabitSwapState {
  commuteSwap: boolean;
  commuteKmPerDay: number;
  cookingSwap: boolean;
  wasteSwap: boolean;
  maskSwap: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export type AppTab = 'radar' | 'routine' | 'iaq' | 'impact' | 'vayu' | 'test';
