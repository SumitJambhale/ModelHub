import { getBackendUrl } from './aiProviders';

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

export function getTavilyKey(): string {
  return localStorage.getItem('modelhub_tavily_key') || '';
}

export async function performWebSearch(query: string): Promise<SearchResult[]> {
  const apiKey = getTavilyKey().trim();
  if (!apiKey) {
    throw new Error('MISSING_TAVILY_KEY');
  }

  const backendUrl = getBackendUrl();

  // Try direct browser call first
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: 'basic',
        include_answer: false,
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => null);
      throw new Error(errData?.message || `Tavily returned status ${resp.status}`);
    }

    const data = await resp.json();
    return formatResults(data);
  } catch (directErr: any) {
    // If CORS or network issue, fallback to backend proxy
    try {
      const proxyResp = await fetch(`${backendUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          query,
          maxResults: 5,
        }),
      });

      if (!proxyResp.ok) {
        const pErr = await proxyResp.json().catch(() => null);
        throw new Error(pErr?.error || `Search proxy error (${proxyResp.status})`);
      }

      const pData = await proxyResp.json();
      return formatResults(pData);
    } catch {
      throw directErr;
    }
  }
}

function formatResults(data: any): SearchResult[] {
  const list = data?.results || [];
  return list.slice(0, 5).map((item: any) => ({
    title: item.title || 'Untitled Result',
    url: item.url || '#',
    snippet: item.content || item.snippet || '',
  }));
}
