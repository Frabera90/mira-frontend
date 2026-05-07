import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Trash2, ArrowLeft } from 'lucide-react'
import { BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'mira_chat_history'

const SUGGERIMENTI = [
  'Quanto branzino ho?',
  'Cosa ordino oggi?',
  'Cosa scade domani?',
  'Coperti stasera?',
]

interface Props {
  onClose: () => void
}

export default function Assistente({ onClose }: Props) {
  const ristoranteId = useRistorante()
  const [messages, setMessages] = useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function invia(testo: string) {
    const t = testo.trim()
    if (!t || loading) return
    setInput('')
    inputRef.current?.focus()

    const userMsg: Msg = { role: 'user', content: t }
    const storico = [...messages, userMsg]
    setMessages(storico)
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: storico }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setMessages([...storico, { role: 'assistant', content: json.reply }])
    } catch (err) {
      setMessages([...storico, {
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Errore di connessione',
      }])
    } finally {
      setLoading(false)
    }
  }

  function pulisci() {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 bg-terra rounded-xl flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-caffe text-sm">MIRA</p>
            <p className="text-[10px] text-slate-400">Assistente magazzino</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={pulisci}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Messaggi */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-cream">
        {messages.length === 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="w-12 h-12 bg-terra rounded-2xl flex items-center justify-center">
                <Bot size={24} className="text-white" />
              </div>
              <p className="text-sm text-slate-500 text-center">
                Ciao {localStorage.getItem('mira_chef_name') || 'Chef'}, sono MIRA.<br />Chiedimi qualsiasi cosa sul magazzino.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGERIMENTI.map(s => (
                <button
                  key={s}
                  onClick={() => invia(s)}
                  className="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:border-terra hover:text-terra transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 bg-terra rounded-xl flex items-center justify-center shrink-0 mb-0.5">
                <Bot size={13} className="text-white" />
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-terra text-white rounded-br-sm'
                : 'bg-white text-caffe shadow-sm border border-slate-100 rounded-bl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 bg-terra rounded-xl flex items-center justify-center shrink-0">
              <Bot size={13} className="text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-slate-100 flex gap-1">
              {[0, 150, 300].map(d => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 bg-white border-t border-slate-100 px-4 py-3 flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') invia(input) }}
          placeholder="Scrivi a MIRA…"
          disabled={loading}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
        />
        <button
          onClick={() => invia(input)}
          disabled={loading || !input.trim()}
          className="shrink-0 w-10 h-10 bg-terra rounded-xl flex items-center justify-center text-white disabled:opacity-40 active:scale-95 transition-all"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
