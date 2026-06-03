import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const SESSION_KEY = 'shopease_session_id';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages or typing indicator
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Load existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setSessionId(stored);
      fetchHistory(stored);
    }
  }, []);

  async function fetchHistory(sid: string) {
    try {
      const res = await fetch(`${API_URL}/chat/history/${sid}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      } else if (res.status === 404) {
        localStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      }
    } catch {
      // Network error on initial load — start fresh, silently
    }
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);

    const optimisticMsg: Message = {
      id: uid(),
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong');
      }

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem(SESSION_KEY, data.sessionId);
      }

      const aiMsg: Message = {
        id: uid(),
        sender: 'ai',
        text: data.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to reach the support agent. Please try again.';
      setError(msg);
      // Remove optimistic user message so they can retry
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(text);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function startNewChat() {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
    setError(null);
    setInput('');
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="brand-icon" aria-hidden="true">🛍️</span>
            <div>
              <h1>ShopEase Support</h1>
              <div className="status-line">
                <span className="status-dot" />
                <span className="status-text">Online</span>
              </div>
            </div>
          </div>
          <button className="new-chat-btn" onClick={startNewChat}>
            New Chat
          </button>
        </div>
      </header>

      <main className="chat-area" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && !isLoading && (
          <div className="empty-state">
            <p className="empty-icon" aria-hidden="true">👋</p>
            <p className="empty-title">Hi! I'm your ShopEase support agent.</p>
            <p className="empty-sub">
              Ask me about shipping, returns, support hours, or anything else!
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.sender}`}>
            <div className={`bubble ${msg.sender}`}>{msg.text}</div>
          </div>
        ))}

        {isLoading && (
          <div className="message-row ai" aria-label="Agent is typing">
            <div className="bubble ai typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="error-close" onClick={() => setError(null)} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      <footer className="input-area">
        <textarea
          ref={textareaRef}
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          disabled={isLoading}
          rows={1}
          aria-label="Message input"
        />
        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          {isLoading ? (
            <span className="send-spinner" aria-hidden="true" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </footer>
    </div>
  );
}
