export type ProviderId = 'gpt' | 'claude' | 'gemini' | 'grok';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  provider?: ProviderId;
  modelUsed?: string;
  timestamp: number;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
  isError?: boolean;
  canRetry?: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  tag?: string;
  description?: string;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  badge: string;
  color: string;
  defaultModel: string;
  storageKey: string;
  placeholder: string;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  gpt: {
    id: 'gpt',
    name: 'GPT',
    badge: 'OpenAI',
    color: 'emerald',
    defaultModel: 'gpt-5.5',
    storageKey: 'modelhub_openai_key',
    placeholder: 'sk-proj-...',
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    badge: 'Anthropic',
    color: 'amber',
    defaultModel: 'claude-sonnet-5',
    storageKey: 'modelhub_anthropic_key',
    placeholder: 'sk-ant-api03-...',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    badge: 'Google',
    color: 'blue',
    defaultModel: 'gemini-3.8-flash',
    storageKey: 'modelhub_google_key',
    placeholder: 'AIzaSy...',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    badge: 'xAI',
    color: 'purple',
    defaultModel: 'grok-4.7',
    storageKey: 'modelhub_xai_key',
    placeholder: 'xai-...',
  },
};

export const PROVIDER_MODELS: Record<ProviderId, ModelOption[]> = {
  gpt: [
    { id: 'gpt-5.5', name: 'GPT-5.5', tag: 'Flagship', description: 'Next-generation reasoning & versatile intelligence' },
    { id: 'gpt-4o', name: 'GPT-4o', tag: 'Omni', description: 'Fast, multimodal flagship' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast', description: 'Affordable, low latency & efficient' },
    { id: 'o3-mini', name: 'o3-mini', tag: 'Reasoning', description: 'Advanced STEM & coding reasoning' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: 'Legacy', description: 'High capability model with 128k context' },
  ],
  claude: [
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', tag: 'Flagship', description: 'Next-gen Sonnet reasoning & coding' },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', tag: 'Hybrid', description: 'Hybrid reasoning and instant response' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Popular', description: 'Gold standard for software engineering' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Fast', description: 'High speed, lightweight responses' },
  ],
  gemini: [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Flagship', description: 'Next-gen intelligence, high speed & versatile quality' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tag: 'Reasoning', description: 'Advanced reasoning, STEM, math & complex coding' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', tag: 'Ultra-Fast', description: 'Lowest latency & maximum efficiency' },
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', tag: 'Latest', description: 'Always points to the latest Gemini Flash release' },
  ],
  grok: [
    { id: 'grok-4.7', name: 'Grok 4.7', tag: 'Flagship', description: 'xAI latest frontier intelligence' },
    { id: 'grok-2', name: 'Grok 2', tag: 'Standard', description: 'High performance frontier model' },
    { id: 'grok-2-mini', name: 'Grok 2 Mini', tag: 'Fast', description: 'Fast, lightweight Grok variant' },
    { id: 'grok-beta', name: 'Grok Beta', tag: 'Beta', description: 'Public experimental release' },
  ],
};

export function getSelectedModel(provider: ProviderId): string {
  const saved = localStorage.getItem(`modelhub_model_${provider}`);
  if (saved && saved.trim()) {
    const val = saved.trim();
    // Auto-migrate retired/deprecated Gemini models
    if (provider === 'gemini') {
      if (
        val.startsWith('gemini-1.5') ||
        val.startsWith('gemini-2.0') ||
        val.startsWith('gemini-2.5') ||
        val === 'gemini-pro'
      ) {
        localStorage.setItem(`modelhub_model_${provider}`, 'gemini-3.8-flash');
        return 'gemini-3.8-flash';
      }
    }
    return val;
  }
  return PROVIDERS[provider].defaultModel;
}

export function setSelectedModel(provider: ProviderId, modelId: string): void {
  if (modelId && modelId.trim()) {
    localStorage.setItem(`modelhub_model_${provider}`, modelId.trim());
  }
}

export function getStoredKey(provider: ProviderId): string {
  const key = localStorage.getItem(PROVIDERS[provider].storageKey) || '';
  if (!key && provider === 'gemini') {
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  }
  return key;
}

export function getBackendUrl(): string {
  const custom = localStorage.getItem('modelhub_backend_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/$/, '');
  }
  return '';
}

export interface SendMessageOptions {
  provider: ProviderId;
  model?: string;
  conversation: ChatMessage[];
  newUserMessage: string;
  documentContext?: { name: string; text: string; truncated: boolean } | null;
  searchResults?: Array<{ title: string; url: string; snippet?: string }> | null;
}

export async function executeAiCompletion(options: SendMessageOptions): Promise<string> {
  const { provider, model, conversation, newUserMessage, documentContext, searchResults } = options;
  const apiKey = getStoredKey(provider).trim();

  if (!apiKey) {
    const error = new Error(`MISSING_KEY:${provider}`);
    throw error;
  }

  const selectedModel = model || getSelectedModel(provider);
  const backendUrl = getBackendUrl();

  // Assemble system prompts (document grounding + web search context)
  const systemPromptChunks: string[] = [];

  if (documentContext && documentContext.text) {
    const truncNote = documentContext.truncated
      ? '[Note: document was truncated to fit context — showing first ~60,000 characters]\n\n'
      : '';
    systemPromptChunks.push(
      `The user has shared a document titled '${documentContext.name}'. Use it to answer their questions when relevant. Document content:\n\n${truncNote}${documentContext.text}`
    );
  }

  if (searchResults && searchResults.length > 0) {
    const resultsFormatted = searchResults
      .map((r, i) => `${i + 1}. Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet || ''}`)
      .join('\n\n');
    systemPromptChunks.push(`Web search results for reference:\n${resultsFormatted}`);
  }

  const combinedSystemPrompt = systemPromptChunks.join('\n\n---\n\n');

  // Build standard chat history
  const standardMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  if (combinedSystemPrompt) {
    standardMessages.push({ role: 'system', content: combinedSystemPrompt });
  }

  for (const msg of conversation) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      standardMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  standardMessages.push({ role: 'user', content: newUserMessage });

  // 1. Anthropic Claude (Routed via backend relay per Part B & Step 5)
  if (provider === 'claude') {
    return await callRelayBackend(backendUrl, 'anthropic', apiKey, standardMessages, selectedModel);
  }

  // 2. OpenAI GPT
  if (provider === 'gpt') {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: standardMessages,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => null);
        throw new Error(errorData?.error?.message || `OpenAI returned status ${resp.status}`);
      }

      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) {
        throw new Error('OpenAI returned an empty response.');
      }
      return reply;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('CORS')) {
        try {
          return await callRelayBackend(backendUrl, 'openai', apiKey, standardMessages, selectedModel);
        } catch {
          // fallback
        }
      }
      throw err;
    }
  }

  // 3. Google Gemini (Routed through server relay using @google/genai SDK)
  if (provider === 'gemini') {
    return await callRelayBackend(backendUrl, 'google', apiKey, standardMessages, selectedModel);
  }

  // 4. xAI Grok
  if (provider === 'grok') {
    try {
      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: standardMessages,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => null);
        throw new Error(errorData?.error?.message || `xAI Grok returned status ${resp.status}`);
      }

      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) {
        throw new Error('Grok returned an empty response.');
      }
      return reply;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError')) {
        try {
          return await callRelayBackend(backendUrl, 'xai', apiKey, standardMessages, selectedModel);
        } catch {
          // fallback
        }
      }
      throw err;
    }
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function callRelayBackend(
  backendUrl: string,
  provider: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<string> {
  const endpoint = `${backendUrl}/api/chat`;
  
  let resp: globalThis.Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        apiKey,
        messages,
        model,
      }),
    });
  } catch (netErr: any) {
    throw new Error(
      `Could not reach backend relay at "${endpoint}". Please make sure the server is running or check your Backend Relay URL in Settings.`
    );
  }

  const data = await resp.json().catch(() => null);

  if (!resp.ok || data?.error) {
    throw new Error(data?.error || `Relay server error (${resp.status})`);
  }

  if (!data?.reply) {
    throw new Error('Relay server returned an empty reply.');
  }

  return data.reply;
}

// ---------- API Key Connection Tester ----------
export interface TestKeyResult {
  success: boolean;
  latencyMs?: number;
  message?: string;
  error?: string;
}

export async function testApiKeyConnection(
  provider: ProviderId | 'tavily',
  apiKey: string,
  model?: string
): Promise<TestKeyResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'Please enter an API key first.' };
  }

  const cleanKey = apiKey.trim();
  const backendUrl = getBackendUrl();
  const startTime = Date.now();

  // Try via backend relay test endpoint first
  try {
    const testResp = await fetch(`${backendUrl}/api/test-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider === 'tavily' ? 'tavily' : provider === 'gpt' ? 'openai' : provider === 'claude' ? 'anthropic' : provider === 'gemini' ? 'google' : 'xai',
        apiKey: cleanKey,
        model: model || (provider !== 'tavily' ? getSelectedModel(provider) : undefined),
      }),
    });

    const data = await testResp.json().catch(() => null);
    if (testResp.ok && data?.success) {
      return {
        success: true,
        latencyMs: data.latencyMs ?? (Date.now() - startTime),
        message: data.message || 'Key connected successfully!',
      };
    } else if (data?.error) {
      return {
        success: false,
        error: data.error,
      };
    }
  } catch {
    // If backend endpoint is unreachable, fallback to direct browser validation
  }

  // Fallback direct browser testing
  try {
    if (provider === 'gpt') {
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      const latencyMs = Date.now() - startTime;
      if (resp.ok) {
        return { success: true, latencyMs, message: 'Connected to OpenAI!' };
      }
      const err = await resp.json().catch(() => null);
      return { success: false, error: err?.error?.message || `OpenAI returned status ${resp.status}` };
    }

    if (provider === 'gemini') {
      const targetModel = model || getSelectedModel('gemini');
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping' }] }] }),
        }
      );
      const latencyMs = Date.now() - startTime;
      if (resp.ok) {
        return { success: true, latencyMs, message: 'Connected to Google Gemini!' };
      }
      const err = await resp.json().catch(() => null);
      return { success: false, error: err?.error?.message || `Gemini returned status ${resp.status}` };
    }

    if (provider === 'grok') {
      const resp = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      const latencyMs = Date.now() - startTime;
      if (resp.ok) {
        return { success: true, latencyMs, message: 'Connected to xAI Grok!' };
      }
      const err = await resp.json().catch(() => null);
      return { success: false, error: err?.error?.message || `xAI returned status ${resp.status}` };
    }

    if (provider === 'tavily') {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: cleanKey, query: 'test', max_results: 1 }),
      });
      const latencyMs = Date.now() - startTime;
      if (resp.ok) {
        return { success: true, latencyMs, message: 'Connected to Tavily Search!' };
      }
      const err = await resp.json().catch(() => null);
      return { success: false, error: err?.message || `Tavily returned status ${resp.status}` };
    }

    return { success: false, error: 'Could not test key directly.' };
  } catch (directErr: any) {
    return { success: false, error: directErr.message || 'Network connection failed' };
  }
}
