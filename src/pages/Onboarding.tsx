import { useRef, useState } from 'react'
import { ChevronRight, FileImage, Loader2, CheckCircle, SkipForward, Send, ExternalLink } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Props {
  onComplete: (ristoranteId?: string) => void
}

type Step = 1 | 2 | 3 | 4

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [fattureFatte, setFattureFatte] = useState(0)
  const [ultimoFornitore, setUltimoFornitore] = useState<string | null>(null)
  const [ristoranteIdCreato, setRistoranteIdCreato] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="w-12 h-12 rounded-2xl bg-terra flex items-center justify-center mb-8 shadow-lg shadow-terra/20">
        <span className="text-white font-bold text-2xl">M</span>
      </div>

      <div className="flex gap-2 mb-10">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
            s === step ? 'w-8 bg-terra' : s < step ? 'w-3 bg-terra/40' : 'w-3 bg-slate-200'
          }`} />
        ))}
      </div>

      {step === 1 && (
        <Step1 onDone={id => { if (id) setRistoranteIdCreato(id); setStep(2) }} />
      )}
      {step === 2 && (
        <Step2
          ristoranteId={ristoranteIdCreato}
          fattureFatte={fattureFatte}
          ultimoFornitore={ultimoFornitore}
          onFatturaAggiunta={nome => { setFattureFatte(n => n + 1); setUltimoFornitore(nome) }}
          onContinua={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <Step3
          ristoranteId={ristoranteIdCreato}
          onContinua={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <Step4 fattureFatte={fattureFatte} onComplete={() => onComplete(ristoranteIdCreato ?? undefined)} />
      )}
    </div>
  )
}

// ── Step 1: profilo ───────────────────────────────────────────

function Step1({ onDone }: { onDone: (ristoranteId?: string) => void }) {
  const defaultRistoranteId = useRistorante()
  const [nomeChef, setNomeChef] = useState('')
  const [nomeRist, setNomeRist] = useState('')
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  async function salva() {
    setSaving(true)
    setErrore(null)
    localStorage.setItem('mira_chef_name', nomeChef.trim() || 'Chef')

    const { data: { user } } = await supabase.auth.getUser()
    let ristoranteId: string | undefined

    if (user) {
      const { data: esistente } = await supabase
        .from('ristoranti')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (esistente) {
        ristoranteId = esistente.id
        if (nomeRist.trim()) {
          await supabase.from('ristoranti').update({ nome: nomeRist.trim() }).eq('id', ristoranteId)
        }
      } else {
        const { data: nuovo, error } = await supabase
          .from('ristoranti')
          .insert({
            nome:              nomeRist.trim() || 'Il mio ristorante',
            auth_user_id:      user.id,
            ora_briefing:      '07:30',
            ora_report_serale: '22:00',
          })
          .select('id')
          .single()
        if (error) {
          setErrore(error.message)
          setSaving(false)
          return
        }
        ristoranteId = nuovo.id
      }
    } else {
      if (nomeRist.trim()) {
        const { error } = await supabase
          .from('ristoranti')
          .update({ nome: nomeRist.trim() })
          .eq('id', defaultRistoranteId)
        if (error) {
          setErrore('Errore nel salvataggio. Riprova.')
          setSaving(false)
          return
        }
      }
    }

    setSaving(false)
    onDone(ristoranteId)
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-caffe">Benvenuto in MIRA</h1>
        <p className="text-maro mt-2 leading-relaxed">
          Il tuo assistente AI per il magazzino. Configuriamo tutto in 2 minuti.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Come ti chiami, Chef?</label>
          <input
            type="text"
            value={nomeChef}
            onChange={e => setNomeChef(e.target.value)}
            placeholder="es. Marco"
            autoFocus
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome del ristorante</label>
          <input
            type="text"
            value={nomeRist}
            onChange={e => setNomeRist(e.target.value)}
            placeholder="es. Osteria del Borgo"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
          />
        </div>
      </div>

      {errore && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
          {errore}
        </div>
      )}

      <button
        onClick={salva}
        disabled={saving || !nomeChef.trim()}
        className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity shadow-lg shadow-terra/20"
      >
        {saving ? 'Salvataggio…' : <>Continua <ChevronRight size={16} /></>}
      </button>
    </div>
  )
}

// ── Step 2: carica fatture ────────────────────────────────────

function Step2({ ristoranteId, fattureFatte, ultimoFornitore, onFatturaAggiunta, onContinua }: {
  ristoranteId: string | null
  fattureFatte: number
  ultimoFornitore: string | null
  onFatturaAggiunta: (fornitore: string) => void
  onContinua: () => void
}) {
  const defaultRistoranteId = useRistorante()
  const rid = ristoranteId ?? defaultRistoranteId
  const inputRef                    = useRef<HTMLInputElement>(null)
  const [fase, setFase]             = useState<'idle' | 'analisi' | 'ok' | 'errore'>('idle')
  const [errMsg, setErrMsg]         = useState<string>('')

  async function handleFile(file: File) {
    setFase('analisi')
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      const [header, base64] = dataUrl.split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      try {
        const res  = await fetch(`${BACKEND_URL}/api/ristoranti/${rid}/fatture/analizza`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error)
        onFatturaAggiunta(json.data.estratti.fornitore_nome)
        setFase('ok')
        setTimeout(() => setFase('idle'), 1500)
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : 'Errore sconosciuto')
        setFase('errore')
        setTimeout(() => setFase('idle'), 3000)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-caffe">Costruiamo il database</h2>
        <p className="text-maro mt-2 leading-relaxed">
          Fotografa o carica le ultime fatture. MIRA legge fornitori, ingredienti e prezzi in automatico.
        </p>
      </div>

      {fattureFatte > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-emerald-800 font-semibold text-sm">
            {fattureFatte} fattura{fattureFatte > 1 ? 'e' : ''} acquisita{fattureFatte > 1 ? 'e' : ''} ✓
          </p>
          {ultimoFornitore && (
            <p className="text-emerald-600 text-xs mt-0.5">Ultimo: {ultimoFornitore}</p>
          )}
        </div>
      )}

      <div
        onClick={() => fase === 'idle' && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-all ${
          fase === 'analisi'
            ? 'border-terra bg-indigo-50 cursor-wait'
            : fase === 'ok'
            ? 'border-emerald-400 bg-emerald-50 cursor-default'
            : fase === 'errore'
            ? 'border-rose-300 bg-rose-50 cursor-pointer'
            : 'border-slate-200 bg-white hover:border-terra hover:bg-slate-50 cursor-pointer'
        }`}
      >
        {fase === 'analisi' && <>
          <Loader2 size={28} className="text-terra animate-spin" />
          <p className="text-sm font-medium text-slate-600">Analisi AI in corso…</p>
        </>}
        {fase === 'ok' && <>
          <CheckCircle size={28} className="text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-700">Fattura salvata!</p>
        </>}
        {fase === 'errore' && <>
          <p className="text-sm font-semibold text-rose-600">Errore — tocca per riprovare</p>
          <p className="text-xs text-rose-400 text-center">{errMsg || 'Assicurati che la foto sia nitida'}</p>
        </>}
        {fase === 'idle' && <>
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <FileImage size={22} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-caffe text-sm">
              {fattureFatte > 0 ? 'Aggiungi un\'altra fattura' : 'Tocca per caricare una fattura'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Foto dalla galleria, scatta o PDF · max 10 MB</p>
          </div>
        </>}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onContinua}
          className="flex-1 border border-slate-200 text-slate-500 font-medium rounded-xl py-3 text-sm flex items-center justify-center gap-1.5 hover:bg-slate-50"
        >
          {fattureFatte > 0 ? 'Ho finito' : 'Salta per ora'}
          <SkipForward size={14} />
        </button>
        {fattureFatte >= 2 && (
          <button
            onClick={onContinua}
            className="flex-1 bg-terra text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-terra/20"
          >
            Continua
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Puoi aggiungere altre fatture in qualsiasi momento dalla sezione Magazzino
      </p>
    </div>
  )
}

// ── Step 3: Telegram ──────────────────────────────────────────

function Step3({ ristoranteId, onContinua }: { ristoranteId: string | null; onContinua: () => void }) {
  const defaultRistoranteId = useRistorante()
  const rid = ristoranteId ?? defaultRistoranteId
  const [chatId, setChatId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Mirachef_bot'

  async function salva() {
    if (!chatId.trim()) { onContinua(); return }
    setSaving(true)
    await supabase.from('ristoranti').update({ telegram_chat_id: chatId.trim() }).eq('id', rid)
    setSaving(false)
    setSaved(true)
    setTimeout(onContinua, 800)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-[#229ED9]/10 flex items-center justify-center mb-4">
          <Send size={22} className="text-[#229ED9]" />
        </div>
        <h2 className="text-2xl font-bold text-caffe">Collega Telegram</h2>
        <p className="text-maro mt-2 leading-relaxed">
          Ricevi briefing mattutino, alert scorte e report serale direttamente su Telegram. Puoi anche scrivere o mandare messaggi vocali al bot!
        </p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-terra/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-terra font-bold text-xs">1</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-caffe">Apri il bot MIRA su Telegram</p>
              <p className="text-xs text-slate-400 mt-0.5">Tocca il tasto qui sotto — Telegram si apre automaticamente</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-terra/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-terra font-bold text-xs">2</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-caffe">Scrivi qualsiasi messaggio</p>
              <p className="text-xs text-slate-400 mt-0.5">Es. "ciao" — il bot ti risponde con il tuo Chat ID</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-terra/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-terra font-bold text-xs">3</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-caffe">Incolla il Chat ID qui sotto</p>
              <p className="text-xs text-slate-400 mt-0.5">È un numero tipo: 1234567890</p>
            </div>
          </div>
        </div>

        <a
          href={`https://t.me/${botUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-[#229ED9] text-white font-semibold rounded-xl py-3 text-sm"
        >
          <ExternalLink size={15} />
          Apri @{botUsername}
        </a>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Il tuo Chat ID</label>
          <input
            type="text"
            inputMode="numeric"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            placeholder="es. 1234567890"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 font-mono"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onContinua}
          className="flex-1 border border-slate-200 text-slate-500 font-medium rounded-xl py-3 text-sm flex items-center justify-center gap-1.5 hover:bg-slate-50"
        >
          Salta per ora
          <SkipForward size={14} />
        </button>
        <button
          onClick={salva}
          disabled={saving}
          className="flex-1 bg-terra text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-terra/20 disabled:opacity-50"
        >
          {saved ? 'Salvato ✓' : saving ? 'Salvo…' : chatId.trim() ? 'Salva e continua' : 'Continua'}
        </button>
      </div>
    </div>
  )
}

// ── Step 4: completato ────────────────────────────────────────

function Step4({ fattureFatte, onComplete }: { fattureFatte: number; onComplete: () => void }) {
  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle size={36} className="text-emerald-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-caffe">
          {fattureFatte > 0 ? 'Tutto pronto!' : 'MIRA è configurata!'}
        </h2>
        <p className="text-maro mt-2 leading-relaxed">
          {fattureFatte > 0
            ? `${fattureFatte} fattura${fattureFatte > 1 ? 'e analizzate' : ' analizzata'}. MIRA conosce già i tuoi fornitori e prezzi.`
            : 'Puoi caricare fatture in qualsiasi momento dalla sezione Magazzino.'}
        </p>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5">
        <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Cosa fare adesso</p>
        {[
          ['Dashboard', 'Scorte critiche e ordini urgenti sempre sotto controllo'],
          ['Fattura (📷)', 'Fotografa le fatture per aggiornare magazzino e prezzi'],
          ['Ordini', 'MIRA suggerisce automaticamente cosa ordinare e quanto'],
          ['Telegram', 'Parla con il bot — testo o vocale, in italiano naturale'],
        ].map(([titolo, desc]) => (
          <div key={titolo} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-terra mt-1.5 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-caffe">{titolo}: </span>
              <span className="text-xs text-slate-500">{desc}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 shadow-lg shadow-terra/20"
      >
        Vai alla dashboard
      </button>
    </div>
  )
}
