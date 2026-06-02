import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X, Send, Sparkles, Bot, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../App';

// Per-scope persona, greeting, and starter prompts. Scope is also enforced
// server-side (/api/v1/chat) — this just tailors the UI.
const SCOPE_META = {
  public: {
    title: 'PlacementIQ Assistant',
    badge: 'Guide',
    greeting: "Hi! I can explain how PlacementIQ predicts placement risk, salaries and timelines, and how to get started. What would you like to know?",
    suggestions: ['What is PlacementIQ?', 'How is the risk score calculated?', 'Is my data used for credit decisions?'],
  },
  student: {
    title: 'PlacementIQ Coach',
    badge: 'Your coach',
    greeting: "Hi! I'm your personal coach. Ask why your placement score is what it is, or how to improve it.",
    suggestions: ['Why is my risk band what it is?', 'How can I improve my score?', 'What if I do a 2-month internship?'],
  },
  admin: {
    title: 'PlacementIQ Copilot',
    badge: 'Portfolio',
    greeting: "Hi! Give me a student ID and I'll pull their risk, drivers and interventions — or paste student data to onboard them.",
    suggestions: ['Why is STU-2026-00001 at risk?', 'Best-ROI interventions for STU-2026-00001', "What's the current market shock risk?"],
  },
};

export default function ChatWidget({ scope = 'public', studentId = null }) {
  const meta = SCOPE_META[scope] || SCOPE_META.public;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role, content, sources?, used_tools? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const sendText = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/chat`, {
        role: scope,
        student_id: studentId,
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...next, {
        role: 'assistant',
        content: res.data?.reply || "Sorry, I didn't get that.",
        sources: res.data?.sources || [],
        used_tools: res.data?.used_tools || [],
      }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry — I could not reach the assistant. Please try again in a moment.' }]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--navy, #1B2C5E)', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 22px rgba(27,44,94,0.38)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: '92px', right: '24px', zIndex: 1000,
            width: 'min(380px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 130px))',
            background: 'var(--paper, #F5F2EA)', color: 'var(--ink, #1A1A1A)',
            border: '1px solid var(--card-edge, rgba(0,0,0,0.12))', borderRadius: '14px',
            boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '0.85rem 1rem', background: 'var(--navy, #1B2C5E)', color: '#fff', flexShrink: 0,
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
              background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.1 }}>{meta.title}</div>
              <div style={{ fontSize: '0.64rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.8, marginTop: '2px' }}>
                {meta.badge} · grounded in your data
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close"
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.85 }}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {/* Greeting + suggestions */}
            {messages.length === 0 && (
              <>
                <Bubble who="assistant">{meta.greeting}</Bubble>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                  {meta.suggestions.map((s) => (
                    <button key={s} onClick={() => sendText(s)}
                      style={{
                        textAlign: 'left', fontSize: '0.8rem', padding: '8px 10px', cursor: 'pointer',
                        background: 'var(--card-raised, #fff)', color: 'var(--ink, #1A1A1A)',
                        border: '1px solid var(--card-edge, rgba(0,0,0,0.12))', borderRadius: '8px',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) => (
              <div key={i}>
                <Bubble who={m.role}>{m.content}</Bubble>
                {m.role === 'assistant' && (m.sources?.length > 0 || m.used_tools?.length > 0) && (
                  <div style={{ fontSize: '0.62rem', color: 'var(--ink-faint, #8a8a8a)', marginTop: '3px', marginLeft: '4px' }}>
                    {m.sources?.length > 0 && <span>📄 {m.sources.join(', ')}</span>}
                    {m.used_tools?.length > 0 && <span style={{ marginLeft: m.sources?.length ? '8px' : 0 }}>🔧 {m.used_tools.join(', ')}</span>}
                  </div>
                )}
              </div>
            ))}

            {busy && <Bubble who="assistant"><span style={{ opacity: 0.7 }}>Thinking…</span></Bubble>}
          </div>

          {/* Composer */}
          <div style={{ padding: '0.7rem', borderTop: '1px solid var(--card-edge, rgba(0,0,0,0.12))', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask a question…"
                style={{
                  flex: 1, resize: 'none', maxHeight: '90px', fontFamily: 'inherit', fontSize: '0.85rem',
                  padding: '9px 11px', borderRadius: '9px', color: 'var(--ink, #1A1A1A)',
                  background: 'var(--card-raised, #fff)', border: '1px solid var(--card-edge, rgba(0,0,0,0.12))',
                  outline: 'none',
                }}
              />
              <button onClick={() => sendText()} disabled={busy || !input.trim()} aria-label="Send"
                style={{
                  width: '38px', height: '38px', borderRadius: '9px', flexShrink: 0,
                  background: 'var(--signal, #C2410C)', color: '#fff', border: 'none',
                  cursor: busy || !input.trim() ? 'default' : 'pointer',
                  opacity: busy || !input.trim() ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <Send size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '0.6rem', color: 'var(--ink-faint, #8a8a8a)' }}>
              {scope === 'admin'
                ? <><ShieldCheck size={11} /> Advisory only — never a final credit decision.</>
                : <><Sparkles size={11} /> Grounded in real data · may be imperfect.</>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const mdComponents = {
  p:      ({ children }) => <p style={{ margin: '0 0 0.5em', lineHeight: 1.55 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  em:     ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  ul:     ({ children }) => <ul style={{ margin: '0.3em 0 0.55em', paddingLeft: '1.3em', listStyle: 'disc' }}>{children}</ul>,
  ol:     ({ children }) => <ol style={{ margin: '0.3em 0 0.55em', paddingLeft: '1.3em', listStyle: 'decimal' }}>{children}</ol>,
  li:     ({ children }) => <li style={{ marginBottom: '0.2em', lineHeight: 1.5 }}>{children}</li>,
  code:   ({ inline, children }) => inline
    ? <code style={{ fontFamily: 'monospace', fontSize: '0.82em', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', padding: '1px 5px' }}>{children}</code>
    : <pre style={{ fontFamily: 'monospace', fontSize: '0.8em', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', padding: '0.6em 0.8em', overflowX: 'auto', margin: '0.4em 0' }}><code>{children}</code></pre>,
  h1: ({ children }) => <div style={{ fontWeight: 800, fontSize: '1em', marginBottom: '0.35em' }}>{children}</div>,
  h2: ({ children }) => <div style={{ fontWeight: 700, fontSize: '0.95em', marginBottom: '0.3em' }}>{children}</div>,
  h3: ({ children }) => <div style={{ fontWeight: 700, fontSize: '0.9em', marginBottom: '0.25em' }}>{children}</div>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '0.5em 0' }} />,
  a:  ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--signal, #C2410C)', textDecoration: 'underline' }}>{children}</a>,
  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid rgba(0,0,0,0.15)', paddingLeft: '0.75em', margin: '0.3em 0', color: 'rgba(0,0,0,0.6)', fontStyle: 'italic' }}>{children}</blockquote>,
};

function Bubble({ who, children }) {
  const isUser = who === 'user';
  const text = typeof children === 'string' ? children : '';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '85%', fontSize: '0.85rem',
        padding: '9px 12px', borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        background: isUser ? 'var(--navy, #1B2C5E)' : 'var(--card-raised, #fff)',
        color: isUser ? '#fff' : 'var(--ink, #1A1A1A)',
        border: isUser ? 'none' : '1px solid var(--card-edge, rgba(0,0,0,0.12))',
      }}>
        {isUser
          ? <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{text}</span>
          : <div className="chat-md"><ReactMarkdown components={mdComponents}>{text}</ReactMarkdown></div>
        }
      </div>
    </div>
  );
}
