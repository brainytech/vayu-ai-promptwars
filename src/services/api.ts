import type {
  AirQualityTelemetry,
  BudgetTier,
  ChatMessage,
  CityLocation,
  CurrentAirQuality,
  HabitSwapState,
  HouseholdProfile,
  HourlyForecastPoint,
  IaqHack,
  RoomCategory,
  RoutinePlanResponse,
} from '../types';
import {
  PRESET_CITIES,
  computeWindowsFromHourly,
  determineDominantPollutant,
} from '../utils/airQuality';

function formatHourLabel(isoTime: string): string {
  const parts = isoTime.split('T');
  if (parts.length === 2) {
    return parts[1].slice(0, 5);
  }
  return isoTime.slice(0, 5);
}

function buildFallbackTelemetry(city: CityLocation, reason: string): AirQualityTelemetry {
  const now = new Date();
  const baseAqiByCity: Record<string, number> = {
    Delhi: 268,
    Ahmedabad: 164,
    Mumbai: 138,
    Bengaluru: 82,
    Kolkata: 184,
  };
  const baseAqi = baseAqiByCity[city.name] ?? 152;
  const current: CurrentAirQuality = {
    time: now.toISOString(),
    usAqi: baseAqi,
    europeanAqi: Math.round(baseAqi * 0.62),
    pm25: Math.round(baseAqi * 0.68 * 10) / 10,
    pm10: Math.round(baseAqi * 1.15 * 10) / 10,
    no2: Math.round(baseAqi * 0.24 * 10) / 10,
    so2: Math.round(baseAqi * 0.09 * 10) / 10,
    co: Math.round(baseAqi * 4.8),
    o3: Math.round((45 + (baseAqi % 35)) * 10) / 10,
  };

  const hourly24h: HourlyForecastPoint[] = Array.from({ length: 24 }, (_, idx) => {
    const dt = new Date(now.getTime() + idx * 3600 * 1000);
    const hr = dt.getHours();
    // Typical urban winter diurnal curve: cleaner 13:00-17:00, higher 06:00-09:00 and 21:00-00:00
    const diurnalFactor =
      hr >= 13 && hr <= 16 ? 0.68 : hr >= 6 && hr <= 9 ? 1.18 : hr >= 21 || hr <= 1 ? 1.15 : 0.95;
    const usAqi = Math.max(25, Math.round(baseAqi * diurnalFactor));
    const hourLabel = `${String(hr).padStart(2, '0')}:00`;
    return {
      time: dt.toISOString(),
      hourLabel,
      usAqi,
      europeanAqi: Math.round(usAqi * 0.62),
      pm25: Math.round(usAqi * 0.68 * 10) / 10,
      pm10: Math.round(usAqi * 1.15 * 10) / 10,
      no2: Math.round(usAqi * 0.24 * 10) / 10,
      o3: Math.round((42 + (hr >= 12 && hr <= 16 ? 32 : 8)) * 10) / 10,
    };
  });

  const { safestWindow, peakSmogWindow } = computeWindowsFromHourly(hourly24h);
  const dominantPollutant = determineDominantPollutant(current);

  return {
    city,
    timezone: 'auto',
    current,
    hourly24h,
    safestWindow,
    peakSmogWindow,
    dominantPollutant,
    fetchedAt: now.toISOString(),
    isFallback: true,
    fallbackReason: reason,
  };
}

export async function searchCities(query: string): Promise<CityLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
    if (!res.ok) {
      throw new Error(`Geocode status ${res.status}`);
    }
    const data = (await res.json()) as { results?: CityLocation[] };
    return data.results ?? [];
  } catch {
    // Graceful direct browser fallback to Open-Meteo or local preset matches
    try {
      const directRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          trimmed
        )}&count=6&language=en&format=json`
      );
      if (directRes.ok) {
        const json = (await directRes.json()) as { results?: CityLocation[] };
        return json.results ?? [];
      }
    } catch {
      // ignore
    }
    return PRESET_CITIES.filter((c) =>
      c.name.toLowerCase().includes(trimmed.toLowerCase())
    );
  }
}

interface OpenMeteoAirQualityResponse {
  timezone?: string;
  current?: {
    time?: string;
    us_aqi?: number;
    european_aqi?: number;
    pm10?: number;
    pm2_5?: number;
    carbon_monoxide?: number;
    nitrogen_dioxide?: number;
    sulphur_dioxide?: number;
    ozone?: number;
  };
  hourly?: {
    time?: string[];
    us_aqi?: Array<number | null>;
    european_aqi?: Array<number | null>;
    pm2_5?: Array<number | null>;
    pm10?: Array<number | null>;
    nitrogen_dioxide?: Array<number | null>;
    ozone?: Array<number | null>;
  };
}

function parseOpenMeteoAirQuality(city: CityLocation, raw: OpenMeteoAirQualityResponse): AirQualityTelemetry {
  if (!raw.current || !raw.hourly || !Array.isArray(raw.hourly.time)) {
    throw new Error('Incomplete Open-Meteo telemetry payload.');
  }

  const cur = raw.current;
  const current: CurrentAirQuality = {
    time: cur.time ?? new Date().toISOString(),
    usAqi: Math.round(cur.us_aqi ?? 0),
    europeanAqi: Math.round(cur.european_aqi ?? 0),
    pm25: Math.round((cur.pm2_5 ?? 0) * 10) / 10,
    pm10: Math.round((cur.pm10 ?? 0) * 10) / 10,
    no2: Math.round((cur.nitrogen_dioxide ?? 0) * 10) / 10,
    so2: Math.round((cur.sulphur_dioxide ?? 0) * 10) / 10,
    co: Math.round(cur.carbon_monoxide ?? 0),
    o3: Math.round((cur.ozone ?? 0) * 10) / 10,
  };

  const times = raw.hourly.time ?? [];
  const currentHourPrefix = current.time.slice(0, 13); // YYYY-MM-DDTHH
  let startIndex = times.findIndex((t) => t.startsWith(currentHourPrefix));
  if (startIndex < 0) startIndex = 0;

  const hourly24h: HourlyForecastPoint[] = [];
  for (let i = startIndex; i < Math.min(times.length, startIndex + 24); i++) {
    const t = times[i];
    hourly24h.push({
      time: t,
      hourLabel: formatHourLabel(t),
      usAqi: Math.round(raw.hourly.us_aqi?.[i] ?? current.usAqi),
      europeanAqi: Math.round(raw.hourly.european_aqi?.[i] ?? current.europeanAqi),
      pm25: Math.round((raw.hourly.pm2_5?.[i] ?? current.pm25) * 10) / 10,
      pm10: Math.round((raw.hourly.pm10?.[i] ?? current.pm10) * 10) / 10,
      no2: Math.round((raw.hourly.nitrogen_dioxide?.[i] ?? current.no2) * 10) / 10,
      o3: Math.round((raw.hourly.ozone?.[i] ?? current.o3) * 10) / 10,
    });
  }

  const { safestWindow, peakSmogWindow } = computeWindowsFromHourly(hourly24h);
  const dominantPollutant = determineDominantPollutant(current);

  return {
    city,
    timezone: raw.timezone ?? 'auto',
    current,
    hourly24h,
    safestWindow,
    peakSmogWindow,
    dominantPollutant,
    fetchedAt: new Date().toISOString(),
    isFallback: false,
  };
}

export async function fetchAirQuality(city: CityLocation): Promise<AirQualityTelemetry> {
  try {
    const res = await fetch(
      `/api/air-quality?lat=${encodeURIComponent(city.latitude)}&lon=${encodeURIComponent(
        city.longitude
      )}&city=${encodeURIComponent(city.name)}`
    );
    if (!res.ok) {
      throw new Error(`Server proxy returned ${res.status}`);
    }
    const raw = (await res.json()) as OpenMeteoAirQualityResponse;
    return parseOpenMeteoAirQuality(city, raw);
  } catch (proxyErr) {
    // Fallback direct call to Open-Meteo from browser before using offline advisory baseline
    try {
      const params = new URLSearchParams({
        latitude: String(city.latitude),
        longitude: String(city.longitude),
        current:
          'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
        hourly: 'pm2_5,pm10,us_aqi,european_aqi,nitrogen_dioxide,ozone',
        timezone: 'auto',
        forecast_days: '2',
      });
      const directRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`
      );
      if (directRes.ok) {
        const raw = (await directRes.json()) as OpenMeteoAirQualityResponse;
        return parseOpenMeteoAirQuality(city, raw);
      }
    } catch {
      // ignore
    }
    const reason =
      proxyErr instanceof Error ? proxyErr.message : 'Unable to reach Open-Meteo Air Quality API';
    return buildFallbackTelemetry(city, reason);
  }
}

async function parseJsonResponse<T>(res: Response, defaultError: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text();
    const cleanSnippet = rawText.slice(0, 150).replace(/<[^>]*>/g, '').trim();
    if (!res.ok) {
      throw new Error(
        `Server error (${res.status}): ${cleanSnippet || defaultError}. ` +
          (res.status === 404
            ? 'Please ensure Vercel API functions and GROQ_API_KEY are configured.'
            : '')
      );
    }
    throw new Error(
      `Expected JSON but received non-JSON (${res.status}): "${cleanSnippet.slice(0, 80)}"`
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Failed to parse JSON response (${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `${defaultError} (${res.status})`);
  }

  return data as T;
}

export async function fetchDailyRoutine(params: {
  telemetry: AirQualityTelemetry;
  profile: HouseholdProfile;
  tailorInstruction?: string;
}): Promise<RoutinePlanResponse> {
  const res = await fetch('/api/ai/routine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: params.telemetry.city,
      current: params.telemetry.current,
      safestWindow: params.telemetry.safestWindow,
      peakSmogWindow: params.telemetry.peakSmogWindow,
      profile: params.profile,
      tailorInstruction: params.tailorInstruction,
    }),
  });

  return parseJsonResponse<RoutinePlanResponse>(res, 'Failed to generate daily routine');
}

export async function fetchAiIaqHacks(params: {
  telemetry: AirQualityTelemetry;
  profile: HouseholdProfile;
  roomFilter: RoomCategory | 'All';
  budgetFilter: BudgetTier | 'All';
}): Promise<IaqHack[]> {
  const res = await fetch('/api/ai/iaq-hacks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: params.telemetry.city,
      current: params.telemetry.current,
      profile: params.profile,
      roomFilter: params.roomFilter === 'All' ? 'All Rooms' : params.roomFilter,
      budgetFilter: params.budgetFilter === 'All' ? 'All Tiers' : params.budgetFilter,
    }),
  });

  const data = await parseJsonResponse<{ hacks?: IaqHack[]; error?: string }>(
    res,
    'Failed to generate AI room hacks'
  );
  return (data.hacks ?? []).map((h) => ({ ...h, isAiGenerated: true }));
}

async function consumeSseStream(
  response: Response,
  onChunk: (delta: string) => void
): Promise<void> {
  if (!response.ok) {
    let msg = `Request failed (${response.status})`;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const errJson = (await response.json()) as { error?: string };
        if (errJson.error) msg = errJson.error;
      } catch {
        // ignore
      }
    } else {
      const text = await response.text();
      const snippet = text.slice(0, 150).replace(/<[^>]*>/g, '').trim();
      if (snippet) msg = `${msg}: ${snippet}`;
    }
    throw new Error(msg);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const text = await response.text();
    const snippet = text.slice(0, 150).replace(/<[^>]*>/g, '').trim();
    throw new Error(
      `Expected event-stream but received ${contentType || 'unknown'}: ${snippet.slice(0, 80)}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response body unavailable.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload) as { text?: string; error?: string };
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.text) {
          onChunk(parsed.text);
        }
      } catch (e) {
        if (e instanceof Error && e.message && !e.message.includes('JSON')) {
          throw e;
        }
      }
    }
  }
}

export async function streamImpactSummary(
  params: {
    telemetry: AirQualityTelemetry;
    profile: HouseholdProfile;
    swaps: HabitSwapState;
    metrics: {
      pm25DosePreventedUg: number;
      co2ReducedKgMonth: number;
      treesEquivalent: number;
    };
  },
  onChunk: (delta: string) => void
): Promise<void> {
  const res = await fetch('/api/ai/impact-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: params.telemetry.city,
      current: params.telemetry.current,
      profile: params.profile,
      swaps: params.swaps,
      metrics: params.metrics,
    }),
  });
  await consumeSseStream(res, onChunk);
}

export async function streamVayuChat(
  params: {
    message: string;
    history: ChatMessage[];
    telemetry: AirQualityTelemetry;
    profile: HouseholdProfile;
    riskMultiplier: { multiplier: number; tier: string; summary: string };
  },
  onChunk: (delta: string) => void
): Promise<void> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  await consumeSseStream(res, onChunk);
}
