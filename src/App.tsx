/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import { SettingsModal } from './components/SettingsModal';
import { EmailDrawer } from './components/EmailDrawer';
import {
  ChatMessage,
  ProviderId,
  PROVIDERS,
  getStoredKey,
  getSelectedModel,
  setSelectedModel,
  executeAiCompletion,
} from './services/aiProviders';
import { performWebSearch, getTavilyKey, SearchResult } from './services/webSearch';
import { ExtractedDoc } from './utils/documentParser';

const CONVERSATION_KEY = 'modelhub_conversation';

export default function App() {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('gpt');
  const [currentModel, setCurrentModel] = useState<string>(() => getSelectedModel('gpt'));
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CONVERSATION_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [attachedDoc, setAttachedDoc] = useState<ExtractedDoc | null>(null);
  const [webSearchActive, setWebSearchActive] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [externalInput, setExternalInput] = useState<string>('');

  // Drawers
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsHighlight, setSettingsHighlight] = useState<ProviderId | 'tavily' | 'email' | undefined>(undefined);
  const [emailOpen, setEmailOpen] = useState(false);

  // Sync messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CONVERSATION_KEY, JSON.stringify(messages));
    } catch {
      // Storage limit or disabled
    }
  }, [messages]);

  const handleSelectProvider = (provider: ProviderId) => {
    setSelectedProvider(provider);
    const model = getSelectedModel(provider);
    setCurrentModel(model);
  };

  const handleSelectModel = (modelId: string) => {
    setCurrentModel(modelId);
    setSelectedModel(selectedProvider, modelId);
  };

  const handleOpenSettings = (provider?: ProviderId | 'tavily' | 'email') => {
    setSettingsHighlight(provider);
    setSettingsOpen(true);
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem(CONVERSATION_KEY);
    setComposerError(null);
  };

  const handleSendMessage = useCallback(
    async (text: string) => {
      setComposerError(null);

      // Check API Key for current provider
      const apiKey = getStoredKey(selectedProvider);
      if (!apiKey) {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'error',
          content: `⚠️ Add your ${PROVIDERS[selectedProvider].name} API key in Settings first`,
          provider: selectedProvider,
          timestamp: Date.now(),
          isError: true,
          canRetry: false,
        };
        setMessages((prev) => [...prev, errorMsg]);
        handleOpenSettings(selectedProvider);
        return;
      }

      // Check Tavily Key if Web Search is active
      let searchResults: SearchResult[] | null = null;
      if (webSearchActive) {
        const tavilyKey = getTavilyKey();
        if (!tavilyKey) {
          setComposerError(
            '⚠️ Add a Tavily API key in Settings to use web search, or turn the toggle off'
          );
          return;
        }

        try {
          searchResults = await performWebSearch(text);
        } catch (searchErr: any) {
          // Graceful fallback per Step 4: Warn and proceed with model call anyway
          const warnMsg: ChatMessage = {
            id: `warn-${Date.now()}`,
            role: 'error',
            content: `⚠️ Web search failed: ${searchErr.message || 'Network error'} — sending your message without search results`,
            timestamp: Date.now(),
            isError: true,
            canRetry: false,
          };
          setMessages((prev) => [...prev, warnMsg]);
          searchResults = null;
        }
      }

      // Append user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setLoading(true);

      try {
        const reply = await executeAiCompletion({
          provider: selectedProvider,
          model: currentModel,
          conversation: messages,
          newUserMessage: text,
          documentContext: attachedDoc
            ? {
                name: attachedDoc.name,
                text: attachedDoc.text,
                truncated: attachedDoc.truncated,
              }
            : null,
          searchResults,
        });

        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: reply,
          provider: selectedProvider,
          modelUsed: currentModel,
          timestamp: Date.now(),
          sources: searchResults
            ? searchResults.map((s) => ({ title: s.title, url: s.url, snippet: s.snippet }))
            : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const isKeyErr = err.message?.startsWith('MISSING_KEY');
        const errContent = isKeyErr
          ? `⚠️ Add your ${PROVIDERS[selectedProvider].name} API key in Settings first`
          : `⚠️ ${PROVIDERS[selectedProvider].name} (${currentModel}) request failed: ${err.message || 'Unknown network error'}`;

        const errBubble: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'error',
          content: errContent,
          provider: selectedProvider,
          timestamp: Date.now(),
          isError: true,
          canRetry: !isKeyErr,
        };

        setMessages((prev) => [...prev, errBubble]);

        if (isKeyErr) {
          handleOpenSettings(selectedProvider);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedProvider, currentModel, messages, webSearchActive, attachedDoc]
  );

  const handleRetryLast = () => {
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Filter out trailing error bubbles
    const filtered = messages.filter((m) => !m.isError);
    setMessages(filtered);
    handleSendMessage(lastUserMsg.content);
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 flex-col overflow-hidden font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header with Model Selector */}
      <TopBar
        selectedProvider={selectedProvider}
        onSelectProvider={handleSelectProvider}
        currentModel={currentModel}
        onSelectModel={handleSelectModel}
        onOpenSettings={() => handleOpenSettings()}
        onOpenEmail={() => setEmailOpen(true)}
        onClearChat={handleClearChat}
        hasMessages={messages.length > 0}
      />

      {/* Main Chat Message Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <MessageList
          messages={messages}
          loading={loading}
          activeProvider={selectedProvider}
          onRetry={handleRetryLast}
          onOpenSettings={handleOpenSettings}
          onSelectPrompt={(prompt) => setExternalInput(prompt)}
        />

        {/* Composer Bar */}
        <Composer
          onSendMessage={handleSendMessage}
          disabled={loading}
          attachedDoc={attachedDoc}
          onAttachDoc={(doc) => setAttachedDoc(doc)}
          webSearchActive={webSearchActive}
          onToggleWebSearch={() => setWebSearchActive((prev) => !prev)}
          composerError={composerError}
          onClearComposerError={() => setComposerError(null)}
          externalInputText={externalInput}
          onClearExternalInput={() => setExternalInput('')}
        />
      </main>

      {/* Settings Modal with Dedicated Test Buttons & Model Selector */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialHighlightProvider={settingsHighlight}
        onModelChange={(provider, modelId) => {
          if (provider === selectedProvider) {
            setCurrentModel(modelId);
          }
        }}
      />

      {/* Gmail Assistant Drawer */}
      <EmailDrawer
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        selectedProvider={selectedProvider}
        onOpenSettings={() => handleOpenSettings('email')}
      />
    </div>
  );
}
