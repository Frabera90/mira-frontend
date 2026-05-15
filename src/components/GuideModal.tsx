import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Camera, CheckCircle, ChefHat, ExternalLink,
  FileText, Loader2, MessageCircle, Plus, Trash2,
} from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'

const ACCEPTED_AI_FILES = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const SUPPORTED_AI_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

interface Props {
  ristoranteId: string
  onNavigate: (page: string) => void
}

interface Tasks {
  telegram: boolean
  fattura: boolean
  menu: boolean
}

interface SetupStatus {
  tasks: Tasks
  counts: {
    fatture: number
    piatti: number
    scorte: number
  }
  ready: boolean
}

interface PiattoForm {
  nome: string
  categoria: string
  prezzo: string
}

type WizardStep = 'welcome' | 'menu' | 'fattura' | 'telegram'

const BOT = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Mirachef_bot'
const CATEGORIE = ['antipasto', 'primo', 'secondo', 'contorno', 'dessert', 'bevanda', 'altro']
const STEP_ORDER: WizardStep[] = ['menu', 'fattura', 'telegram']

function nextMissingStep(tasks: Tasks): WizardStep | null {
  if (!tasks.menu) return 'menu'
  if (!tasks.fattura) return 'fattura'
  if (!tasks.telegram) return 'telegram'
  return null
}

function stepIndex(step: WizardStep) {
  if (step === 'welcome') return 0
  return STEP_ORDER.indexOf(step) + 1
}

export default function GuideModal({ ristoranteId, onNavigate }: Props) {
  const [tasks, setTasks] = useState<Tasks>({ telegram: false, fattura: false, menu: false })
  const [counts, setCounts] = useState<SetupStatus['counts']>({ fatture: 0, piatti: 0, scorte: 0 })
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<WizardStep>('welcome')
  const [showComplete, setShowComplete] = useState(false)
  const menuFileRef = useRef<HTMLInputElement>(null)
  const fatturaFileRef = useRef<HTMLInputElement>(null)

  const [chatId, setChatId] = useState('')
  const [savingTg, setSavingTg] = useState(false)
  const [tgSaved, setTgSaved] = useState(false)
  const [tgError, setTgError] = useState('')

  const [analisiFattura, setAnalisiFattura] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [errFattura, setErrFattura] = useState('')
  const [fatturaResult, setFatturaResult] = useState<{ ingredienti: number; fornitore?: string; righe?: number } | null>(null)

  const [piatti, setPiatti] = useState<PiattoForm[]>([])
  const [nuovoPiatto, setNuovoPiatto] = useState<PiattoForm>({ nome: '', categoria: 'primo', prezzo: '' })
  const [savingMenu, setSavingMenu] = useState(false)

  const [analisiMenu, setAnalisiMenu] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [errMenu, setErrMenu] = useState('')
  const [menuResult, setMenuResult] = useState<{ totale: number; ingredienti: number } | null>(null)

  async function refreshSetup(moveToNext = false) {
    const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/setup-status`)
    const json = await res.json()
    if (!json.ok) throw new Error(json.error ?? 'Errore stato configurazione')
    const status = json.data as SetupStatus
    setTasks(status.tasks)
    setCounts(status.counts)

    if (!status.ready) localStorage.removeItem('mira_guide_dismissed')
    if (status.ready && localStorage.getItem('mira_guide_dismissed') !== 'true') {
      setShowComplete(true)
      return
    }

    if (moveToNext) {
      const missing = nextMissingStep(status.tasks)
      setStep(missing ?? 'telegram')
    }
  }

  useEffect(() => {
    refreshSetup(false)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [ristoranteId])

  const allDone = tasks.telegram && tasks.fattura && tasks.menu
  if (!loaded || (allDone && !showComplete)) return null

  const done = Object.values(tasks).filter(Boolean).length

  function closeComplete() {
    if (!allDone) return
    localStorage.setItem('mira_guide_dismissed', 'true')
    setShowComplete(false)
    setOpen(false)
  }

  if (!open && allDone) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 bg-terra text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-terra/30"
      >
        <CheckCircle size={18} />
      </button>
    )
  }

  async function verificaTelegram() {
    setSavingTg(true)
    setTgError('')
    const { data } = await supabase.from('ristoranti').select('telegram_chat_id').eq('id', ristoranteId).single()
    setSavingTg(false)
    if (data?.telegram_chat_id) {
      setTgSaved(true)
      setTasks(t => {
        const next = { ...t, telegram: true }
        if (next.telegram && next.fattura && next.menu) setShowComplete(true)
        return next
      })
      refreshSetup(false).catch(() => {})
    } else {
      setTgError('Non risulta ancora collegato. Apri Telegram, premi START e poi riprova la verifica.')
    }
  }

  async function analizzaMenu(file: File) {
    if (!SUPPORTED_AI_MEDIA_TYPES.has(file.type)) {
      setErrMenu('Formato non supportato. Usa JPG, PNG, WEBP, GIF o PDF. Se la foto e in HEIC, esportala come JPG.')
      setAnalisiMenu('err')
      return
    }
    setAnalisiMenu('loading')
    setErrMenu('')
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      const [header, base64] = dataUrl.split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      try {
        const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/menu/analizza`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error ?? 'Errore lettura menu')
        setAnalisiMenu('ok')
        setMenuResult({
          totale: json.data?.totale ?? 0,
          ingredienti: json.data?.ingredienti_creati ?? 0,
        })
        setTasks(t => ({ ...t, menu: true }))
        refreshSetup(false).catch(() => {})
      } catch (e) {
        setErrMenu(e instanceof Error ? e.message : 'Errore')
        setAnalisiMenu('err')
      }
    }
    reader.readAsDataURL(file)
  }

  async function analizzaFattura(file: File) {
    if (!SUPPORTED_AI_MEDIA_TYPES.has(file.type)) {
      setErrFattura('Formato non supportato. Usa JPG, PNG, WEBP, GIF o PDF. Se la foto e in HEIC, esportala come JPG.')
      setAnalisiFattura('err')
      return
    }
    setAnalisiFattura('loading')
    setErrFattura('')
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      const [header, base64] = dataUrl.split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      try {
        const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/fatture/analizza`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error ?? 'Errore sconosciuto')
        setAnalisiFattura('ok')
        setFatturaResult({
          ingredienti: json.data?.ingredienti_caricati ?? 0,
          fornitore: json.data?.estratti?.fornitore_nome,
          righe: json.data?.estratti?.righe?.length ?? 0,
        })
        setTasks(t => ({ ...t, fattura: true }))
        refreshSetup(false).catch(() => {})
      } catch (e) {
        setErrFattura(e instanceof Error ? e.message : 'Errore di rete')
        setAnalisiFattura('err')
      }
    }
    reader.readAsDataURL(file)
  }

  function aggiungiPiatto() {
    if (!nuovoPiatto.nome.trim()) return
    setPiatti(p => [...p, nuovoPiatto])
    setNuovoPiatto({ nome: '', categoria: 'primo', prezzo: '' })
  }

  async function salvaMenu() {
    if (!piatti.length) return
    setSavingMenu(true)
    for (const p of piatti) {
      const nome = p.nome.trim()
      if (!nome) continue
      const payload = {
        ristorante_id: ristoranteId,
        nome,
        categoria: p.categoria,
        prezzo_vendita: p.prezzo ? Number(p.prezzo) : null,
        soglia_food_cost_pct: 35,
        attivo: true,
      }
      const { data: existing } = await supabase
        .from('piatti')
        .select('id')
        .eq('ristorante_id', ristoranteId)
        .ilike('nome', nome)
        .limit(1)
        .maybeSingle()
      if (existing?.id) await supabase.from('piatti').update(payload).eq('id', existing.id)
      else await supabase.from('piatti').insert(payload)
    }
    setSavingMenu(false)
    setTasks(t => ({ ...t, menu: true }))
    refreshSetup(false).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col">
        {showComplete ? (
          <div className="p-6 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-caffe">MIRA e pronta</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Menu, fatture e Telegram sono collegati. Da ora MIRA puo leggere acquisti, controllare scorte e avvisarti nei momenti importanti del servizio.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Voci menu" value={counts.piatti} />
              <Metric label="Fatture" value={counts.fatture} />
              <Metric label="Scorte" value={counts.scorte} />
            </div>
            <button onClick={closeComplete} className="w-full bg-terra text-white font-semibold rounded-xl py-3.5">
              Entra in MIRA
            </button>
          </div>
        ) : (
          <>
            <WizardHeader step={step} done={done} allDone={allDone} onBack={() => setStep('welcome')} />
            <div className="overflow-y-auto px-5 pb-6">
              {step === 'welcome' && (
                <WelcomeStep
                  onStart={() => setStep(nextMissingStep(tasks) ?? 'menu')}
                  counts={counts}
                />
              )}
              {step === 'menu' && (
                <MenuStep
                  done={tasks.menu}
                  analisi={analisiMenu}
                  errore={errMenu}
                  result={menuResult}
                  piatti={piatti}
                  nuovoPiatto={nuovoPiatto}
                  savingMenu={savingMenu}
                  setNuovoPiatto={setNuovoPiatto}
                  onChooseFile={() => menuFileRef.current?.click()}
                  onAdd={aggiungiPiatto}
                  onSaveManual={salvaMenu}
                  onRemoveManual={i => setPiatti(pl => pl.filter((_, j) => j !== i))}
                  onNext={() => setStep('fattura')}
                />
              )}
              {step === 'fattura' && (
                <FatturaStep
                  done={tasks.fattura}
                  analisi={analisiFattura}
                  errore={errFattura}
                  result={fatturaResult}
                  onChooseFile={() => fatturaFileRef.current?.click()}
                  onNext={() => setStep('telegram')}
                />
              )}
              {step === 'telegram' && (
                <TelegramStep
                  done={tasks.telegram || tgSaved}
                  chatId={chatId}
                  saving={savingTg}
                  error={tgError}
                  onOpenTelegram={() => window.open(`https://t.me/${BOT}?start=${ristoranteId}`, '_blank')}
                  onVerify={verificaTelegram}
                  onChatIdChange={setChatId}
                  onSaveChatId={async () => {
                    if (!chatId.trim()) return
                    setSavingTg(true)
                    await supabase.from('ristoranti').update({ telegram_chat_id: chatId.trim() }).eq('id', ristoranteId)
                    setSavingTg(false)
                    setTgSaved(true)
                    setTasks(t => {
                      const next = { ...t, telegram: true }
                      if (next.telegram && next.fattura && next.menu) setShowComplete(true)
                      return next
                    })
                    refreshSetup(false).catch(() => {})
                  }}
                />
              )}
            </div>
            <input
              ref={menuFileRef}
              type="file"
              accept={ACCEPTED_AI_FILES}
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) analizzaMenu(f)
                e.target.value = ''
              }}
            />
            <input
              ref={fatturaFileRef}
              type="file"
              accept={ACCEPTED_AI_FILES}
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) analizzaFattura(f)
                e.target.value = ''
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function WizardHeader({ step, done, allDone, onBack }: { step: WizardStep; done: number; allDone: boolean; onBack: () => void }) {
  const current = stepIndex(step)
  return (
    <div className="px-5 pt-5 pb-4 shrink-0">
      <div className="flex items-center gap-3">
        {step !== 'welcome' && !allDone ? (
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-terra flex items-center justify-center text-white font-bold text-sm">M</div>
        )}
        <div className="flex-1">
          <p className="text-xs font-semibold text-terra uppercase tracking-wide">
            {step === 'welcome' ? 'Benvenuto' : `Step ${current} di 3`}
          </p>
          <h2 className="text-lg font-bold text-caffe">Configurazione guidata</h2>
        </div>
        <span className="text-xs font-semibold text-slate-400">{done}/3</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-1.5 rounded-full ${i <= current ? 'bg-terra' : 'bg-slate-100'}`} />
        ))}
      </div>
    </div>
  )
}

function WelcomeStep({ onStart, counts }: { onStart: () => void; counts: SetupStatus['counts'] }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xl font-bold text-caffe leading-tight">In pochi minuti MIRA capisce il tuo locale.</h3>
        <p className="text-sm text-slate-500 mt-3 leading-relaxed">
          Ti chiedera prima menu o listino, poi una o piu fatture, infine Telegram. Dopo questi passaggi potra confrontare cosa vendi con cosa compri e avvisarti quando qualcosa non torna.
        </p>
      </div>
      <div className="space-y-3">
        <IntroRow Icon={ChefHat} title="Menu o listino" text="Serve per capire piatti, vini, cocktail e prezzi di vendita." />
        <IntroRow Icon={FileText} title="Fatture fornitori" text="Servono per leggere prodotti acquistati, quantita, prezzi e scorte." />
        <IntroRow Icon={MessageCircle} title="Telegram" text="Riceverai briefing, promemoria, report e potrai scrivere sprechi o eccedenze al volo." />
      </div>
      {(counts.piatti > 0 || counts.fatture > 0 || counts.scorte > 0) && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-caffe">Hai gia qualcosa caricato</p>
          <p className="text-xs text-slate-500 mt-1">
            {counts.piatti} voci menu, {counts.fatture} fatture, {counts.scorte} prodotti in scorte.
          </p>
        </div>
      )}
      <button onClick={onStart} className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2">
        Inizia
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

function MenuStep(props: {
  done: boolean
  analisi: 'idle' | 'loading' | 'ok' | 'err'
  errore: string
  result: { totale: number; ingredienti: number } | null
  piatti: PiattoForm[]
  nuovoPiatto: PiattoForm
  savingMenu: boolean
  setNuovoPiatto: React.Dispatch<React.SetStateAction<PiattoForm>>
  onChooseFile: () => void
  onAdd: () => void
  onSaveManual: () => void
  onRemoveManual: (index: number) => void
  onNext: () => void
}) {
  return (
    <div className="space-y-5">
      <StepTitle
        Icon={ChefHat}
        title="Partiamo dal menu"
        text="Prima leggiamo cosa vendi. Poi, con le fatture, MIRA capira quali ingredienti e prodotti servono davvero per quei piatti o bevande."
      />
      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        {props.analisi === 'loading' && <LoadingLine text="Leggo menu, vini, cocktail e prezzi..." />}
        {props.analisi === 'err' && <ErrorBox text={props.errore} />}
        {props.analisi === 'ok' && (
          <SuccessBox
            title="Menu salvato"
            text={props.result?.totale ? `${props.result.totale} voci caricate tra piatti e bevande.` : 'Menu caricato. Puoi continuare con le fatture.'}
          />
        )}
        {props.analisi !== 'ok' && (
          <button onClick={props.onChooseFile} disabled={props.analisi === 'loading'} className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 text-sm font-semibold text-caffe flex items-center justify-center gap-2 disabled:opacity-50">
            <Camera size={16} />
            Scansiona menu o listino
          </button>
        )}
      </div>
      {props.analisi !== 'ok' && (
        <ManualMenuForm {...props} />
      )}
      {(props.done || props.analisi === 'ok') && (
        <button onClick={props.onNext} className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2">
          Continua con le fatture
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  )
}

function ManualMenuForm(props: {
  piatti: PiattoForm[]
  nuovoPiatto: PiattoForm
  savingMenu: boolean
  setNuovoPiatto: React.Dispatch<React.SetStateAction<PiattoForm>>
  onAdd: () => void
  onSaveManual: () => void
  onRemoveManual: (index: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400">oppure aggiungi a mano</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={props.nuovoPiatto.nome}
            onChange={e => props.setNuovoPiatto(p => ({ ...p, nome: e.target.value }))}
            placeholder="Nome piatto o bevanda"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra"
          />
          <input
            type="number"
            value={props.nuovoPiatto.prezzo}
            onChange={e => props.setNuovoPiatto(p => ({ ...p, prezzo: e.target.value }))}
            placeholder="Euro"
            className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={props.nuovoPiatto.categoria}
            onChange={e => props.setNuovoPiatto(p => ({ ...p, categoria: e.target.value }))}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra bg-white"
          >
            {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={props.onAdd} disabled={!props.nuovoPiatto.nome.trim()} className="px-4 py-2 bg-terra/10 text-terra font-semibold rounded-xl text-sm disabled:opacity-40">
            <Plus size={16} />
          </button>
        </div>
      </div>
      {props.piatti.length > 0 && (
        <div className="space-y-1.5">
          {props.piatti.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-sm text-caffe flex-1">{p.nome}</span>
              <span className="text-xs text-slate-400">{p.categoria}</span>
              {p.prezzo && <span className="text-xs font-semibold text-terra">EUR {p.prezzo}</span>}
              <button onClick={() => props.onRemoveManual(i)} className="text-slate-300 hover:text-rose-500">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={props.onSaveManual} disabled={props.savingMenu} className="w-full bg-terra text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50 mt-1">
            {props.savingMenu ? 'Salvo...' : `Salva ${props.piatti.length} voci`}
          </button>
        </div>
      )}
    </div>
  )
}

function FatturaStep(props: {
  done: boolean
  analisi: 'idle' | 'loading' | 'ok' | 'err'
  errore: string
  result: { ingredienti: number; fornitore?: string; righe?: number } | null
  onChooseFile: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-5">
      <StepTitle
        Icon={FileText}
        title="Ora carica una fattura"
        text="Carica tutte le fatture recenti che coprono gli ingredienti del menu. Una sola fattura puo bastare per partire, ma non per un food cost affidabile."
      />
      <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
        {props.analisi === 'loading' && <LoadingLine text="Leggo la fattura e aggiorno scorte e prezzi..." />}
        {props.analisi === 'err' && <ErrorBox text={props.errore} />}
        {props.analisi === 'ok' && (
          <SuccessBox
            title="Fattura salvata"
            text={props.result?.ingredienti ? `${props.result.ingredienti} prodotti caricati in Scorte. Se ti mancano fornitori o ingredienti del menu, carica un'altra fattura prima di continuare.` : `${props.result?.righe ?? 0} righe lette. Controlla Scorte per verificare.`}
            detail={props.result?.fornitore}
          />
        )}
        {props.analisi !== 'ok' && (
          <button onClick={props.onChooseFile} disabled={props.analisi === 'loading'} className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 text-sm font-semibold text-caffe flex items-center justify-center gap-2 disabled:opacity-50">
            <Camera size={16} />
            Scansiona fattura
          </button>
        )}
      </div>
      {(props.done || props.analisi === 'ok') && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={props.onChooseFile} className="rounded-xl border border-slate-200 text-slate-600 py-3 text-sm font-semibold">
            Carica altra fattura
          </button>
          <button onClick={props.onNext} className="rounded-xl bg-terra text-white py-3 text-sm font-semibold">
            Ho finito con le fatture
          </button>
        </div>
      )}
    </div>
  )
}

function TelegramStep(props: {
  done: boolean
  chatId: string
  saving: boolean
  error: string
  onOpenTelegram: () => void
  onVerify: () => void
  onChatIdChange: (value: string) => void
  onSaveChatId: () => void
}) {
  return (
    <div className="space-y-5">
      <StepTitle
        Icon={MessageCircle}
        title="Collega Telegram"
        text="Da qui MIRA diventa l'assistente che ti scrive: briefing, coperti, scorte critiche, sprechi, eccedenze e report di fine servizio."
      />
      <div className="space-y-3">
        <InfoLine title="Durante il giorno" text="Ti avvisa se mancano prodotti o se serve un ordine." />
        <InfoLine title="Durante il servizio" text="Puoi scrivere sprechi o avanzi senza aprire l'app." />
        <InfoLine title="A fine servizio" text="Ti restituisce report e anomalie da controllare." />
      </div>
      {props.done ? (
        <SuccessBox title="Telegram collegato" text="MIRA puo gia mandarti briefing e report." />
      ) : (
        <>
          <button onClick={props.onOpenTelegram} className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white bg-sky-500">
            <ExternalLink size={15} />
            Apri Telegram e premi START
          </button>
          <button onClick={props.onVerify} disabled={props.saving} className="w-full border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
            {props.saving ? 'Verifico...' : 'Ho premuto START, verifica'}
          </button>
          {props.error && <ErrorBox text={props.error} />}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer hover:text-slate-600">Collegamento manuale</summary>
            <div className="mt-2 space-y-2">
              <p>Se Telegram non si collega, incolla qui il Chat ID.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={props.chatId}
                  onChange={e => props.onChatIdChange(e.target.value)}
                  placeholder="es. 1234567890"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-terra"
                />
                <button onClick={props.onSaveChatId} disabled={!props.chatId.trim() || props.saving} className="px-3 py-2 bg-terra text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                  Salva
                </button>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  )
}

function StepTitle({ Icon, title, text }: { Icon: React.ElementType; title: string; text: string }) {
  return (
    <div>
      <div className="w-12 h-12 rounded-2xl bg-terra/10 text-terra flex items-center justify-center mb-4">
        <Icon size={22} />
      </div>
      <h3 className="text-2xl font-bold text-caffe leading-tight">{title}</h3>
      <p className="text-sm text-slate-500 mt-2 leading-relaxed">{text}</p>
    </div>
  )
}

function IntroRow({ Icon, title, text }: { Icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex gap-3 bg-slate-50 rounded-2xl p-4">
      <div className="w-9 h-9 rounded-xl bg-white text-terra flex items-center justify-center shrink-0">
        <Icon size={17} />
      </div>
      <div>
        <p className="text-sm font-semibold text-caffe">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

function InfoLine({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <p className="text-sm font-semibold text-caffe">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{text}</p>
    </div>
  )
}

function LoadingLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <Loader2 size={16} className="animate-spin text-terra" />
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  )
}

function SuccessBox({ title, text, detail }: { title: string; text: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3">
      <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-emerald-800 font-semibold">{title}</p>
        <p className="text-xs text-emerald-700 mt-0.5">{text}</p>
        {detail && <p className="text-xs text-emerald-700 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      {text}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-lg font-bold text-caffe">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}
