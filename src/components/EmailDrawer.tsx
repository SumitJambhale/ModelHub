import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  RefreshCw,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  Clock,
  User,
  Inbox,
} from 'lucide-react';
import {
  fetchRecentEmails,
  readEmailBody,
  EmailItem,
  isEmailConfigured,
  getEmailCredentials,
} from '../services/emailService';
import { ProviderId, PROVIDERS, executeAiCompletion } from '../services/aiProviders';

interface EmailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProvider: ProviderId;
  onOpenSettings: () => void;
}

export const EmailDrawer: React.FC<EmailDrawerProps> = ({
  isOpen,
  onClose,
  selectedProvider,
  onOpenSettings,
}) => {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected email for viewing & drafting
  const [activeEmail, setActiveEmail] = useState<EmailItem | null>(null);
  const [emailBody, setEmailBody] = useState<string>('');
  const [loadingBody, setLoadingBody] = useState(false);

  // AI draft state
  const [draftReply, setDraftReply] = useState<string>('');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const configured = isEmailConfigured();
  const credentials = getEmailCredentials();
  const currentProviderConfig = PROVIDERS[selectedProvider];

  const loadEmails = async () => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecentEmails();
      setEmails(data);
    } catch (err: any) {
      setError(
        err.message ||
          "Couldn't connect — check your email/app password, and make sure 2-Step Verification + IMAP are enabled on the account"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && configured) {
      loadEmails();
      setActiveEmail(null);
      setEmailBody('');
      setDraftReply('');
      setDraftError(null);
    }
  }, [isOpen, configured]);

  if (!isOpen) return null;

  const handleSelectEmail = async (item: EmailItem) => {
    setActiveEmail(item);
    setEmailBody('');
    setDraftReply('');
    setDraftError(null);
    setLoadingBody(true);

    try {
      const body = await readEmailBody(item.id);
      setEmailBody(body);
    } catch (err: any) {
      setEmailBody(`Error loading email body: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingBody(false);
    }
  };

  const handleDraftReply = async () => {
    if (!activeEmail || !emailBody) return;
    setDrafting(true);
    setDraftError(null);

    const prompt = `Please draft a professional, polite, and helpful email reply to the following email:

From: ${activeEmail.from}
Subject: ${activeEmail.subject}
Original Email Body:
"""
${emailBody.slice(0, 10000)}
"""

Guidelines:
- Maintain a warm, clear tone
- Directly address points raised in the email
- Keep placeholders like [My Name] for the sender to personalize`;

    try {
      const reply = await executeAiCompletion({
        provider: selectedProvider,
        conversation: [],
        newUserMessage: prompt,
      });
      setDraftReply(reply);
    } catch (err: any) {
      setDraftError(
        err.message?.includes('MISSING_KEY')
          ? `⚠️ Please configure your ${currentProviderConfig.name} API key in Settings first to draft replies.`
          : `Failed to draft reply: ${err.message}`
      );
    } finally {
      setDrafting(false);
    }
  };

  const handleCopyDraft = () => {
    if (!draftReply) return;
    navigator.clipboard.writeText(draftReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-start">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over from left */}
      <div className="relative w-full max-w-xl bg-zinc-950 border-r border-zinc-800 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center">
              <Mail className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Gmail Assistant</h2>
              <p className="text-[11px] text-zinc-400 font-mono truncate max-w-[240px]">
                {credentials.email || 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {configured && !activeEmail && (
              <button
                type="button"
                onClick={loadEmails}
                disabled={loading}
                title="Refresh inbox"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!configured ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Mail className="w-6 h-6 text-zinc-500" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-medium text-zinc-200">Connect Gmail in Settings</h3>
              <p className="text-xs text-zinc-400">
                To read recent emails and draft AI replies, add your Gmail address and 16-character App Password in Settings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              Open Settings
            </button>
          </div>
        ) : activeEmail ? (
          /* Email Reading & Drafting Pane */
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Top subheader */}
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveEmail(null)}
                className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Inbox</span>
              </button>
              <span className="text-[11px] text-zinc-500 font-mono">UID: {activeEmail.id}</span>
            </div>

            {/* Email Metadata */}
            <div className="px-5 py-4 border-b border-zinc-800/80 space-y-2">
              <h3 className="text-sm font-semibold text-zinc-100 leading-snug">{activeEmail.subject}</h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span className="flex items-center space-x-1 font-mono text-[11px] text-zinc-300">
                  <User className="w-3 h-3 text-zinc-500" />
                  <span>{activeEmail.from}</span>
                </span>
                {activeEmail.date && (
                  <span className="flex items-center space-x-1 text-[11px] text-zinc-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(activeEmail.date).toLocaleString()}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Email Body */}
            <div className="px-5 py-4 border-b border-zinc-800/80 max-h-56 overflow-y-auto">
              <div className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                {loadingBody ? (
                  <div className="flex items-center space-x-2 text-zinc-500 py-4">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading email message...</span>
                  </div>
                ) : (
                  emailBody || activeEmail.snippet
                )}
              </div>
            </div>

            {/* Draft Reply Action */}
            <div className="p-5 flex-1 flex flex-col space-y-3 bg-zinc-950">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Draft Reply</span>
                </h4>
                <button
                  type="button"
                  onClick={handleDraftReply}
                  disabled={drafting || loadingBody}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${drafting ? 'animate-spin' : ''}`} />
                  <span>{drafting ? 'Drafting...' : `Draft with ${currentProviderConfig.name}`}</span>
                </button>
              </div>

              {draftError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                  {draftError}
                </div>
              )}

              {draftReply ? (
                <div className="flex-1 flex flex-col space-y-2">
                  <div className="relative flex-1 min-h-[140px]">
                    <textarea
                      value={draftReply}
                      onChange={(e) => setDraftReply(e.target.value)}
                      className="w-full h-full min-h-[160px] bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 resize-none font-sans leading-relaxed"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-zinc-500 italic">
                      Review before sending — copy into Gmail to send this yourself.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyDraft}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center space-x-1.5 transition-colors border border-zinc-700"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Draft'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 border border-dashed border-zinc-800 rounded-xl flex items-center justify-center p-6 text-center text-zinc-500 text-xs">
                  Click "Draft with {currentProviderConfig.name}" to generate a customized reply.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Email List View */
          <div className="flex-1 overflow-y-auto flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 text-zinc-400">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <p className="text-xs">Connecting to Gmail IMAP...</p>
                <p className="text-[11px] text-zinc-500">Fetching 20 most recent messages</p>
              </div>
            ) : error ? (
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2 text-xs">
                  <div className="flex items-center space-x-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>⚠️ Couldn't connect to Gmail</span>
                  </div>
                  <p className="leading-relaxed">{error}</p>
                  <div className="pt-2 text-[11px] text-rose-300/80 list-disc list-inside space-y-1">
                    <p>• Make sure 2-Step Verification is turned ON on your Google account.</p>
                    <p>• Make sure you created a dedicated 16-character App Password.</p>
                    <p>• Verify IMAP is enabled in Gmail settings (Forwarding and POP/IMAP).</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={loadEmails}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                  >
                    Retry Connection
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Update Credentials in Settings
                  </button>
                </div>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-2">
                <Inbox className="w-8 h-8 text-zinc-600" />
                <p className="text-xs">No emails found in INBOX.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {emails.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => handleSelectEmail(msg)}
                    className="w-full text-left p-4 hover:bg-zinc-900/60 transition-colors flex flex-col space-y-1 group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors truncate max-w-[260px]">
                        {msg.from}
                      </span>
                      {msg.date && (
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {new Date(msg.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-zinc-300 truncate">{msg.subject}</p>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{msg.snippet}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>Read + Draft Assistant Only</span>
          <span className="font-mono">No direct sending</span>
        </div>
      </div>
    </div>
  );
};
