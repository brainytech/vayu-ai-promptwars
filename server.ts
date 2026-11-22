import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawPort = Number(process.env.PORT);
const PORT =
  Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 3000;

// Groq Model Configuration
const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL?.trim() || GROQ_MODEL;

function getGroqApiKey(): string | null {
  return (
    process.env.GROQ_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

function getFriendlyGroqError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (
    raw.includes('401') ||
    raw.includes('Invalid API Key') ||
    raw.includes('Unauthorized') ||
    raw.includes('invalid_api_key')
  ) {
    return {
      status: 401,
      message: 'Groq API key is invalid or missing. Please set GROQ_API_KEY in .env.',
    };
  }
  if (raw.includes('429') || raw.includes('rate_limit') || raw.includes('tokens_per_minute')) {
    return {
      status: 429,
      message: 'Groq API rate limit reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('service_unavailable')) {
    return {
      status: 503,
      message: 'Groq model is temporarily experiencing high traffic. Please retry in a few seconds.',
    };
  }
  return {
    status: 500,
    message: raw || 'Unable to generate AI response right now.',
  };
}

async function callGroqChat(options: {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_completion_tokens?: number;
  response_format?: { type: string };
}): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API key not found. Please set GROQ_API_KEY in .env');
  }

  const model = options.model || GROQ_MODEL;
  const payload: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 1,
    max_completion_tokens: options.max_completion_tokens ?? 2048,
    top_p: 1,
    stream: false,
  };

  if (model.includes('oss') || model.includes('r1')) {
    payload.reasoning_effort = 'medium';
  }
  if (options.response_format) {
    payload.response_format = options.response_format;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errMsg = `Groq API returned ${response.status}`;
    try {
      const errJson = (await response.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? '';
}

async function streamGroqChat(
  options: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_completion_tokens?: number;
  },
  onDelta: (delta: string) => void
): Promise<void> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API key not found. Please set GROQ_API_KEY in .env');
  }

  const model = options.model || GROQ_CHAT_MODEL;
  const payload: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 1,
    max_completion_tokens: options.max_completion_tokens ?? 2048,
    top_p: 1,
    stream: true,
  };

  if (model.includes('oss') || model.includes('r1')) {
    payload.reasoning_effort = 'medium';
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errMsg = `Groq API returned ${response.status}`;
    try {
      const errJson = (await response.json()) as { error?: { message?: string } };
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No readable stream returned from Groq');
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
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') return;
      try {
        const parsed = JSON.parse(dataStr) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) {
          onDelta(text);
        }
      } catch {
        // partial chunk, continue
      }
    }
  }
}

async function withGroqFallback<T>(
  preferredModel: string,
  fn: (model: string) => Promise<T>
): Promise<T> {
  const models = [preferredModel];
  const defaults = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  for (const m of defaults) {
    if (!models.includes(m)) models.push(m);
  }

  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    const currentModel = models[i];
    try {
      return await fn(currentModel);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i < models.length - 1) {
        console.warn(
          `[Groq] Model "${currentModel}" failed (${msg.slice(0, 80)}). Trying fallback model "${models[i + 1]}"...`
        );
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const app = express();
app.use(express.json({ limit: '1mb' }));

// Normalize URL in case a proxy or Vercel rewrite stripped the /api prefix
app.use((req, _res, next) => {
  if (
    !req.url.startsWith('/api/') &&
    !req.url.startsWith('/test-chat') &&
    (req.url.startsWith('/health') ||
      req.url.startsWith('/geocode') ||
      req.url.startsWith('/air-quality') ||
      req.url.startsWith('/ai/'))
  ) {
    req.url = '/api' + req.url;
  }
  next();
});

app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ ok: true, provider: 'groq', model: GROQ_MODEL });
});

  // Standalone Groq API Test Route (Interactive HTML UI)
  app.get('/test-chat', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Groq API Test Console</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; width: 100%; max-width: 600px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; font-weight: 700; color: #f97316; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    p.sub { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #cbd5e1; margin-bottom: 6px; }
    select, textarea { width: 100%; padding: 12px 14px; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: #f8fafc; font-size: 14px; outline: none; transition: border-color 0.2s; font-family: inherit; }
    select:focus, textarea:focus { border-color: #f97316; }
    textarea { resize: vertical; min-height: 80px; }
    .quick-chips { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .chip { background: #334155; color: #cbd5e1; border: none; padding: 6px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; transition: background 0.2s; }
    .chip:hover { background: #475569; color: #fff; }
    button.send-btn { width: 100%; background: #ea580c; color: white; border: none; padding: 14px; font-size: 15px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    button.send-btn:hover { background: #c2410c; }
    button.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .result-box { margin-top: 20px; padding: 16px; border-radius: 10px; font-size: 14px; line-height: 1.5; display: none; }
    .result-box.success { background: #064e3b; border: 1px solid #059669; color: #d1fae5; }
    .result-box.error { background: #4c0519; border: 1px solid #e11d48; color: #ffe4e6; }
    .meta { font-size: 11px; margin-top: 10px; opacity: 0.8; font-family: monospace; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1><span>⚡</span> Groq API Test Console</h1>
    <p class="sub">Send a simple prompt to verify that your Groq API key and model respond properly.</p>
    
    <div class="form-group">
      <label for="model">Select Model</label>
      <select id="model">
        <option value="openai/gpt-oss-120b" selected>openai/gpt-oss-120b (Groq · Primary)</option>
        <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Groq · Fast)</option>
        <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Groq · Ultra-Fast)</option>
      </select>
    </div>

    <div class="form-group">
      <label for="message">Message</label>
      <textarea id="message" placeholder="Type a message to send to Groq...">Hello! Are you working properly? Reply in one short sentence.</textarea>
      <div class="quick-chips">
        <button class="chip" onclick="setPrompt('Hello! Confirm you are online in 5 words.')">Status Check</button>
        <button class="chip" onclick="setPrompt('What is 25 * 4? Just answer with the number.')">Math Test</button>
        <button class="chip" onclick="setPrompt('Tell me a one-line clean science joke.')">Joke Test</button>
      </div>
    </div>

    <button id="sendBtn" class="send-btn" onclick="sendTestChat()">Send Test Message</button>

    <div id="result" class="result-box"></div>
  </div>

  <script>
    function setPrompt(text) {
      document.getElementById('message').value = text;
    }

    async function sendTestChat() {
      const btn = document.getElementById('sendBtn');
      const result = document.getElementById('result');
      const message = document.getElementById('message').value.trim();
      const model = document.getElementById('model').value;

      if (!message) return;

      btn.disabled = true;
      btn.innerText = 'Sending to Groq...';
      result.style.display = 'block';
      result.className = 'result-box';
      result.innerHTML = '<em>Connecting to Groq API...</em>';

      try {
        const res = await fetch('/api/test-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, model })
        });
        const data = await res.json();
        
        if (data.ok) {
          result.className = 'result-box success';
          result.innerHTML = '<strong>Groq Reply:</strong><div style="margin-top:6px; white-space:pre-wrap;">' + escapeHtml(data.reply) + '</div>' +
            '<div class="meta">✓ Provider: Groq · Model: ' + data.model + ' · Latency: ' + data.latencyMs + 'ms</div>';
        } else {
          result.className = 'result-box error';
          result.innerHTML = '<strong>Error:</strong> ' + escapeHtml(data.error || 'Request failed') +
            (data.rawError ? '<div style="font-size:12px; margin-top:6px; opacity:0.85;">Details: ' + escapeHtml(data.rawError) + '</div>' : '') +
            '<div class="meta">Model: ' + data.model + ' · Latency: ' + (data.latencyMs || 0) + 'ms</div>';
        }
      } catch (err) {
        result.className = 'result-box error';
        result.innerHTML = '<strong>Network / Fetch Error:</strong> ' + escapeHtml(err.message || String(err));
      } finally {
        btn.disabled = false;
        btn.innerText = 'Send Test Message';
      }
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.innerText = str;
      return div.innerHTML;
    }
  </script>
</body>
</html>`);
  });

  // Standalone API Test Endpoints (JSON)
  app.post(['/api/test-chat', '/test-chat'], async (req, res) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        error: 'GROQ_API_KEY is not configured in .env.',
      });
    }

    const message =
      typeof req.body?.message === 'string' && req.body.message.trim().length > 0
        ? req.body.message.trim()
        : 'Hello! Please confirm you are working.';
    const selectedModel =
      typeof req.body?.model === 'string' && req.body.model.trim().length > 0
        ? req.body.model.trim()
        : GROQ_MODEL;

    const start = Date.now();
    try {
      const reply = await withGroqFallback(selectedModel, (m) =>
        callGroqChat({
          model: m,
          messages: [{ role: 'user', content: message }],
        })
      );

      const latencyMs = Date.now() - start;
      return res.json({
        ok: true,
        provider: 'groq',
        model: selectedModel,
        prompt: message,
        reply: reply || '(empty response)',
        latencyMs,
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      const friendly = getFriendlyGroqError(err);
      const raw = err instanceof Error ? err.message : String(err);
      return res.status(friendly.status || 500).json({
        ok: false,
        provider: 'groq',
        model: selectedModel,
        prompt: message,
        error: friendly.message,
        rawError: raw,
        latencyMs,
      });
    }
  });

  app.get('/api/test-chat', async (req, res) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        error: 'GROQ_API_KEY is not configured in .env.',
      });
    }

    const message =
      typeof req.query.q === 'string' && req.query.q.trim().length > 0
        ? req.query.q.trim()
        : typeof req.query.message === 'string' && req.query.message.trim().length > 0
        ? req.query.message.trim()
        : 'Hello Groq! Please reply in one short sentence to confirm you are online and working.';
    const selectedModel =
      typeof req.query.model === 'string' && req.query.model.trim().length > 0
        ? req.query.model.trim()
        : GROQ_MODEL;

    const start = Date.now();
    try {
      const reply = await withGroqFallback(selectedModel, (m) =>
        callGroqChat({
          model: m,
          messages: [{ role: 'user', content: message }],
        })
      );

      const latencyMs = Date.now() - start;
      return res.json({
        ok: true,
        provider: 'groq',
        model: selectedModel,
        prompt: message,
        reply: reply || '(empty response)',
        latencyMs,
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      const friendly = getFriendlyGroqError(err);
      const raw = err instanceof Error ? err.message : String(err);
      return res.status(friendly.status || 500).json({
        ok: false,
        provider: 'groq',
        model: selectedModel,
        prompt: message,
        error: friendly.message,
        rawError: raw,
        latencyMs,
      });
    }
  });

  // Live Geocoding Proxy (Open-Meteo Geocoding API)
  app.get('/api/geocode', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2 || query.length > 80) {
      return res.status(400).json({ error: 'Search query must be between 2 and 80 characters.' });
    }

    try {
      const upstreamUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=6&language=en&format=json`;
      const upstream = await fetchWithTimeout(upstreamUrl);
      if (!upstream.ok) {
        return res.status(502).json({ error: `Open-Meteo Geocoding returned ${upstream.status}` });
      }
      const json = (await upstream.json()) as {
        results?: Array<{
          name: string;
          admin1?: string;
          country?: string;
          latitude: number;
          longitude: number;
        }>;
      };
      const results = (json.results ?? []).map((item) => ({
        name: item.name,
        admin1: item.admin1 ?? '',
        country: item.country ?? '',
        latitude: item.latitude,
        longitude: item.longitude,
      }));
      return res.json({ results });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Geocoding lookup failed';
      return res.status(502).json({ error: `Geocoding unavailable: ${msg}` });
    }
  });

  // Live Air Quality Telemetry Proxy (Open-Meteo Air Quality API)
  app.get('/api/air-quality', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid numeric lat and lon coordinates are required.' });
    }

    try {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current:
          'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone',
        hourly: 'pm2_5,pm10,us_aqi,european_aqi,nitrogen_dioxide,ozone',
        timezone: 'auto',
        forecast_days: '2',
      });
      const upstreamUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`;
      const upstream = await fetchWithTimeout(upstreamUrl);
      if (!upstream.ok) {
        return res.status(502).json({ error: `Open-Meteo Air Quality returned ${upstream.status}` });
      }
      const data = await upstream.json();
      return res.json(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Air quality upstream failed';
      return res.status(502).json({ error: `Open-Meteo Air Quality unavailable: ${msg}` });
    }
  });

  // Module 3: AI Low-Emission Daily Routine Planner (Structured JSON)
  app.post('/api/ai/routine', async (req, res) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(503).json({
        error: 'Groq API key is not configured in .env.',
      });
    }

    const { city, current, safestWindow, peakSmogWindow, profile, tailorInstruction } = req.body ?? {};
    if (!city?.name || typeof current?.usAqi !== 'number' || !profile) {
      return res.status(400).json({ error: 'Missing required telemetry or household profile payload.' });
    }

    const safeTailor =
      typeof tailorInstruction === 'string' && tailorInstruction.trim().length > 0
        ? tailorInstruction.trim().slice(0, 300)
        : 'None provided.';

    const prompt = `
Generate a hyper-personalized, low-emission daily routine schedule for a family in ${city.name}, ${city.country}.

LIVE TELEMETRY:
- Current US AQI: ${current.usAqi} | European AQI: ${current.europeanAqi}
- PM2.5: ${current.pm25} µg/m³ | PM10: ${current.pm10} µg/m³ | NO2: ${current.no2} µg/m³ | O3: ${current.o3} µg/m³
- Safest Outdoor Window (lowest AQI): ${safestWindow?.label ?? 'Midday'} (Avg AQI ${safestWindow?.avgAqi ?? current.usAqi})
- Peak Smog Alert Hours: ${peakSmogWindow?.label ?? 'Early morning & late night'} (Avg AQI ${peakSmogWindow?.avgAqi ?? current.usAqi})

HOUSEHOLD PROFILE:
- Sensitivity Groups: ${(profile.sensitivities ?? []).join(', ')}
- Primary Commute Mode: ${profile.commuteMode}
- Home Setup: ${(profile.homeSetup ?? []).join(', ')}
- User Custom Tailoring Request: ${safeTailor}

REQUIREMENTS:
1. Create exactly 4 to 6 actionable routine items covering all 4 phases: Morning, Afternoon, Evening, Night.
2. Each item must adapt directly to the live AQI numbers, safest window, peak smog hours, and the household's commute/home setup.
3. For each item, provide realistic estimates of pm25SavedUg (micrograms/day inhaled dose avoided, integer 5–450) and co2SavedKg (kg CO2e avoided, number 0–6.5).
4. Make "whyThisMatters" a crisp, evidence-based explanation tying physiological lung protection and/or emission reduction directly to the action.
`;

    const systemInstruction = `You are VayuShield AI, an environmental health scientist and urban air-quality strategist.
You must return your response strictly as a valid JSON object matching this schema:
{
  "headline": "A short 1-sentence tactical summary of today's air strategy for this household.",
  "items": [
    {
      "id": "1",
      "phase": "Morning",
      "timeRange": "07:00 – 09:00",
      "title": "Action title",
      "action": "Concrete step",
      "whyThisMatters": "Physiological explanation",
      "pm25SavedUg": 45,
      "co2SavedKg": 1.2,
      "priority": "Critical"
    }
  ]
}
Phase must be one of: "Morning", "Afternoon", "Evening", "Night".
Priority must be one of: "Critical", "Recommended", "Optional".
Return ONLY the raw JSON object, without markdown formatting.`;

    try {
      const rawText = await withGroqFallback(GROQ_MODEL, (model) =>
        callGroqChat({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        })
      );

      const parsed = JSON.parse(rawText.trim());
      return res.json(parsed);
    } catch (err) {
      const friendly = getFriendlyGroqError(err);
      return res.status(friendly.status).json({ error: friendly.message });
    }
  });

  // Module 4: AI Room-by-Room IAQ Hacks Generator (Structured JSON)
  app.post('/api/ai/iaq-hacks', async (req, res) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(503).json({
        error: 'Groq API key is not configured in .env.',
      });
    }

    const { city, current, profile, roomFilter, budgetFilter } = req.body ?? {};
    if (!city?.name || typeof current?.usAqi !== 'number' || !profile) {
      return res.status(400).json({ error: 'Missing required telemetry or profile data.' });
    }

    const prompt = `
Generate 4 targeted indoor air quality (IAQ) hacks for a home in ${city.name} where outdoor US AQI is ${current.usAqi}, PM2.5 is ${current.pm25} µg/m³, PM10 is ${current.pm10} µg/m³, and NO2 is ${current.no2} µg/m³.

HOME & SENSITIVITY CONTEXT:
- Sensitivity Groups: ${(profile.sensitivities ?? []).join(', ')}
- Home Setup: ${(profile.homeSetup ?? []).join(', ')}
- Requested Room Focus: ${roomFilter || 'All Rooms'}
- Requested Budget Tier Focus: ${budgetFilter || 'All Tiers'}

REQUIREMENTS:
- Each hack must belong to one of: Kitchen, Bedroom, Living Room, Home Office.
- Each hack must belong to one budget tier: Zero-Cost Hacks, Low-Cost DIY, Smart Tech.
- If a specific Room or Budget tier is requested (not "All"), prioritize generating hacks in that room/tier.
- Include concrete, practical steps and a quantified "directImpact" explanation (how much PM2.5/NO2/dust it traps or prevents).
`;

    const systemInstruction = `You are an indoor environmental engineering specialist.
Return your response strictly as a valid JSON object matching this schema:
{
  "hacks": [
    {
      "id": "hack-1",
      "title": "Hack Title",
      "room": "Kitchen",
      "budget": "Zero-Cost Hacks",
      "steps": "Concrete steps",
      "directImpact": "Quantified impact",
      "reductionPercent": 35
    }
  ]
}
Room must be one of: "Kitchen", "Bedroom", "Living Room", "Home Office".
Budget must be one of: "Zero-Cost Hacks", "Low-Cost DIY", "Smart Tech".
Return ONLY the raw JSON object.`;

    try {
      const rawText = await withGroqFallback(GROQ_MODEL, (model) =>
        callGroqChat({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        })
      );

      const parsed = JSON.parse(rawText.trim());
      return res.json(parsed);
    } catch (err) {
      const friendly = getFriendlyGroqError(err);
      return res.status(friendly.status).json({ error: friendly.message });
    }
  });

  // Module 5: Streaming AI Impact Explanation ("The Why" Engine)
  app.post('/api/ai/impact-summary', async (req, res) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(503).json({
        error: 'Groq API key is not configured in .env.',
      });
    }

    const { city, current, profile, swaps, metrics } = req.body ?? {};
    if (!city?.name || !swaps || !metrics) {
      return res.status(400).json({ error: 'Missing required impact simulator data.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const activeSwaps: string[] = [];
    if (swaps.commuteSwap)
      activeSwaps.push(`Commute switched to Metro/EV/Carpool (${swaps.commuteKmPerDay} km/day)`);
    if (swaps.cookingSwap) activeSwaps.push('Cooking switched to Exhaust Hood + Induction/Lid');
    if (swaps.wasteSwap)
      activeSwaps.push('Waste/Festive switched to Composting & LEDs (no burning/firecrackers)');
    if (swaps.maskSwap)
      activeSwaps.push('Outdoor masking upgraded from cloth to certified N95/FFP2 respirator');

    const prompt = `
Explain in plain, empowering, scientifically grounded language (around 110–140 words) the direct personal health AND community airshed impact of this household's current daily habit swaps in ${city.name} (Current US AQI: ${current?.usAqi ?? 'N/A'}, PM2.5: ${current?.pm25 ?? 'N/A'} µg/m³).

Active Habit Swaps: ${activeSwaps.length > 0 ? activeSwaps.join('; ') : 'None toggled yet'}
Calculated Metrics:
- Personal PM2.5 Dose Prevented: ${metrics.pm25DosePreventedUg} µg/day
- Community Emissions Reduced: ${metrics.co2ReducedKgMonth} kg CO2e/month
- Equivalent Mature Trees: ${metrics.treesEquivalent} trees/year
- Household Sensitivities: ${(profile?.sensitivities ?? []).join(', ')}

Keep it concise, concrete, and structured into 2 short paragraphs without markdown headings or bullet spam.
`;

    try {
      await withGroqFallback(GROQ_MODEL, (model) =>
        streamGroqChat(
          {
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are VayuShield AI explaining the direct physiological and emissions impact of clean-air lifestyle swaps clearly and empathetically.',
              },
              { role: 'user', content: prompt },
            ],
          },
          (delta) => {
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        )
      );

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const friendly = getFriendlyGroqError(err);
      res.write(`data: ${JSON.stringify({ error: friendly.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  // Module 6: "Vayu" Context-Aware AI Pollution Guardian (Streaming SSE)
  app.post('/api/ai/chat', async (req, res) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return res.status(503).json({
        error: 'Groq API key is not configured in .env.',
      });
    }

    const { message, history, telemetry, profile, riskMultiplier } = req.body ?? {};
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const cityLabel = telemetry?.city
      ? `${telemetry.city.name}, ${telemetry.city.country}`
      : 'Unknown City';
    const cur = telemetry?.current ?? {};
    const safeWin = telemetry?.safestWindow?.label ?? 'Midday';
    const peakWin = telemetry?.peakSmogWindow?.label ?? 'Early morning & late night';

    const systemInstruction = `
You are "Vayu", the context-aware AI Urban Air Quality & Pollution Guardian inside VayuShield AI.
Always anchor your advice strictly to the user's live telemetry and household profile injected below:

LIVE TELEMETRY FOR ${cityLabel}:
- US AQI: ${cur.usAqi ?? 'N/A'} | European AQI: ${cur.europeanAqi ?? 'N/A'}
- PM2.5: ${cur.pm25 ?? 'N/A'} µg/m³ | PM10: ${cur.pm10 ?? 'N/A'} µg/m³
- NO2: ${cur.no2 ?? 'N/A'} µg/m³ | O3: ${cur.o3 ?? 'N/A'} µg/m³ | SO2: ${cur.so2 ?? 'N/A'} µg/m³ | CO: ${cur.co ?? 'N/A'} µg/m³
- Dominant Pollutant: ${telemetry?.dominantPollutant?.label ?? 'PM2.5'}
- Safest Outdoor Window (next 24h): ${safeWin} (Avg AQI ${telemetry?.safestWindow?.avgAqi ?? 'N/A'})
- Peak Smog Alert Hours (next 24h): ${peakWin} (Avg AQI ${telemetry?.peakSmogWindow?.avgAqi ?? 'N/A'})

HOUSEHOLD & SENSITIVITY PROFILE:
- Sensitivity Groups: ${(profile?.sensitivities ?? ['general_adult']).join(', ')}
- Commute Mode: ${profile?.commuteMode ?? 'public_transit'}
- Home Setup: ${(profile?.homeSetup ?? []).join(', ')}
- Calculated Risk Multiplier: ${riskMultiplier?.multiplier ?? 1}x (${riskMultiplier?.tier ?? 'Baseline'})

STYLE GUIDELINES:
- Give direct, practical, medically sensible guidance tailored to this exact household and today's numbers.
- Cite specific numbers (AQI, PM2.5, safe hours) naturally so the user sees you are reading their live city telemetry.
- Be concise, clean, and scannable with clear paragraph breaks and at most 3–4 crisp action points.
- Do NOT use decorative dividers like '---' or excessive asterisks. Keep headings and bold highlights clean and minimal.
- Remind users to consult a clinician for acute breathing distress or medical emergencies.
`;

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m: { role?: string; content?: string }) =>
              (m.role === 'user' || m.role === 'model') &&
              typeof m.content === 'string' &&
              m.content.trim().length > 0
          )
          .slice(-6)
          .map((m: { role: string; content: string }) => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.content.slice(0, 1000),
          }))
      : [];

    const messages = [
      { role: 'system', content: systemInstruction },
      ...safeHistory,
      { role: 'user', content: message.trim().slice(0, 2000) },
    ];

    try {
      await withGroqFallback(GROQ_CHAT_MODEL, (model) =>
        streamGroqChat(
          {
            model,
            messages,
            temperature: 1,
            max_completion_tokens: 2048,
          },
          (delta) => {
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        )
      );

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const friendly = getFriendlyGroqError(err);
      res.write(`data: ${JSON.stringify({ error: friendly.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });

  // API 404 handler - ensures API calls never return an HTML error page
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

async function startLocalServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VayuShield AI server (Groq: ${GROQ_MODEL}) listening on http://localhost:${PORT}`);
  });
}

// Only start the HTTP listener if NOT running in Vercel serverless environment
if (!process.env.VERCEL) {
  startLocalServer().catch((err) => {
    console.error('Failed to start local server:', err);
  });
}

export default app;
