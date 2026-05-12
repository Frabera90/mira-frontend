import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight, ArrowLeft, Upload, FileImage, CheckCircle,
  Loader2, RotateCcw, UtensilsCrossed, Package, ChefHat,
} from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'

interface Props {
  onComplete: (ristoranteId?: string) => void
}

// ── tipi interni ──────────────────────────────────────────────

interface FatturaRisultato { fornitore: string; ingredienti: number }
interface PiattoItem { id: string; nome: string; categoria: string | null; prezzo_vendita: number | null }
interface ScortaEdit {
  ingrediente_id: string
  nome: string
  unita: string
  qta_riferimento: number
  qta_attuale: string
}
interface AbbinaItem {
  piatto_id: string
  piatto_nome: string
  categoria: string | null
  prezzo_vendita: number
  ingredienti: Array<{ nome: string; quantita: number; unita_misura: string; costo: number }>
  costo_totale: number
  food_cost_pct: number | null
}

const TIPI_CUCINA = ['Italiana', 'Pesce', 'Carne', 'Pizza', 'Trattoria', 'Bar / Bistro', 'Fusion', 'Altro']
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

// ── helpers ───────────────────────────────────────────────────

function ProgressDots({ step, total = 5 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i + 1 < step
              ? 'w-2 h-2 bg-terra'
              : i + 1 === step
              ? 'w-6 h-2 bg-terra'
              : 'w-2 h-2 bg-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

function StepShell({
  step, title, subtitle, children, cta, ctaDisabled, onBack, onNext, loading,
}: {
  step: number
  title: string
  subtitle: string
  children: React.ReactNode
  cta: string
  ctaDisabled?: boolean
  onBack?: () => void
  onNext: () => void
  loading?: boolean
}) {
  return (
    <div className="min-h-screen bg-cream flex flex-col p-6 max-w-[480px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1 shrink-0">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="w-8 h-8 rounded-xl bg-terra flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">M</span>
        </div>
      </div>

      <ProgressDots step={step} />

      <div className="flex-1">
        <h2 className="text-2xl font-bold text-caffe leading-tight">{title}</h2>
        <p className="text-maro mt-2 mb-6 leading-relaxed text-sm">{subtitle}</p>
        {children}
      </div>

      <button
        onClick={onNext}
        disabled={ctaDisabled || loading}
        className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 mt-6 disabled:opacity-40 shadow-lg shadow-terra/20 transition-opacity"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Un momento…' : <>{cta} <ChevronRight size={16} /></>}
      </button>
    </div>
  )
}

// ── componente principale ─────────────────────────────────────

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  // Step 1
  const [nomeChef, setNomeChef] = useState('')
  const [nomeRist, setNomeRist] = useState('')
  const [tipoCucina, setTipoCucina] = useState('')
  const [coperti, setCoperti] = useState('')
  const [ristoranteId, setRistoranteId] = useState<string | null>(null)

  // Step 2
  const fatturaInputRef = useRef<HTMLInputElement>(null)
  const [fattureCaricate, setFattureCaricate] = useState<FatturaRisultato[]>([])
  const [uploadingFattura, setUploadingFattura] = useState(false)
  const [fatturaPreview, setFatturaPreview] = useState<{ url: string; type: string } | null>(null)
  const [fatturaFile, setFatturaFile] = useState<{ base64: string; mediaType: string } | null>(null)

  // Step 3
  const menuInputRef = useRef<HTMLInputElement>(null)
  const [piattiCaricati, setPiattiCaricati] = useState<PiattoItem[]>([])
  const [uploadingMenu, setUploadingMenu] = useState(false)

  // Step 4
  const [scorte, setScorte] = useState<ScortaEdit[]>([])
  const [loadingScorte, setLoadingScorte] = useState(false)
  const [savingScorte, setSavingScorte] = useState(false)

  // Step 5
  const [abbinaLoading, setAbbinaLoading] = useState(false)
  const [abbinaFase, setAbbinaFase] = useState(0)
  const [abbinamenti, setAbbinamenti] = useState<AbbinaItem[]>([])

  const ABBINA_FASI = [
    'Analizzo gli ingredienti in magazzino…',
    'Abbino ingredienti ai piatti…',
    'Calcolo il food cost per porzione…',
    'Preparo i suggerimenti d\'ordine…',
  ]

  // ── Step 1 — Crea ristorante ─────────────────────────────────

  async function completaStep1() {
    if (!nomeChef.trim()) return
    setSaving(true)
    setErrore(null)
    localStorage.setItem('mira_chef_name', nomeChef.trim())
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let id: string

      if (user) {
        const extra: Record<string, unknown> = {}
        if (tipoCucina) extra.tipo_cucina = tipoCucina
        if (coperti) extra.coperti_medi = parseInt(coperti, 10) || null

        const { data: esistente } = await supabase
          .from('ristoranti').select('id').eq('auth_user_id', user.id).maybeSingle()
        if (esistente) {
          id = esistente.id
          await supabase.from('ristoranti').update({
            nome: nomeRist.trim() || 'Il mio ristorante',
            ...extra,
          }).eq('id', id)
        } else {
          const { data: nuovo, error } = await supabase
            .from('ristoranti')
            .insert({
              nome: nomeRist.trim() || 'Il mio ristorante',
              auth_user_id: user.id,
              ora_briefing: '07:30',
              ora_report_serale: '22:00',
              ...extra,
            })
            .select('id').single()
          if (error) throw error
          id = nuovo.id
        }
        if (tipoCucina) localStorage.setItem('mira_tipo_cucina', tipoCucina)
        if (coperti) localStorage.setItem('mira_coperti', coperti)
      } else {
        // dev/skip-auth mode: usa il default
        const { data: rist } = await supabase.from('ristoranti').select('id').limit(1).single()
        id = rist?.id ?? ''
      }
      setRistoranteId(id)
      setStep(2)
    } catch (e: any) {
      setErrore(e.message ?? 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2 — Fattura ─────────────────────────────────────────

  function scegliFileFattura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !SUPPORTED.has(file.type)) return
    const url = URL.createObjectURL(file)
    setFatturaPreview({ url, type: file.type })
    const reader = new FileReader()
    reader.onload = ev => {
      const [header, base64] = (ev.target?.result as string).split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      setFatturaFile({ base64, mediaType })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function analizzaFattura() {
    if (!fatturaFile || !ristoranteId) return
    setUploadingFattura(true)
    setErrore(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/fatture/analizza`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: fatturaFile.base64, mediaType: fatturaFile.mediaType }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore analisi fattura')
      setFattureCaricate(prev => [...prev, {
        fornitore: json.data.estratti.fornitore_nome ?? 'Fornitore',
        ingredienti: json.data.ingredienti_caricati ?? 0,
      }])
      setFatturaPreview(null)
      setFatturaFile(null)
    } catch (e: any) {
      setErrore(e.message)
    } finally {
      setUploadingFattura(false)
    }
  }

  // ── Step 3 — Menu ────────────────────────────────────────────

  async function analizzaMenu(file: File) {
    if (!SUPPORTED.has(file.type) || !ristoranteId) return
    setUploadingMenu(true)
    setErrore(null)
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
      })
      const [header, base64] = dataUrl.split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? file.type
      const resp = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/menu/analizza`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      })
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore lettura menu')
      const { data: piatti } = await supabase
        .from('piatti').select('id, nome, categoria, prezzo_vendita')
        .eq('ristorante_id', ristoranteId).order('nome')
      setPiattiCaricati(piatti ?? [])
    } catch (e: any) {
      setErrore(e.message)
    } finally {
      setUploadingMenu(false)
    }
  }

  // ── Step 4 — Magazzino attuale ───────────────────────────────

  async function caricaScorte() {
    if (!ristoranteId) return
    setLoadingScorte(true)
    const { data } = await supabase
      .from('scorte')
      .select('ingrediente_id, quantita_disponibile, ingredienti(nome, unita_misura)')
      .eq('ristorante_id', ristoranteId)
      .order('ingrediente_id')
    setScorte(
      (data ?? []).map(s => {
        const ing = Array.isArray(s.ingredienti) ? s.ingredienti[0] : s.ingredienti
        return {
          ingrediente_id: s.ingrediente_id,
          nome: ing?.nome ?? '—',
          unita: ing?.unita_misura ?? 'kg',
          qta_riferimento: Number(s.quantita_disponibile ?? 0),
          qta_attuale: String(s.quantita_disponibile ?? 0),
        }
      })
    )
    setLoadingScorte(false)
  }

  useEffect(() => {
    if (step === 4) caricaScorte()
  }, [step])

  async function salvaScorteEAvanza() {
    if (!ristoranteId) return
    setSavingScorte(true)
    const upserts = scorte.map(s => ({
      ristorante_id: ristoranteId,
      ingrediente_id: s.ingrediente_id,
      quantita_disponibile: parseFloat(s.qta_attuale.replace(',', '.')) || 0,
    }))
    if (upserts.length > 0) {
      await supabase.from('scorte').upsert(upserts, { onConflict: 'ristorante_id,ingrediente_id' })
    }
    setSavingScorte(false)
    avviaAbbinamento()
  }

  // ── Step 5 — Abbinamento AI ──────────────────────────────────

  async function avviaAbbinamento() {
    if (!ristoranteId) return
    setStep(5)
    setAbbinaLoading(true)
    setAbbinaFase(0)

    // Anima le fasi mentre aspettiamo
    const intervals: ReturnType<typeof setInterval>[] = []
    ABBINA_FASI.forEach((_, i) => {
      const t = setTimeout(() => setAbbinaFase(i), i * 1800)
      intervals.push(t as any)
    })

    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/onboarding/abbina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore abbinamento')
      setAbbinamenti(json.data.abbinamenti ?? [])
    } catch (e: any) {
      setErrore(e.message)
    } finally {
      intervals.forEach(clearTimeout)
      setAbbinaLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────

  if (step === 1) return (
    <StepShell
      step={1}
      title="Benvenuto in MIRA"
      subtitle="Imposteremo tutto in 5 minuti. Partiamo dal tuo ristorante."
      cta="Avanti"
      ctaDisabled={!nomeChef.trim() || !nomeRist.trim()}
      onNext={completaStep1}
      loading={saving}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Come ti chiami, Chef?</label>
          <input
            type="text" value={nomeChef} onChange={e => setNomeChef(e.target.value)}
            placeholder="es. Marco"
            autoFocus
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome del ristorante *</label>
          <input
            type="text" value={nomeRist} onChange={e => setNomeRist(e.target.value)}
            placeholder="es. Osteria del Borgo"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Tipo di cucina</label>
          <div className="flex flex-wrap gap-2">
            {TIPI_CUCINA.map(t => (
              <button key={t} type="button" onClick={() => setTipoCucina(tipoCucina === t ? '' : t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  tipoCucina === t ? 'bg-terra text-white border-terra' : 'bg-white text-slate-500 border-slate-200'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Coperti medi a sera</label>
          <input
            type="number" inputMode="numeric" value={coperti} onChange={e => setCoperti(e.target.value)}
            placeholder="es. 60"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra"
          />
        </div>
        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}
      </div>
    </StepShell>
  )

  if (step === 2) return (
    <StepShell
      step={2}
      title="Carica una fattura recente"
      subtitle="MIRA legge ingredienti, prezzi e quantità consegnate — tutto automatico."
      cta={fattureCaricate.length > 0 ? 'Avanti' : 'Carica fattura per continuare'}
      ctaDisabled={fattureCaricate.length === 0}
      onBack={() => setStep(1)}
      onNext={() => setStep(3)}
    >
      <div className="space-y-4">
        {/* Upload o analisi */}
        {!fatturaPreview && !uploadingFattura && (
          <button
            onClick={() => fatturaInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-terra hover:bg-slate-50 transition-all"
          >
            <div className="w-12 h-12 bg-terra/10 rounded-xl flex items-center justify-center">
              <Upload size={24} className="text-terra" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-caffe">Tocca per scegliere</p>
              <p className="text-xs text-slate-400 mt-1">Foto, PDF, fotocamera</p>
            </div>
          </button>
        )}

        {fatturaPreview && !uploadingFattura && (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
              {fatturaPreview.type === 'application/pdf'
                ? <div className="p-6 text-center text-sm text-slate-500">PDF selezionato</div>
                : <img src={fatturaPreview.url} alt="" className="w-full max-h-48 object-contain" />
              }
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setFatturaPreview(null); setFatturaFile(null) }}
                className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-600 flex items-center justify-center gap-2">
                <RotateCcw size={14} /> Cambia
              </button>
              <button onClick={analizzaFattura}
                className="flex-1 bg-terra text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
                <FileImage size={14} /> Leggi fattura
              </button>
            </div>
          </div>
        )}

        {uploadingFattura && (
          <div className="flex items-center gap-3 bg-indigo-50 rounded-2xl p-4">
            <Loader2 size={18} className="text-terra animate-spin shrink-0" />
            <div>
              <p className="font-semibold text-caffe text-sm">AI in lettura…</p>
              <p className="text-xs text-slate-500 mt-0.5">Estraggo ingredienti e prezzi</p>
            </div>
          </div>
        )}

        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

        {/* Fatture già caricate */}
        {fattureCaricate.length > 0 && (
          <div className="space-y-2">
            {fattureCaricate.map((f, i) => (
              <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">{f.fornitore}</p>
                  <p className="text-xs text-emerald-600">{f.ingredienti} ingredienti caricati</p>
                </div>
              </div>
            ))}
            <button onClick={() => fatturaInputRef.current?.click()}
              className="w-full border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 flex items-center justify-center gap-2">
              <Upload size={14} /> Carica un'altra fattura
            </button>
          </div>
        )}

        <input ref={fatturaInputRef} type="file" accept={ACCEPTED} className="hidden" onChange={scegliFileFattura} />
      </div>
    </StepShell>
  )

  if (step === 3) return (
    <StepShell
      step={3}
      title="Carica il tuo menu"
      subtitle="Foto, PDF, listino — MIRA crea piatti e bevande con prezzi e categorie."
      cta={piattiCaricati.length > 0 ? 'Avanti' : 'Carica menu per continuare'}
      ctaDisabled={piattiCaricati.length === 0}
      onBack={() => setStep(2)}
      onNext={() => setStep(4)}
    >
      <div className="space-y-4">
        {!uploadingMenu && piattiCaricati.length === 0 && (
          <button
            onClick={() => menuInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-terra hover:bg-slate-50 transition-all"
          >
            <div className="w-12 h-12 bg-caffe/10 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={24} className="text-caffe" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-caffe">Tocca per scegliere</p>
              <p className="text-xs text-slate-400 mt-1">Menu, listino vini, carta cocktail</p>
            </div>
          </button>
        )}

        {uploadingMenu && (
          <div className="flex items-center gap-3 bg-indigo-50 rounded-2xl p-4">
            <Loader2 size={18} className="text-terra animate-spin shrink-0" />
            <div>
              <p className="font-semibold text-caffe text-sm">AI in lettura…</p>
              <p className="text-xs text-slate-500 mt-0.5">Estraggo piatti e prezzi</p>
            </div>
          </div>
        )}

        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

        {piattiCaricati.length > 0 && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">{piattiCaricati.length} piatti caricati</p>
                <p className="text-xs text-emerald-600">Antipasti, secondi, bevande e vini</p>
              </div>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
              {piattiCaricati.slice(0, 20).map(p => (
                <div key={p.id} className="flex justify-between items-center px-4 py-2.5 border-b border-slate-50 last:border-0">
                  <p className="text-sm text-caffe font-medium truncate">{p.nome}</p>
                  {p.prezzo_vendita != null && (
                    <p className="text-xs font-semibold text-terra shrink-0 ml-3">€{p.prezzo_vendita.toFixed(2)}</p>
                  )}
                </div>
              ))}
              {piattiCaricati.length > 20 && (
                <p className="text-xs text-slate-400 text-center py-2">+{piattiCaricati.length - 20} altri piatti</p>
              )}
            </div>
            <button onClick={() => menuInputRef.current?.click()}
              className="w-full border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 flex items-center justify-center gap-2">
              <Upload size={14} /> Carica un altro menu
            </button>
          </div>
        )}

        <input ref={menuInputRef} type="file" accept={ACCEPTED} className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) analizzaMenu(f); e.target.value = '' }} />
      </div>
    </StepShell>
  )

  if (step === 4) return (
    <StepShell
      step={4}
      title="Quanto hai adesso in magazzino?"
      subtitle="La fattura indica quello che hai ricevuto. Aggiusta le quantità con quello che hai davvero in cucina oggi."
      cta="Avanti — MIRA elabora"
      onBack={() => setStep(3)}
      onNext={salvaScorteEAvanza}
      loading={savingScorte}
    >
      <div className="space-y-3">
        {loadingScorte && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 size={16} className="text-terra animate-spin" />
            <p className="text-sm text-slate-500">Carico le scorte…</p>
          </div>
        )}

        {!loadingScorte && scorte.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-700">Nessun ingrediente trovato. Controlla che la fattura sia stata analizzata correttamente.</p>
          </div>
        )}

        {!loadingScorte && scorte.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-slate-400">{scorte.length} ingredienti dalla fattura</p>
              <button
                onClick={() => setScorte(prev => prev.map(s => ({ ...s, qta_attuale: String(s.qta_riferimento) })))}
                className="text-xs text-terra font-semibold"
              >
                Usa tutto dalla fattura
              </button>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden max-h-[340px] overflow-y-auto">
              {scorte.map((s, i) => (
                <div key={s.ingrediente_id} className={`flex items-center gap-3 px-4 py-3 ${i < scorte.length - 1 ? 'border-b border-slate-50' : ''}`}>
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
                    <Package size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-caffe truncate">{s.nome}</p>
                    <p className="text-[11px] text-slate-400">fattura: {s.qta_riferimento} {s.unita}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={s.qta_attuale}
                      onChange={e => setScorte(prev => prev.map((x, j) => j === i ? { ...x, qta_attuale: e.target.value } : x))}
                      className="w-20 text-sm text-right border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-terra"
                    />
                    <span className="text-xs text-slate-400 w-6">{s.unita}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </StepShell>
  )

  if (step === 5) return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 max-w-[480px] mx-auto">
      {abbinaLoading ? (
        /* Loading */
        <div className="w-full space-y-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-terra flex items-center justify-center mx-auto shadow-xl shadow-terra/25">
            <span className="text-white font-bold text-3xl">M</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-caffe">MIRA sta lavorando…</h2>
            <p className="text-sm text-maro mt-2">Ci vuole qualche secondo</p>
          </div>
          <div className="space-y-3 text-left">
            {ABBINA_FASI.map((fase, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all ${i <= abbinaFase ? 'opacity-100' : 'opacity-25'}`}>
                {i < abbinaFase
                  ? <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                  : i === abbinaFase
                  ? <Loader2 size={16} className="text-terra animate-spin shrink-0" />
                  : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
                }
                <p className={`text-sm ${i === abbinaFase ? 'font-semibold text-caffe' : 'text-slate-400'}`}>{fase}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Risultati */
        <div className="w-full space-y-5">
          <div className="text-center mb-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
              <CheckCircle size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-caffe">
              {abbinamenti.length > 0
                ? `Food cost calcolato per ${abbinamenti.length} piatt${abbinamenti.length === 1 ? 'o' : 'i'}`
                : 'Setup completato!'}
            </h2>
            <p className="text-sm text-maro mt-1.5">
              {abbinamenti.length > 0
                ? 'Solo i piatti con ingredienti in magazzino. Carica altre fatture per coprire il resto.'
                : 'Nessun abbinamento trovato con gli ingredienti di questa fattura. Carica fatture più complete o aggiungi le ricette manualmente dall\'app.'}
            </p>
          </div>

          {errore && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700">L'abbinamento automatico ha avuto un problema, ma puoi aggiungere le ricette dall'app. {errore}</p>
            </div>
          )}

          {abbinamenti.length < piattiCaricati.length && abbinamenti.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-caffe">{piattiCaricati.length - abbinamenti.length} piatti</span> senza ingredienti in magazzino — carica altre fatture o aggiungi le ricette dal Menu.
              </p>
            </div>
          )}

          {abbinamenti.length > 0 && (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {abbinamenti.map(a => {
                const fcOk = a.food_cost_pct !== null && a.food_cost_pct <= 35
                return (
                  <div key={a.piatto_id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-caffe truncate">{a.piatto_nome}</p>
                        {a.categoria && <p className="text-xs text-slate-400 mt-0.5">{a.categoria}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {a.food_cost_pct !== null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fcOk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                            FC {a.food_cost_pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-1">
                      <div className="bg-slate-50 rounded-lg p-1.5">
                        <p className="text-[10px] text-slate-400">Prezzo</p>
                        <p className="text-xs font-bold text-caffe">€{a.prezzo_vendita.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-1.5">
                        <p className="text-[10px] text-slate-400">Costo</p>
                        <p className="text-xs font-bold text-caffe">€{a.costo_totale.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-1.5">
                        <p className="text-[10px] text-slate-400">Margine</p>
                        <p className={`text-xs font-bold ${a.prezzo_vendita - a.costo_totale >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          €{(a.prezzo_vendita - a.costo_totale).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 space-y-0.5">
                      {a.ingredienti.map((ing, j) => (
                        <p key={j} className="text-[11px] text-slate-400">
                          · {ing.nome} {ing.quantita}{ing.unita_misura}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => ristoranteId && onComplete(ristoranteId)}
              className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-terra/20"
            >
              <ChefHat size={16} />
              Entra in MIRA
            </button>
            <p className="text-xs text-slate-400 text-center mt-3">
              Potrai modificare ricette e grammature in qualsiasi momento dall'app.
            </p>
          </div>
        </div>
      )}
    </div>
  )

  return null
}
