import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { FormattedMessage } from './FormattedMessage';
import { API_BASE } from '../services/api';

interface TestMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  model?: string;
  latencyMs?: number;
  isError?: boolean;
  timestamp: string;
}

export function ApiTestChat() {
  const [messages, setMessages] = useState<TestMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        '⚡ Welcome to the Groq API Test Console! Type any message below and click Send to test if your Groq API key and model respond properly.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('openai/gpt-oss-120b');
  const [isLoading, setIsLoading] = useState(false);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    const userMsgId = `u-${Date.now()}`;
    const userMsg: TestMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    const start = Date.now();

    try {
      // 1. Try dedicated test-chat endpoint first
      let replyText = '';
      let usedModel = selectedModel;
      let latency = 0;

      const res = await fetch(`${API_BASE}/api/test-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: selectedModel }),
      });

      if (res.status === 404) {
        // Fallback: If dev server wasn't restarted yet, call /api/ai/chat directly
        const streamRes = await fetch(`${API_BASE}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });

        if (!streamRes.ok) {
          const contentType = streamRes.headers.get('content-type') || '';
          let errText = `Server returned status ${streamRes.status}`;
          if (!contentType.includes('text/event-stream')) {
            const raw = await streamRes.text();
            const snippet = raw.slice(0, 150).replace(/<[^>]*>/g, '').trim();
            if (snippet) errText += `: ${snippet}`;
          }
          throw new Error(errText);
        }

        const reader = streamRes.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
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
              if (payload === '[DONE]') break;
              try {
                const parsed = JSON.parse(payload) as { text?: string; error?: string };
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.text) replyText += parsed.text;
              } catch (e) {
                if (e instanceof Error && !e.message.includes('JSON')) throw e;
              }
            }
          }
        }
        latency = Date.now() - start;
      } else {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const rawText = await res.text();
          const cleanSnippet = rawText.slice(0, 150).replace(/<[^>]*>/g, '').trim();
          throw new Error(
            `API returned status ${res.status} (${cleanSnippet || 'HTML response'}). ` +
              (res.status === 404
                ? 'Please ensure Vercel serverless functions and GROQ_API_KEY are configured.'
                : '')
          );
        }
        const data = await res.json();
        latency = data.latencyMs ?? Date.now() - start;
        if (!res.ok || !data.ok) {
          throw new Error(data.error || data.rawError || 'Groq API call failed');
        }
        replyText = data.reply || '(Empty response)';
        usedModel = data.model || selectedModel;
      }

      setLastLatency(latency);
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          content: replyText,
          model: usedModel,
          latencyMs: latency,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      const latency = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          content: `⚠️ API Error: ${errorMsg}`,
          isError: true,
          model: selectedModel,
          latencyMs: latency,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    'Hello! Confirm you are online and working in 5 words.',
    'What is 15 * 8? Just reply with the number.',
    'Tell me a one-line clean science joke.',
    'What is the formula for ozone?',
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px] max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Groq API Test Console</h2>
              <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/30">
                Groq Ultra-Fast
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Directly tests Groq API response (openai/gpt-oss-120b) with zero overhead.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastLatency !== null && (
            <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 border border-slate-700">
              <Clock className="w-3.5 h-3.5" />
              <span>{lastLatency}ms</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Model Selector & Quick Chips */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Test Model:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Groq · Primary)</option>
            <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Groq · Fast)</option>
            <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Groq · Ultra-Fast)</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 text-[11px]">Quick tests:</span>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isLoading}
              onClick={() => sendMessage(prompt)}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white hover:bg-teal-50 hover:text-teal-800 border border-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {prompt.length > 28 ? prompt.slice(0, 26) + '…' : prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'model' && (
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  msg.isError
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                {msg.isError ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
            )}

            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none'
                  : msg.isError
                  ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-tl-none'
                  : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
              }`}
            >
              <div>
                <FormattedMessage content={msg.content} isDark={msg.role === 'user'} />
              </div>

              <div
                className={`mt-2 pt-2 border-t flex items-center justify-between gap-3 text-[10px] font-mono ${
                  msg.role === 'user'
                    ? 'border-slate-800 text-slate-400'
                    : msg.isError
                    ? 'border-rose-200 text-rose-600'
                    : 'border-slate-100 text-slate-400'
                }`}
              >
                <span>{msg.role === 'user' ? 'You' : 'Groq AI'} · {msg.timestamp}</span>
                {msg.model && (
                  <span className="flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    {msg.model} {msg.latencyMs ? `(${msg.latencyMs}ms)` : ''}
                  </span>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="p-2 rounded-xl bg-slate-900 text-white shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="p-2 rounded-xl bg-teal-100 text-teal-800 border border-teal-200 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-500 shadow-xs flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-teal-600 animate-bounce" />
              <span className="inline-block w-2 h-2 rounded-full bg-teal-600 animate-bounce [animation-delay:0.2s]" />
              <span className="inline-block w-2 h-2 rounded-full bg-teal-600 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-2 font-medium text-slate-700">
                Sending prompt to {selectedModel}...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-end gap-3"
        >
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Type your test message here (Press Enter to send)..."
              rows={2}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
