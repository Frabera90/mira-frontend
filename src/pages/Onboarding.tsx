import { useRef, useState } from 'react'
import { ChevronRight, FileImage, Loader2, CheckCircle, SkipForward } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Props {
  onComplete: (ristoranteId?: string) => void
}

type Step = 1 | 2 | 3

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [fattureFatte, setFattureFatte] = useState(0)
  const [ultimoFornitore, setUltimoFornitore] = useState<string | null>(null)
  const [ristoranteIdCreato, setRistoranteIdCreato] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="w-12 h-12 rounded-2xl bg-terra flex items-center justify-center mb-8 shadow-lg shadow-terra/20">
        <span className="text-white font-bold text-2xl">M</span>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-10">
        {[1, 2, 3].map(s => (
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
        <Step3 fattureFatte={fattureFatte} onComplete={() => onComplete(ristoranteIdCreato ?? undefined)} />
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
      // Check if user already has a ristorante
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
        // Create a new ristorante for this user
        const { data: nuovo, error } = await supabase
          .from('ristoranti')
          .insert({
            nome:          nomeRist.trim() || 'Il mio ristorante',
            auth_user_id:  user.id,
            ora_briefing:  '07:30',
            ora_report_serale: '22:00',
          })
          .select('id')
          .single()
        if (error) {
          setErrore('Errore nella creazione del ristorante. Riprova.')
          setSaving(false)
          return
        }
        ristoranteId = nuovo.id
      }
    } else {
      // Dev / skip-auth mode: update the default ristorante
      if (nomeRist.trim()) {
        const { error } = await supabase
          .from('ristoranti')
          .update({ nome: nomeRist.trim() })
          .eq('id', defaultRistoranteId)
        if (error) {
          setErrore('Errore nel salvataggio del ristorante. Riprova.')
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
          Il sistema operativo per la marginalità del tuo ristorante. Configuriamo tutto in 2 minuti.
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
      } catch {
        setFase('errore')
        setTimeout(() => setFase('idle'), 2000)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-caffe">Costruiamo il database</h2>
        <p className="text-maro mt-2 leading-relaxed">
          Manda le foto delle tue ultime fatture. MIRA legge in automatico fornitori, ingredienti e prezzi — nessun inserimento manuale.
        </p>
      </div>

      {fattureFatte > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-emerald-800 font-semibold text-sm">
            {fattureFatte} fattura{fattureFatte > 1 ? 'e' : ''} acquisita{fattureFatte > 1 ? 'e' : ''} ✓
          </p>
          {ultimoFornitore && (
            <p className="text-emerald-600 text-xs mt-0.5">Ultimo fornitore: {ultimoFornitore}</p>
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
          <p className="text-sm font-semibold text-rose-600">Errore — riprova</p>
          <p className="text-xs text-rose-400">Assicurati che la foto sia nitida</p>
        </>}
        {fase === 'idle' && <>
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <FileImage size={22} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-caffe text-sm">
              {fattureFatte > 0 ? 'Aggiungi un\'altra fattura' : 'Tocca per caricare una fattura'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Foto, JPG o PNG · max 10 MB</p>
          </div>
        </>}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
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

// ── Step 3: completato ────────────────────────────────────────

function Step3({ fattureFatte, onComplete }: { fattureFatte: number; onComplete: () => void }) {
  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle size={36} className="text-emerald-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-caffe">
          {fattureFatte > 0 ? 'Database costruito!' : 'Tutto pronto!'}
        </h2>
        <p className="text-maro mt-2 leading-relaxed">
          {fattureFatte > 0
            ? `${fattureFatte} fattura${fattureFatte > 1 ? 'e analizzate' : ' analizzata'}. MIRA conosce già i tuoi fornitori e ha i prezzi aggiornati.`
            : 'Puoi caricare le fatture in qualsiasi momento dalla sezione Magazzino o dal bot Telegram.'}
        </p>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5">
        <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Cosa puoi fare ora</p>
        {[
          ['Dashboard', 'Scorte critiche e ordini urgenti sempre sotto controllo'],
          ['Ordini', 'Suggerimenti automatici di riordino con un tap'],
          ['Telegram', 'Collega il bot in Impostazioni e parla liberamente — testo o vocale'],
          ['Fattura', 'Fotografa le fatture per aggiornare prezzi e scorte in automatico'],
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
