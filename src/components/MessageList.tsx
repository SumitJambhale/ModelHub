import React, { useRef, useEffect, useState } from 'react';
import {
  ChatMessage,
  ProviderId,
  PROVIDERS,
} from '../services/aiProviders';
import {
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  activeProvider: ProviderId;
  onRetry: () => void;
  onOpenSettings: (provider?: ProviderId) => void;
  onSelectPrompt: (promptText: string) => void;
}

const EXAMPLE_PROMPTS = [
  'Summarize the key differences between GPT-5, Claude Sonnet, Gemini Flash, and Grok.',
  'Draft an executive summary based on the uploaded document.',
  'Explain the latest developments in quantum computing with web search.',
];

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  activeProvider,
  onRetry,
  onOpenSettings,
  onSelectPrompt,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSources = (id: string) => {
    setSourcesOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Multi-Model AI Hub</span>
          </div>
          <h2 className="text-3xl font-bold text-zinc-100 tracking-tight sm:text-4xl">
            ModelHub
          </h2>
          <p className="text-sm text-zinc-400 max-w-lg leading-relaxed">
            Chat seamlessly across top AI models, ground answers with your documents, and search the live web.
          </p>
        </div>

        {/* Example Prompt Chips */}
        <div className="w-full space-y-2.5">
          <p className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">
            Suggested Prompts
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-1">
            {EXAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPrompt(prompt)}
                className="text-left p-3.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-all duration-150 group shadow-sm flex items-center justify-between"
              >
                <span className="leading-snug">{prompt}</span>
                <span className="text-zinc-600 group-hover:text-indigo-400 text-sm ml-2 font-mono">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isError = msg.isError || msg.role === 'error';
          const isMissingKey = msg.content.includes('MISSING_KEY') || msg.content.includes('⚠️ Add your');
          const providerConfig = msg.provider ? PROVIDERS[msg.provider] : null;

          if (isError) {
            return (
              <div
                key={msg.id}
                className="flex items-start space-x-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs max-w-2xl animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="font-medium text-rose-300 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  <div className="flex items-center space-x-3 pt-1">
                    {msg.canRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center space-x-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}
                    {isMissingKey && (
                      <button
                        type="button"
                        onClick={() => onOpenSettings(msg.provider)}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        Open Settings
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (isUser) {
            return (
              <div key={msg.id} className="flex flex-col items-end space-y-1">
                <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 bg-zinc-800 text-zinc-100 text-sm whitespace-pre-wrap leading-relaxed shadow-sm border border-zinc-700/60">
                  {msg.content}
                </div>
                <span className="text-[10px] text-zinc-500 px-1 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          }

          // AI message
          const showSources = msg.sources && msg.sources.length > 0;
          const isExpanded = sourcesOpen[msg.id] ?? false;

          return (
            <div key={msg.id} className="flex flex-col items-start space-y-1.5 group">
              {/* Provider & Model Badge */}
              <div className="flex items-center space-x-2 px-1">
                <span className="text-[11px] font-semibold text-zinc-300 flex items-center space-x-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      msg.provider === 'gpt'
                        ? 'bg-emerald-400'
                        : msg.provider === 'claude'
                        ? 'bg-amber-400'
                        : msg.provider === 'gemini'
                        ? 'bg-blue-400'
                        : 'bg-purple-400'
                    }`}
                  />
                  <span>{providerConfig ? providerConfig.name : 'AI'}</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50">
                  {msg.modelUsed || providerConfig?.badge || 'AI'}
                </span>
              </div>

              {/* Message Bubble */}
              <div className="max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed shadow-sm relative">
                {msg.content}

                {/* Sources section if web search was used */}
                {showSources && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleSources(msg.id)}
                      className="flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Sources ({msg.sources?.length})</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {msg.sources?.map((src, sIdx) => {
                          let hostname = '';
                          try {
                            hostname = new URL(src.url).hostname.replace('www.', '');
                          } catch {
                            hostname = 'source';
                          }

                          return (
                            <a
                              key={sIdx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-all group/src"
                            >
                              <div className="truncate pr-2">
                                <p className="font-medium truncate">{src.title}</p>
                                <p className="text-[10px] text-zinc-500 truncate">{src.url}</p>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono group-hover/src:text-indigo-400 shrink-0 flex items-center">
                                {hostname} <ExternalLink className="w-2.5 h-2.5 ml-1" />
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom bar for message */}
              <div className="flex items-center space-x-2 px-1 text-[11px] text-zinc-500">
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="hover:text-zinc-300 flex items-center space-x-1 transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {loading && (
          <div className="flex flex-col items-start space-y-2 animate-in fade-in">
            <div className="flex items-center space-x-2 px-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-xs font-medium text-zinc-400">
                {PROVIDERS[activeProvider].name} is thinking...
              </span>
            </div>
            <div className="rounded-2xl px-5 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs flex items-center space-x-3 shadow-sm">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
              </div>
              <span className="text-zinc-500">Generating response</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
