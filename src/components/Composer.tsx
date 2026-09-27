import React, { useRef, useState, useEffect } from 'react';
import { Paperclip, ArrowUp, Globe, X, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { ExtractedDoc, parseDocumentFile } from '../utils/documentParser';

interface ComposerProps {
  onSendMessage: (text: string) => void;
  disabled: boolean;
  attachedDoc: ExtractedDoc | null;
  onAttachDoc: (doc: ExtractedDoc | null) => void;
  webSearchActive: boolean;
  onToggleWebSearch: () => void;
  composerError: string | null;
  onClearComposerError: () => void;
  externalInputText?: string;
  onClearExternalInput?: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  disabled,
  attachedDoc,
  onAttachDoc,
  webSearchActive,
  onToggleWebSearch,
  composerError,
  onClearComposerError,
  externalInputText,
  onClearExternalInput,
}) => {
  const [text, setText] = useState('');
  const [parsingDoc, setParsingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external input text when user clicks an example prompt
  useEffect(() => {
    if (externalInputText) {
      setText(externalInputText);
      onClearExternalInput?.();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
        }
      }, 50);
    }
  }, [externalInputText, onClearExternalInput]);

  // Adjust textarea height on change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (composerError) {
      onClearComposerError();
    }
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setParsingDoc(true);
    setDocError(null);

    try {
      const extracted = await parseDocumentFile(file);
      onAttachDoc(extracted);
    } catch (err: any) {
      const msg = err.message || `Couldn't read ${file.name} — try a different file`;
      setDocError(msg.startsWith('⚠️') ? msg : `⚠️ ${msg}`);
      onAttachDoc(null);
    } finally {
      setParsingDoc(false);
      // Reset input value so re-selecting the same file triggers change
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const canSend = text.trim().length > 0 && !disabled && !parsingDoc;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-md p-4 sm:px-6 z-20 shrink-0">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Error chips / warnings */}
        {(docError || composerError) && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 animate-in fade-in">
            <span className="flex items-center space-x-1.5 truncate">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">{docError || composerError}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setDocError(null);
                onClearComposerError();
              }}
              className="text-rose-400 hover:text-rose-200 ml-2 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attached Document Chip */}
        {attachedDoc && (
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-200 animate-in fade-in">
            <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-medium truncate max-w-[200px] sm:max-w-xs">{attachedDoc.name}</span>
            {attachedDoc.truncated && (
              <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                Truncated ~60k chars
              </span>
            )}
            <button
              type="button"
              onClick={() => onAttachDoc(null)}
              title="Remove attached document"
              className="p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Input box container */}
        <div className="relative rounded-2xl bg-zinc-900 border border-zinc-800 focus-within:border-zinc-700 transition-all shadow-inner">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              attachedDoc
                ? `Ask questions about ${attachedDoc.name}...`
                : 'Type a message... (Shift+Enter for newline)'
            }
            className="w-full bg-transparent px-4 pt-3.5 pb-12 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed min-h-[52px] max-h-[180px]"
          />

          {/* Bottom Toolbar inside the box */}
          <div className="absolute left-2.5 bottom-2 right-2.5 flex items-center justify-between pointer-events-none">
            {/* Left buttons */}
            <div className="flex items-center space-x-1.5 pointer-events-auto">
              {/* Document upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || parsingDoc}
                title="Attach Document (.pdf, .docx, .txt, .md)"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center space-x-1 text-xs"
              >
                {parsingDoc ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>

              {/* Web search toggle chip */}
              <button
                type="button"
                onClick={onToggleWebSearch}
                disabled={disabled}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  webSearchActive
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 border border-transparent'
                }`}
                title={webSearchActive ? 'Web search enabled' : 'Click to enable web search grounding'}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Web search</span>
              </button>
            </div>

            {/* Right: Send button */}
            <div className="pointer-events-auto flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  canSend
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
                title="Send message (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span>Enter to send • Shift+Enter for new line</span>
          <span>Non-streaming responses</span>
        </div>
      </div>
    </div>
  );
};
