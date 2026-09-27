import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Trash2,
  Mail,
  Bot,
  ChevronDown,
  Check,
  Sparkles,
  Zap,
  Cpu,
  Brain,
  Layers,
} from 'lucide-react';
import {
  ProviderId,
  PROVIDERS,
  PROVIDER_MODELS,
  getSelectedModel,
  setSelectedModel,
  getStoredKey,
} from '../services/aiProviders';
import { isEmailConfigured } from '../services/emailService';

interface TopBarProps {
  selectedProvider: ProviderId;
  onSelectProvider: (provider: ProviderId) => void;
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  onOpenSettings: () => void;
  onOpenEmail: () => void;
  onClearChat: () => void;
  hasMessages: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  selectedProvider,
  onSelectProvider,
  currentModel,
  onSelectModel,
  onOpenSettings,
  onOpenEmail,
  onClearChat,
  hasMessages,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const emailReady = isEmailConfigured();
  const providerKeys = (Object.keys(PROVIDERS) as ProviderId[]).map((p) => ({
    id: p,
    hasKey: Boolean(getStoredKey(p)),
  }));

  const allProvidersList: ProviderId[] = ['gpt', 'claude', 'gemini', 'grok'];
  const availableModels = PROVIDER_MODELS[selectedProvider];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleChooseModel = (modelId: string) => {
    setSelectedModel(selectedProvider, modelId);
    onSelectModel(modelId);
    setModelDropdownOpen(false);
  };

  const handleCustomModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customModelInput.trim()) {
      handleChooseModel(customModelInput.trim());
      setCustomModelInput('');
    }
  };

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 shrink-0">
      {/* Left: App Title */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 p-0.5 shadow-md shadow-indigo-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <h1 className="font-semibold text-zinc-100 text-base tracking-tight">ModelHub</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
              v1.1
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 hidden md:block">Unified Multi-Model Gateway</p>
        </div>
      </div>

      {/* Middle: Provider Switcher & Model Selector Dropdown */}
      <div className="flex items-center space-x-2">
        {/* Provider Segmented Control */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-inner">
          {allProvidersList.map((pId) => {
            const isSelected = selectedProvider === pId;
            const config = PROVIDERS[pId];
            const hasKey = providerKeys.find((k) => k.id === pId)?.hasKey;

            return (
              <button
                key={pId}
                type="button"
                onClick={() => {
                  onSelectProvider(pId);
                  const remembered = getSelectedModel(pId);
                  onSelectModel(remembered);
                }}
                className={`relative px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title={`${config.name} ${hasKey ? '• Key ready' : '• No API key'}`}
              >
                <span>{config.name}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hasKey ? 'bg-emerald-400 ring-1 ring-emerald-500/40' : 'bg-zinc-600'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Specific Model Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setModelDropdownOpen((prev) => !prev)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition-all shadow-sm group"
            title="Click to change model variant"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-zinc-100 max-w-[120px] sm:max-w-[150px] truncate">
              {currentModel}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform ${
                modelDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Model Options Menu */}
          {modelDropdownOpen && (
            <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 sm:w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-zinc-800/80 mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Layers className="w-3 h-3 text-indigo-400" />
                  <span>{PROVIDERS[selectedProvider].name} Models</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {availableModels.length} variants
                </span>
              </div>

              {/* Models list */}
              <div className="max-h-60 overflow-y-auto space-y-1 p-0.5">
                {availableModels.map((opt) => {
                  const isCurrent = currentModel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChooseModel(opt.id)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between group ${
                        isCurrent
                          ? 'bg-zinc-800/90 border border-zinc-700 text-white'
                          : 'hover:bg-zinc-900 border border-transparent text-zinc-300 hover:text-white'
                      }`}
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-semibold">{opt.name}</span>
                          {opt.tag && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                opt.tag === 'Flagship'
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  : opt.tag === 'Fast'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {opt.tag}
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <p className="text-[10px] text-zinc-500 group-hover:text-zinc-400 truncate">
                            {opt.description}
                          </p>
                        )}
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Model Input */}
              <form
                onSubmit={handleCustomModelSubmit}
                className="mt-2 pt-2 border-t border-zinc-800/80 p-1"
              >
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="Custom model id (e.g. o1-preview)..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!customModelInput.trim()}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium text-zinc-200 transition-colors"
                  >
                    Set
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Email drawer button */}
        <button
          type="button"
          onClick={onOpenEmail}
          disabled={!emailReady}
          title={emailReady ? 'Open Gmail Integration' : 'Connect email in Settings first'}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            emailReady
              ? 'bg-zinc-900 text-zinc-200 border-zinc-700/80 hover:bg-zinc-800 hover:text-white'
              : 'bg-zinc-900/40 text-zinc-600 border-zinc-800/50 cursor-not-allowed opacity-60'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Email</span>
        </button>

        {/* Clear chat button */}
        <button
          type="button"
          onClick={onClearChat}
          disabled={!hasMessages}
          title="Clear chat history"
          className={`p-2 rounded-lg text-xs font-medium transition-all border ${
            hasMessages
              ? 'text-zinc-400 border-zinc-800 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30'
              : 'text-zinc-700 border-zinc-800/40 cursor-not-allowed opacity-40'
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings & API Keys"
          className="p-2 rounded-lg text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all relative"
        >
          <Settings className="w-4 h-4" />
          {!providerKeys.some((k) => k.hasKey) && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-zinc-950 animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
