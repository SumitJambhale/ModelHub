import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Key,
  Mail,
  Server,
  ShieldCheck,
  Check,
  ExternalLink,
  RefreshCw,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlayCircle,
} from 'lucide-react';
import {
  PROVIDERS,
  PROVIDER_MODELS,
  ProviderId,
  getBackendUrl,
  testApiKeyConnection,
  TestKeyResult,
  getSelectedModel,
  setSelectedModel,
} from '../services/aiProviders';
import { fetchRecentEmails } from '../services/emailService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHighlightProvider?: ProviderId | 'tavily' | 'email';
  onModelChange?: (provider: ProviderId, modelId: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialHighlightProvider,
  onModelChange,
}) => {
  // Key states
  const [keys, setKeys] = useState<{
    openai: string;
    anthropic: string;
    google: string;
    xai: string;
    tavily: string;
    emailAddress: string;
    emailAppPassword: string;
    backendUrl: string;
  }>({
    openai: '',
    anthropic: '',
    google: '',
    xai: '',
    tavily: '',
    emailAddress: '',
    emailAppPassword: '',
    backendUrl: '',
  });

  // Selected models per provider
  const [selectedModels, setSelectedModelsState] = useState<Record<ProviderId, string>>({
    gpt: 'gpt-5.5',
    claude: 'claude-sonnet-5',
    gemini: 'gemini-3.8-flash',
    grok: 'grok-4.7',
  });

  // Reveal toggles
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Test states for each key
  const [testResults, setTestResults] = useState<
    Record<string, { loading: boolean; result?: TestKeyResult }>
  >({});

  // Relay test
  const [relayStatus, setRelayStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [relayMessage, setRelayMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setKeys({
        openai: localStorage.getItem('modelhub_openai_key') || '',
        anthropic: localStorage.getItem('modelhub_anthropic_key') || '',
        google: localStorage.getItem('modelhub_google_key') || '',
        xai: localStorage.getItem('modelhub_xai_key') || '',
        tavily: localStorage.getItem('modelhub_tavily_key') || '',
        emailAddress: localStorage.getItem('modelhub_email_address') || '',
        emailAppPassword: localStorage.getItem('modelhub_email_app_password') || '',
        backendUrl: localStorage.getItem('modelhub_backend_url') || '',
      });

      setSelectedModelsState({
        gpt: getSelectedModel('gpt'),
        claude: getSelectedModel('claude'),
        gemini: getSelectedModel('gemini'),
        grok: getSelectedModel('grok'),
      });

      setSaveNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = (field: string, storageKey: string, value: string) => {
    setKeys((prev) => ({ ...prev, [field]: value }));
    if (value.trim()) {
      localStorage.setItem(storageKey, value.trim());
    } else {
      localStorage.removeItem(storageKey);
    }
    // Clear previous test result for this field
    setTestResults((prev) => ({ ...prev, [field]: { loading: false } }));
    setSaveNotice('Saved to local storage');
    setTimeout(() => setSaveNotice(null), 2000);
  };

  const handleModelSelect = (provider: ProviderId, modelId: string) => {
    setSelectedModelsState((prev) => ({ ...prev, [provider]: modelId }));
    setSelectedModel(provider, modelId);
    onModelChange?.(provider, modelId);
    setSaveNotice(`Model updated to ${modelId}`);
    setTimeout(() => setSaveNotice(null), 2000);
  };

  const toggleShow = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Test individual API Key
  const handleTestKey = async (provider: ProviderId | 'tavily', keyVal: string, fieldKey: string) => {
    if (!keyVal || !keyVal.trim()) {
      setTestResults((prev) => ({
        ...prev,
        [fieldKey]: {
          loading: false,
          result: { success: false, error: 'Please enter an API key first' },
        },
      }));
      return;
    }

    setTestResults((prev) => ({
      ...prev,
      [fieldKey]: { loading: true },
    }));

    try {
      const model = provider !== 'tavily' ? selectedModels[provider] : undefined;
      const res = await testApiKeyConnection(provider, keyVal, model);
      setTestResults((prev) => ({
        ...prev,
        [fieldKey]: { loading: false, result: res },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [fieldKey]: {
          loading: false,
          result: { success: false, error: err.message || 'Connection failed' },
        },
      }));
    }
  };

  // Test Email Credentials
  const handleTestEmail = async () => {
    if (!keys.emailAddress || !keys.emailAppPassword) {
      setTestResults((prev) => ({
        ...prev,
        email: {
          loading: false,
          result: { success: false, error: 'Please provide both Gmail Address and App Password' },
        },
      }));
      return;
    }

    setTestResults((prev) => ({
      ...prev,
      email: { loading: true },
    }));

    const startTime = Date.now();
    try {
      const emails = await fetchRecentEmails();
      const latencyMs = Date.now() - startTime;
      setTestResults((prev) => ({
        ...prev,
        email: {
          loading: false,
          result: {
            success: true,
            latencyMs,
            message: `IMAP connection verified! Found ${emails.length} recent messages in INBOX.`,
          },
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        email: {
          loading: false,
          result: {
            success: false,
            error: err.message || 'Could not connect to Gmail IMAP',
          },
        },
      }));
    }
  };

  const testRelay = async () => {
    setRelayStatus('checking');
    setRelayMessage('Checking relay...');
    try {
      const url = getBackendUrl();
      const resp = await fetch(`${url}/api/health`);
      if (resp.ok) {
        setRelayStatus('ok');
        setRelayMessage('Relay server is online and operational!');
      } else {
        setRelayStatus('error');
        setRelayMessage(`Relay returned status ${resp.status}`);
      }
    } catch (err: any) {
      setRelayStatus('error');
      setRelayMessage(err.message || 'Cannot reach relay server');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center">
              <Key className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Settings & BYOK</h2>
              <p className="text-xs text-zinc-400">Model selection and connection verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save notice badge */}
        {saveNotice && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-1.5 text-xs text-emerald-400 flex items-center space-x-1.5 animate-fadeIn">
            <Check className="w-3.5 h-3.5" />
            <span>{saveNotice}</span>
          </div>
        )}

        {/* Content body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
          {/* Section 1: AI Provider Keys & Model Selectors */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Model Providers & API Keys
              </h3>
              <span className="text-[11px] text-zinc-500">Test keys directly below</span>
            </div>

            {/* 1. OpenAI Card */}
            <div
              className={`space-y-2.5 p-3.5 rounded-xl border transition-all ${
                initialHighlightProvider === 'gpt'
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                  : 'border-zinc-800/80 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold">OpenAI API Key</span>
                </label>
                <div className="flex items-center space-x-2">
                  {/* Model variant selector */}
                  <select
                    value={selectedModels.gpt}
                    onChange={(e) => handleModelSelect('gpt', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-[11px] font-mono rounded px-2 py-1 text-zinc-300 focus:outline-none"
                  >
                    {PROVIDER_MODELS.gpt.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tag})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showKey.openai ? 'text' : 'password'}
                  value={keys.openai}
                  onChange={(e) => handleUpdate('openai', 'modelhub_openai_key', e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 pr-9 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('openai')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Test Button & Result */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleTestKey('gpt', keys.openai, 'openai')}
                  disabled={testResults.openai?.loading || !keys.openai}
                  className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition-colors flex items-center space-x-1.5 border border-zinc-700/60"
                >
                  <RefreshCw className={`w-3 h-3 ${testResults.openai?.loading ? 'animate-spin' : ''}`} />
                  <span>{testResults.openai?.loading ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {testResults.openai?.result && (
                  <span
                    className={`text-xs font-medium flex items-center space-x-1 ${
                      testResults.openai.result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResults.openai.result.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Connected {testResults.openai.result.latencyMs ? `(${testResults.openai.result.latencyMs}ms)` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]" title={testResults.openai.result.error}>
                          {testResults.openai.result.error}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Anthropic Claude Card */}
            <div
              className={`space-y-2.5 p-3.5 rounded-xl border transition-all ${
                initialHighlightProvider === 'claude'
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                  : 'border-zinc-800/80 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="font-semibold">Anthropic API Key</span>
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedModels.claude}
                    onChange={(e) => handleModelSelect('claude', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-[11px] font-mono rounded px-2 py-1 text-zinc-300 focus:outline-none"
                  >
                    {PROVIDER_MODELS.claude.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tag})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showKey.anthropic ? 'text' : 'password'}
                  value={keys.anthropic}
                  onChange={(e) => handleUpdate('anthropic', 'modelhub_anthropic_key', e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 pr-9 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('anthropic')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey.anthropic ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Test Button & Result */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleTestKey('claude', keys.anthropic, 'anthropic')}
                  disabled={testResults.anthropic?.loading || !keys.anthropic}
                  className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition-colors flex items-center space-x-1.5 border border-zinc-700/60"
                >
                  <RefreshCw className={`w-3 h-3 ${testResults.anthropic?.loading ? 'animate-spin' : ''}`} />
                  <span>{testResults.anthropic?.loading ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {testResults.anthropic?.result && (
                  <span
                    className={`text-xs font-medium flex items-center space-x-1 ${
                      testResults.anthropic.result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResults.anthropic.result.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Connected {testResults.anthropic.result.latencyMs ? `(${testResults.anthropic.result.latencyMs}ms)` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]" title={testResults.anthropic.result.error}>
                          {testResults.anthropic.result.error}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Google Gemini Card */}
            <div
              className={`space-y-2.5 p-3.5 rounded-xl border transition-all ${
                initialHighlightProvider === 'gemini'
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                  : 'border-zinc-800/80 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="font-semibold">Google Gemini API Key</span>
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedModels.gemini}
                    onChange={(e) => handleModelSelect('gemini', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-[11px] font-mono rounded px-2 py-1 text-zinc-300 focus:outline-none"
                  >
                    {PROVIDER_MODELS.gemini.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tag})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showKey.google ? 'text' : 'password'}
                  value={keys.google}
                  onChange={(e) => handleUpdate('google', 'modelhub_google_key', e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 pr-9 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('google')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey.google ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Test Button & Result */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleTestKey('gemini', keys.google, 'google')}
                  disabled={testResults.google?.loading || !keys.google}
                  className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition-colors flex items-center space-x-1.5 border border-zinc-700/60"
                >
                  <RefreshCw className={`w-3 h-3 ${testResults.google?.loading ? 'animate-spin' : ''}`} />
                  <span>{testResults.google?.loading ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {testResults.google?.result && (
                  <span
                    className={`text-xs font-medium flex items-center space-x-1 ${
                      testResults.google.result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResults.google.result.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Connected {testResults.google.result.latencyMs ? `(${testResults.google.result.latencyMs}ms)` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]" title={testResults.google.result.error}>
                          {testResults.google.result.error}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* 4. xAI Grok Card */}
            <div
              className={`space-y-2.5 p-3.5 rounded-xl border transition-all ${
                initialHighlightProvider === 'grok'
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                  : 'border-zinc-800/80 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-200 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="font-semibold">xAI Grok API Key</span>
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedModels.grok}
                    onChange={(e) => handleModelSelect('grok', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-[11px] font-mono rounded px-2 py-1 text-zinc-300 focus:outline-none"
                  >
                    {PROVIDER_MODELS.grok.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.tag})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showKey.xai ? 'text' : 'password'}
                  value={keys.xai}
                  onChange={(e) => handleUpdate('xai', 'modelhub_xai_key', e.target.value)}
                  placeholder="xai-..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 pr-9 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('xai')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey.xai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Test Button & Result */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleTestKey('grok', keys.xai, 'xai')}
                  disabled={testResults.xai?.loading || !keys.xai}
                  className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition-colors flex items-center space-x-1.5 border border-zinc-700/60"
                >
                  <RefreshCw className={`w-3 h-3 ${testResults.xai?.loading ? 'animate-spin' : ''}`} />
                  <span>{testResults.xai?.loading ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {testResults.xai?.result && (
                  <span
                    className={`text-xs font-medium flex items-center space-x-1 ${
                      testResults.xai.result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResults.xai.result.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Connected {testResults.xai.result.latencyMs ? `(${testResults.xai.result.latencyMs}ms)` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]" title={testResults.xai.result.error}>
                          {testResults.xai.result.error}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Web Search (Tavily) */}
          <div className="space-y-3 pt-3 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Web Search Integration (Tavily)
              </h3>
            </div>
            <div
              className={`space-y-2.5 p-3.5 rounded-xl border transition-all ${
                initialHighlightProvider === 'tavily'
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                  : 'border-zinc-800/80 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200">
                  Tavily API Key (optional, for web search)
                </label>
              </div>
              <div className="relative">
                <input
                  type={showKey.tavily ? 'text' : 'password'}
                  value={keys.tavily}
                  onChange={(e) => handleUpdate('tavily', 'modelhub_tavily_key', e.target.value)}
                  placeholder="tvly-..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 pr-9 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleShow('tavily')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey.tavily ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Test Button & Result */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleTestKey('tavily', keys.tavily, 'tavily')}
                  disabled={testResults.tavily?.loading || !keys.tavily}
                  className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition-colors flex items-center space-x-1.5 border border-zinc-700/60"
                >
                  <RefreshCw className={`w-3 h-3 ${testResults.tavily?.loading ? 'animate-spin' : ''}`} />
                  <span>{testResults.tavily?.loading ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {testResults.tavily?.result && (
                  <span
                    className={`text-xs font-medium flex items-center space-x-1 ${
                      testResults.tavily.result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResults.tavily.result.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Connected ({testResults.tavily.result.latencyMs}ms)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]" title={testResults.tavily.result.error}>
                          {testResults.tavily.result.error}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Gmail IMAP Integration */}
          <div className="space-y-3 pt-3 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                <span>Email (Optional, Read + Draft)</span>
              </h3>
            </div>
            <div
              className={`space-y-3 p-3.5 rounded-xl border transition-all ${
                initialHighlightProvider === 'email'
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                  : 'border-zinc-800/80 bg-zinc-900/40'
              }`}
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-200">Gmail Address</label>
                <input
                  type="email"
                  value={keys.emailAddress}
                  onChange={(e) => handleUpdate('emailAddress', 'modelhub_email_address', e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-200">Gmail App Password</label>
                <div className="relative">
                  <input
                    type={showKey.emailAppPassword ? 'text' : 'password'}
                    value={keys.emailAppPassword}
                    onChange={(e) =>
                      handleUpdate('emailAppPassword', 'modelhub_email_app_password', e.target.value)
                    }
                    placeholder="abcd efgh ijkl mnop"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 pr-9 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('emailAppPassword')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showKey.emailAppPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Test Email Button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testResults.email?.loading || !keys.emailAddress || !keys.emailAppPassword}
                  className="px-2.5 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 font-medium transition-colors flex items-center space-x-1.5 border border-zinc-700/60"
                >
                  <RefreshCw className={`w-3 h-3 ${testResults.email?.loading ? 'animate-spin' : ''}`} />
                  <span>{testResults.email?.loading ? 'Connecting...' : 'Test Mailbox Connection'}</span>
                </button>

                {testResults.email?.result && (
                  <span
                    className={`text-xs font-medium flex items-center space-x-1 ${
                      testResults.email.result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResults.email.result.success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Connected ({testResults.email.result.latencyMs}ms)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]" title={testResults.email.result.error}>
                          {testResults.email.result.error}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1 leading-relaxed">
                <p>
                  Requires 2-Step Verification on your Google Account. Generate an App Password at{' '}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline font-mono"
                  >
                    myaccount.google.com/apppasswords
                  </a>{' '}
                  and paste it here — this is <strong className="text-zinc-200">NOT</strong> your regular Gmail password.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Backend Relay URL */}
          <div className="space-y-3 pt-3 border-t border-zinc-800/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
                <Server className="w-3.5 h-3.5 text-zinc-400" />
                <span>Backend Relay URL (Optional)</span>
              </h3>
            </div>
            <div className="space-y-2 p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
              <input
                type="text"
                value={keys.backendUrl}
                onChange={(e) => handleUpdate('backendUrl', 'modelhub_backend_url', e.target.value)}
                placeholder="Leave blank for built-in server (/api), or https://..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={testRelay}
                  className="px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${relayStatus === 'checking' ? 'animate-spin' : ''}`} />
                  <span>Test Relay Connection</span>
                </button>
                {relayMessage && (
                  <span
                    className={`text-[11px] ${
                      relayStatus === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {relayMessage}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Keys remain strictly in your browser</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-950 font-medium hover:bg-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
