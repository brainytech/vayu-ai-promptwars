import { useCallback, useEffect, useState } from 'react';
import { Check, Share2, X } from 'lucide-react';
import type {
  AirQualityTelemetry,
  AppTab,
  ChatMessage,
  CityLocation,
  HabitSwapState,
  HouseholdProfile,
} from './types';
import { PRESET_CITIES, getAqiSeverity } from './utils/airQuality';
import { fetchAirQuality } from './services/api';
import { CitySearchBar } from './components/CitySearchBar';
import { HouseholdProfileDrawer } from './components/HouseholdProfileDrawer';
import { SmogRadarDashboard } from './components/SmogRadarDashboard';
import { DailyRoutinePlanner } from './components/DailyRoutinePlanner';
import { IndoorAirLab } from './components/IndoorAirLab';
import { ImpactSimulator } from './components/ImpactSimulator';
import { VayuChatbot } from './components/VayuChatbot';
import { ApiTestChat } from './components/ApiTestChat';

const NAV_TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'radar', label: 'Smog Radar' },
  { id: 'routine', label: 'Daily Routine' },
  { id: 'iaq', label: 'Indoor Lab' },
  { id: 'impact', label: 'Impact & Swaps' },
  { id: 'vayu', label: 'Ask Vayu' },
  { id: 'test', label: 'API Test Chat' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('radar');
  const [selectedCity, setSelectedCity] = useState<CityLocation>(PRESET_CITIES[0]); // Delhi, India
  const [telemetry, setTelemetry] = useState<AirQualityTelemetry | null>(null);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(true);

  const [profile, setProfile] = useState<HouseholdProfile>({
    sensitivities: ['general_adult', 'child_infant'],
    commuteMode: 'public_transit',
    homeSetup: ['gas_stove', 'natural_ventilation'],
  });
  const [isProfileExpanded, setIsProfileExpanded] = useState<boolean>(false);

  const [completedRoutineIds, setCompletedRoutineIds] = useState<string[]>([]);
  const [swaps, setSwaps] = useState<HabitSwapState>({
    commuteSwap: true,
    commuteKmPerDay: 14,
    cookingSwap: true,
    wasteSwap: false,
    maskSwap: true,
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingVayuPrompt, setPendingVayuPrompt] = useState<string | null>(null);
  const [isVayuDrawerOpen, setIsVayuDrawerOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadTelemetry = useCallback(async (city: CityLocation) => {
    setIsLoadingTelemetry(true);
    const data = await fetchAirQuality(city);
    setTelemetry(data);
    setIsLoadingTelemetry(false);
  }, []);

  useEffect(() => {
    loadTelemetry(selectedCity);
  }, [selectedCity, loadTelemetry]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  const copyTextToClipboard = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        showToast('Copied Family Smog Brief to clipboard!');
      } catch {
        showToast('Brief ready — select text in Impact & Swaps to copy.');
      }
    },
    [showToast]
  );

  const handleHeaderCopyBrief = useCallback(() => {
    const cityName = telemetry?.city.name ?? selectedCity.name;
    const aqi = telemetry?.current.usAqi ?? 150;
    const sev = getAqiSeverity(aqi);
    const pm25 = telemetry?.current.pm25 ?? 55;
    const safeWin = telemetry?.safestWindow.label ?? '13:00 – 16:00';
    const peakWin = telemetry?.peakSmogWindow.label ?? '06:00 – 09:00';

    const brief = [
      `VayuShield Daily Air Brief — ${cityName}`,
      `Live US AQI: ${aqi} (${sev.label}) · PM2.5: ${pm25} µg/m³`,
      `Safest Outdoor Window: ${safeWin}`,
      `Peak Smog Alert Hours: ${peakWin}`,
      ``,
      `Top 3 Family Actions Today:`,
      `1. Schedule outdoor errands strictly inside ${safeWin}.`,
      `2. Wear a snug N95/FFP2 respirator outdoors during commute hours.`,
      `3. Keep windows sealed during peak smog (${peakWin}) and run kitchen exhaust while cooking.`,
    ].join('\n');

    copyTextToClipboard(brief);
  }, [telemetry, selectedCity.name, copyTextToClipboard]);

  const handleAskVayuFromRadar = (question: string) => {
    setPendingVayuPrompt(question);
    setIsVayuDrawerOpen(true);
  };

  const handleToggleRoutineDone = (id: string) => {
    setCompletedRoutineIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 3-Zone Editorial Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('radar')}
            className="text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            VayuShield AI
          </button>

          {/* Zone 2: 5 Clean Single-Line Nav Tabs */}
          <nav
            aria-label="Primary sections"
            className="hidden md:flex items-center gap-6 h-full"
          >
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative h-full inline-flex items-center text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-teal-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-teal-700 rounded-t" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleHeaderCopyBrief}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Copy Family Brief</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Strip (compact, single-row horizontal scroll) */}
        <nav
          aria-label="Mobile sections"
          className="md:hidden border-t border-slate-100 px-3 py-1.5 flex items-center gap-1 overflow-x-auto bg-white"
        >
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pb-12">
        {/* Global City & Live Sync Toolbar */}
        <CitySearchBar
          selectedCity={selectedCity}
          onSelectCity={(city) => {
            setSelectedCity(city);
            setCompletedRoutineIds([]);
          }}
          onRefresh={() => loadTelemetry(selectedCity)}
          isLoading={isLoadingTelemetry}
        />

        {/* Module 2: Household & Sensitivity Profile Engine */}
        <div className="mt-4">
          <HouseholdProfileDrawer
            profile={profile}
            onChange={setProfile}
            isExpanded={isProfileExpanded}
            onToggleExpand={() => setIsProfileExpanded((prev) => !prev)}
            onApplyToRoutine={() => {
              setIsProfileExpanded(false);
              setActiveTab('routine');
            }}
          />
        </div>

        {/* Active Module Viewport */}
        <div className="mt-6">
          {activeTab === 'radar' && (
            <SmogRadarDashboard
              telemetry={telemetry}
              profile={profile}
              isLoading={isLoadingTelemetry}
              onRetry={() => loadTelemetry(selectedCity)}
              onAskVayuQuestion={handleAskVayuFromRadar}
            />
          )}

          {activeTab === 'routine' && (
            <DailyRoutinePlanner
              telemetry={telemetry}
              profile={profile}
              completedIds={completedRoutineIds}
              onToggleComplete={handleToggleRoutineDone}
              onResetCompleted={() => setCompletedRoutineIds([])}
            />
          )}

          {activeTab === 'iaq' && (
            <IndoorAirLab telemetry={telemetry} profile={profile} />
          )}

          {activeTab === 'impact' && (
            <ImpactSimulator
              telemetry={telemetry}
              profile={profile}
              swaps={swaps}
              onChangeSwaps={setSwaps}
              onCopyBrief={copyTextToClipboard}
            />
          )}

          {activeTab === 'vayu' && (
            <VayuChatbot
              telemetry={telemetry}
              profile={profile}
              messages={chatMessages}
              onUpdateMessages={setChatMessages}
              pendingPrompt={pendingVayuPrompt}
              onConsumePendingPrompt={() => setPendingVayuPrompt(null)}
            />
          )}

          {activeTab === 'test' && <ApiTestChat />}
        </div>
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            VayuShield AI · Live air quality telemetry via Open-Meteo Global Atmospheric Models
          </span>
          <span>
            Personalized health guidance is informational; consult a physician for acute respiratory symptoms.
          </span>
        </div>
      </footer>

      {/* Slide-Over Vayu Assistant Drawer (when invoked from Radar or quick inspection) */}
      {isVayuDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Vayu Pollution Guardian Assistant"
        >
          <div className="w-full max-w-lg h-full bg-slate-50 border-l border-slate-200 shadow-2xl flex flex-col p-4">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold text-slate-600">
                Quick Assistant Drawer
              </span>
              <button
                type="button"
                onClick={() => setIsVayuDrawerOpen(false)}
                aria-label="Close Vayu assistant drawer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <VayuChatbot
                telemetry={telemetry}
                profile={profile}
                messages={chatMessages}
                onUpdateMessages={setChatMessages}
                pendingPrompt={pendingVayuPrompt}
                onConsumePendingPrompt={() => setPendingVayuPrompt(null)}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
