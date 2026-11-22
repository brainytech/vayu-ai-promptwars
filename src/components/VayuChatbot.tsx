import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  AirQualityTelemetry,
  ChatMessage,
  HouseholdProfile,
} from '../types';
import { streamVayuChat } from '../services/api';
import { calculateRiskMultiplier } from '../utils/airQuality';
import { FormattedMessage } from './FormattedMessage';

interface VayuChatbotProps {
  telemetry: AirQualityTelemetry | null;
  profile: HouseholdProfile;
  messages: ChatMessage[];
  onUpdateMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  pendingPrompt?: string | null;
  onConsumePendingPrompt?: () => void;
  compact?: boolean;
}

export const VayuChatbot: React.FC<VayuChatbotProps> = ({
  telemetry,
  profile,
  messages,
  onUpdateMessages,
  pendingPrompt,
  onConsumePendingPrompt,
  compact = false,
}) => {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const riskMultiplier = useMemo(() => calculateRiskMultiplier(profile), [profile]);

  const quickPrompts = useMemo(() => {
    const cityName = telemetry?.city.name ?? 'my city';
    const hasAsthma = profile.sensitivities.includes('asthma_respiratory');
    const hasElderly = profile.sensitivities.includes('elderly');
    return [
      hasAsthma || hasElderly
        ? `Is it safe for an asthmatic or elderly family member to walk outside in ${cityName} right now?`
        : `Is it safe for a 30-minute outdoor walk in ${cityName} right now?`,
      `How do I stop kitchen smoke and PM2.5 buildup at home tonight?`,
      `When is today's safest outdoor window in ${cityName} and why?`,
      `Which mask and commute change cuts our inhaled PM2.5 dose the most?`,
    ];
  }, [telemetry?.city.name, profile.sensitivities]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isStreaming || !telemetry) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const modelMsgId = `m-${Date.now() + 1}`;
    const placeholderModelMsg: ChatMessage = {
      id: modelMsgId,
      role: 'model',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const historySnapshot = [...messages];
    onUpdateMessages((prev) => [...prev, userMsg, placeholderModelMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      await streamVayuChat(
        {
          message: trimmed,
          history: historySnapshot,
          telemetry,
          profile,
          riskMultiplier,
        },
        (chunk) => {
          onUpdateMessages((prev) =>
            prev.map((m) =>
              m.id === modelMsgId ? { ...m, content: m.content + chunk } : m
            )
          );
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach Vayu right now.';
      setError(msg);
      onUpdateMessages((prev) =>
        prev.filter((m) => m.id !== modelMsgId || m.content.trim().length > 0)
      );
    } finally {
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (pendingPrompt && telemetry && !isStreaming) {
      const prompt = pendingPrompt;
      onConsumePendingPrompt?.();
      sendMessage(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, telemetry]);

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden ${
        compact ? 'h-full' : 'h-[calc(100vh-15rem)] min-h-[540px]'
      }`}
    >
      {/* Context Injection Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-700 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 truncate">
              Vayu · Context-Aware AI Pollution Guardian
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
            Live context: {telemetry?.city.name ?? 'Loading...'} · US AQI{' '}
            {telemetry?.current.usAqi ?? '—'} · PM2.5 {telemetry?.current.pm25 ?? '—'} µg/m³ ·{' '}
            {riskMultiplier.multiplier.toFixed(2)}× Risk Profile
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => onUpdateMessages([])}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Quick Starter Prompts */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-white">
        <div className="text-[11px] font-medium text-slate-500 mb-1.5">
          Quick Questions (click to ask immediately):
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isStreaming || !telemetry}
              onClick={() => sendMessage(prompt)}
              className="text-left px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-teal-50 hover:text-teal-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
            <div className="p-3 rounded-xl bg-teal-50 text-teal-700 mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Ask Vayu anything about today&apos;s air
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Vayu automatically reads {telemetry?.city.name ?? 'your city'}&apos;s live Open-Meteo AQI, dominant pollutant, safe outdoor window, and your household sensitivity profile.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                <div>
                  {msg.content ? (
                    <FormattedMessage content={msg.content} isDark={msg.role === 'user'} />
                  ) : isStreaming && msg.role === 'model' ? (
                    <span className="italic text-slate-400">Thinking...</span>
                  ) : null}
                </div>
                <div
                  className={`mt-1.5 text-[10px] font-mono ${
                    msg.role === 'user' ? 'text-slate-400' : 'text-slate-400'
                  }`}
                >
                  {msg.role === 'user' ? 'You' : 'Vayu AI'} · {msg.timestamp}
                </div>
              </div>
            </div>
          ))
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask Vayu about ${telemetry?.city.name ?? 'today'}'s AQI, masks, or indoor air...`}
          aria-label="Ask Vayu AI"
          disabled={isStreaming || !telemetry}
          className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim() || !telemetry}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isStreaming ? 'Streaming...' : 'Send'}</span>
        </button>
      </form>
    </div>
  );
};
