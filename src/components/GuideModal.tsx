import { useEffect, useRef, useState } from 'react'
import {
  X, Send, Camera, ChefHat, CheckCircle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Plus, Trash2,
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

interface PiattoForm {
  nome: string
  categoria: string
  prezzo: string
}

const BOT = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'Mirachef_bot'
const CATEGORIE = ['antipasto', 'primo', 'secondo', 'contorno', 'dessert', 'bevanda', 'altro']

export default function GuideModal({ ristoranteId, onNavigate }: Props) {
  const [tasks, setTasks]         = useState<Tasks>({ telegram: false, fattura: false, menu: false })
  const [loaded, setLoaded]       = useState(false)
  const [open, setOpen]           = useState(true)
  const [active, setActive]       = useState<keyof Tasks | null>('telegram')
  const [showComplete, setShowComplete] = useState(false)
  const menuFileRef               = useRef<HTMLInputElement>(null)
  const fatturaFileRef            = useRef<HTMLInputElement>(null)

  // Telegram
  const [chatId, setChatId]       = useState('')
  const [savingTg, setSavingTg]   = useState(false)
  const [tgSaved, setTgSaved]     = useState(false)
  const [tgError, setTgError]     = useState('')

  // Fattura AI
  const [analisiFattura, setAnalisiFattura] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [errFattura, setErrFattura] = useState('')
  const [fatturaResult, setFatturaResult] = useState<{
    ingredienti: number
    fornitore?: string
    righe?: number
  } | null>(null)

  // Menu manuale
  const [piatti, setPiatti]       = useState<PiattoForm[]>([])
  const [nuovoPiatto, setNuovoPiatto] = useState<PiattoForm>({ nome: '', categoria: 'primo', prezzo: '' })
  const [savingMenu, setSavingMenu] = useState(false)

  // Menu AI
  const [analisiMenu, setAnalisiMenu] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [errMenu, setErrMenu]     = useState('')

  useEffect(() => {
    async function checkTasks() {
      try {
        const [
          { data: rist },
          { count: nFatture },
          { count: nPiatti },
        ] = await Promise.all([
          supabase.from('ristoranti').select('telegram_chat_id').eq('id', ristoranteId).single(),
          supabase.from('fatture').select('*', { count: 'exact', head: true }).eq('ristorante_id', ristoranteId),
          supabase.from('piatti').select('*', { count: 'exact', head: true }).eq('ristorante_id', ristoranteId),
        ])
        const t = {
          telegram: !!rist?.telegram_chat_id,
          fattura:  (nFatture ?? 0) > 0,
          menu:     (nPiatti ?? 0) > 0,
        }
        setTasks(t)
        if (rist?.telegram_chat_id) setChatId(rist.telegram_chat_id)
        // auto-expand first incomplete task
        const first = (Object.keys(t) as (keyof Tasks)[]).find(k => !t[k])
        setActive(first ?? null)
      } finally {
        setLoaded(true)
      }
    }
    checkTasks()
  }, [ristoranteId])

  const allDone = tasks.telegram && tasks.fattura && tasks.menu

  if (!loaded || (allDone && !showComplete)) return null

  const done = Object.values(tasks).filter(Boolean).length
  const total = 3

  // ── Telegram ─────────────────────────────────────────────────

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
      setTimeout(() => setActive('fattura'), 800)
    } else {
      setTgError('Non risulta ancora collegato. Apri Telegram, premi START e poi riprova la verifica.')
    }
  }

  // ── Fattura AI ───────────────────────────────────────────────────────────

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
        setTasks(t => {
          const next = { ...t, fattura: true }
          if (next.telegram && next.fattura && next.menu) setShowComplete(true)
          return next
        })
      } catch (e) {
        setErrFattura(e instanceof Error ? e.message : 'Errore di rete')
        setAnalisiFattura('err')
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Menu AI ───────────────────────────────────────────────────

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
        if (!json.ok) throw new Error(json.error)
        setAnalisiMenu('ok')
        setTasks(t => {
          const next = { ...t, menu: true }
          if (next.telegram && next.fattura && next.menu) setShowComplete(true)
          return next
        })
      } catch (e) {
        setErrMenu(e instanceof Error ? e.message : 'Errore')
        setAnalisiMenu('err')
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Menu manuale ─────────────────────────────────────────────

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
        ristorante_id:        ristoranteId,
        nome,
        categoria:            p.categoria,
        prezzo_vendita:       p.prezzo ? Number(p.prezzo) : null,
        soglia_food_cost_pct: 35,
        attivo:               true,
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
    setTasks(t => {
      const next = { ...t, menu: true }
      if (next.telegram && next.fattura && next.menu) setShowComplete(true)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────

  function chiudiGuida() {
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 bg-terra text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-terra/30"
      >
        <span className="text-xs font-bold">{total - done}/{total}</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {showComplete ? (
          <div className="p-6 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-caffe">MIRA pronta</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Telegram, fattura e menu sono collegati. Ora puoi controllare le scorte caricate e iniziare a usare il servizio.
              </p>
            </div>
            {fatturaResult && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Ultima fattura caricata</p>
                <p className="text-xs text-emerald-700 mt-1">
                  {fatturaResult.ingredienti
                    ? `${fatturaResult.ingredienti} prodotti caricati in Scorte`
                    : `${fatturaResult.righe ?? 0} righe lette. Controlla Scorte.`}
                </p>
              </div>
            )}
            <button
              onClick={() => {
                localStorage.setItem('mira_guide_dismissed', 'true')
                setShowComplete(false)
                setOpen(false)
                onNavigate('magazzino')
              }}
              className="w-full bg-terra text-white font-semibold rounded-xl py-3.5"
            >
              Vai a Scorte
            </button>
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-caffe">Configura MIRA</h2>
            <p className="text-xs text-slate-400 mt-0.5">{done} di {total} completati</p>
          </div>
          <button onClick={chiudiGuida} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl" aria-label="Riduci guida">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-5 h-1.5 bg-slate-100 rounded-full mb-4 shrink-0">
          <div
            className="h-full bg-terra rounded-full transition-all duration-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>

        {/* Tasks */}
        <div className="overflow-y-auto px-5 pb-6 space-y-3">

          {/* ── TELEGRAM ─── */}
          <TaskCard
            id="telegram"
            icon={<Send size={16} className="text-[#229ED9]" />}
            iconBg="bg-[#229ED9]/10"
            title="Collega Telegram"
            desc="Briefing mattutino, alert scorte e Report alle 00:30 automatici. Parla col bot in italiano, anche in vocale."
            done={tasks.telegram}
            active={active === 'telegram'}
            onToggle={() => setActive(active === 'telegram' ? null : 'telegram')}
          >
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm">
                <p className="font-semibold text-caffe">In automatico ogni giorno:</p>
                <div className="flex gap-2 text-slate-600"><span>☀️</span><span><strong>Briefing mattutino</strong> — ordini urgenti, scadenze, coperti da chiedere allo chef</span></div>
                <div className="flex gap-2 text-slate-600"><span>📊</span><span><strong>Report alle 00:30</strong> — sprechi, carichi, fatture del giorno</span></div>
                <div className="flex gap-2 text-slate-600"><span>🗣️</span><span><strong>Messaggi liberi</strong> — scrivi o manda un vocale al bot</span></div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-500">Tocca il pulsante → Telegram si apre → premi <strong>START</strong> → collegato in automatico.</p>

                {/* Bottone primario — usa button+window.open per evitare problemi iOS PWA */}
                <button
                  onClick={() => window.open(`https://t.me/${BOT}?start=${ristoranteId}`, '_blank')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: '#229ED9' }}
                >
                  <ExternalLink size={15} />
                  Apri Telegram — premi START
                </button>

                {tgSaved ? (
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-3">
                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-700 font-medium">Telegram collegato!</p>
                  </div>
                ) : (
                  <button
                    onClick={verificaTelegram}
                    disabled={savingTg}
                    className="w-full border border-slate-200 text-slate-500 rounded-xl py-2.5 text-xs disabled:opacity-50"
                  >
                    {savingTg ? 'Verifico collegamento…' : '✓ Ho premuto START — verifica'}
                  </button>
                )}

                {tgError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {tgError}
                  </div>
                )}

                {/* Fallback: già usavi il bot → chat ID manuale */}
                <details className="text-xs text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-600">Hai già usato il bot e non ti registra?</summary>
                  <div className="mt-2 space-y-2">
                    <p>Apri la chat del bot e scrivi: <code className="bg-slate-100 px-1 rounded">/start {ristoranteId}</code></p>
                    <p>Oppure incolla qui il Chat ID (il bot te lo mostra scrivendo qualcosa):</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={chatId}
                        onChange={e => setChatId(e.target.value)}
                        placeholder="es. 1234567890"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-terra"
                      />
                      <button
                        onClick={async () => {
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
                          setTimeout(() => setActive('fattura'), 800)
                        }}
                        disabled={!chatId.trim() || savingTg}
                        className="px-3 py-2 bg-terra text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                      >
                        Salva
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </TaskCard>

          {/* ── FATTURA ─── */}
          <TaskCard
            id="fattura"
            icon={<Camera size={16} className="text-terra" />}
            iconBg="bg-terra/10"
            title="Carica prima fattura"
            desc="MIRA legge i tuoi fornitori, ingredienti e prezzi automaticamente da foto o PDF. Non serve inserire nulla a mano."
            done={tasks.fattura}
            active={active === 'fattura'}
            onToggle={() => setActive(active === 'fattura' ? null : 'fattura')}
            keepOpenWhenDone={analisiFattura === 'ok'}
          >
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Fotografa o carica una fattura fornitore: MIRA legge prodotti, quantita e prezzi senza farti uscire dalla guida.</p>
              <div className="bg-slate-50 rounded-xl p-3">
                {analisiFattura === 'loading' && (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 size={16} className="animate-spin text-terra" />
                    <p className="text-sm text-slate-600">Leggo la fattura...</p>
                  </div>
                )}
                {analisiFattura === 'ok' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-emerald-800 font-semibold">Fattura salvata</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {fatturaResult?.ingredienti
                            ? `${fatturaResult.ingredienti} prodotti caricati in Scorte`
                            : `${fatturaResult?.righe ?? 0} righe lette. Controlla Scorte per verificare i prodotti.`}
                        </p>
                        {fatturaResult?.fornitore && (
                          <p className="text-xs text-emerald-700 mt-0.5">Fornitore: {fatturaResult.fornitore}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setOpen(false); onNavigate('magazzino') }}
                        className="rounded-xl bg-terra text-white py-2.5 text-xs font-semibold"
                      >
                        Vedi Scorte
                      </button>
                      <button
                        onClick={() => setActive('menu')}
                        className="rounded-xl border border-slate-200 text-slate-600 py-2.5 text-xs font-semibold"
                      >
                        Continua
                      </button>
                    </div>
                  </div>
                )}
                {analisiFattura === 'err' && (
                  <p className="text-xs text-rose-600 mb-2">{errFattura}</p>
                )}
                {analisiFattura !== 'ok' && (
                  <button
                    onClick={() => fatturaFileRef.current?.click()}
                    disabled={analisiFattura === 'loading'}
                    className="w-full border border-dashed border-slate-300 rounded-xl py-3 text-sm font-semibold text-caffe hover:border-terra hover:text-terra disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Camera size={15} />
                    Scansiona fattura ora
                  </button>
                )}
                <input
                  ref={fatturaFileRef}
                  type="file"
                  accept={ACCEPTED_AI_FILES}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) analizzaFattura(f); e.target.value = '' }}
                />
              </div>
              <button
                onClick={() => { setOpen(false); onNavigate('fattura') }}
                className="w-full border border-slate-200 text-slate-500 font-medium rounded-xl py-2.5 text-xs flex items-center justify-center gap-2"
              >
                <Camera size={15} />
                Apri pagina Fatture
              </button>
            </div>
          </TaskCard>

          {/* ── MENU ─── */}
          <TaskCard
            id="menu"
            icon={<ChefHat size={16} className="text-indigo-600" />}
            iconBg="bg-indigo-100"
            title="Inserisci menu o listino"
            desc="Aggiungi piatti, vini e bevande per calcolare automaticamente margini, food cost e scarico scorte."
            done={tasks.menu}
            active={active === 'menu'}
            onToggle={() => setActive(active === 'menu' ? null : 'menu')}
            keepOpenWhenDone={analisiMenu === 'ok'}
          >
            <div className="space-y-4">
              {/* AI: fotografa menu */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-maro mb-2">Fotografa menu o listino — l'AI estrae tutto</p>
                {analisiMenu === 'loading' && (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 size={16} className="animate-spin text-terra" />
                    <p className="text-sm text-slate-600">Leggo menu e listino…</p>
                  </div>
                )}
                {analisiMenu === 'ok' && (
                  <div className="flex items-center gap-2 py-2">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <p className="text-sm text-emerald-700 font-semibold">Menu salvato!</p>
                  </div>
                )}
                {analisiMenu === 'err' && (
                  <p className="text-xs text-rose-600 mb-2">{errMenu}</p>
                )}
                {analisiMenu !== 'ok' && (
                  <button
                    onClick={() => menuFileRef.current?.click()}
                    disabled={analisiMenu === 'loading'}
                    className="w-full border border-dashed border-slate-300 rounded-xl py-2.5 text-sm text-slate-500 hover:border-terra hover:text-terra disabled:opacity-50"
                  >
                    📷 Fotografa o carica foto/PDF del menu/listino
                  </button>
                )}
                <input
                  ref={menuFileRef}
                  type="file"
                  accept={ACCEPTED_AI_FILES}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) analizzaMenu(f); e.target.value = '' }}
                />
              </div>

              {/* Separatore */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">oppure scrivi manualmente</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Form aggiunta piatto */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nuovoPiatto.nome}
                    onChange={e => setNuovoPiatto(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome piatto o bevanda"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra"
                  />
                  <input
                    type="number"
                    value={nuovoPiatto.prezzo}
                    onChange={e => setNuovoPiatto(p => ({ ...p, prezzo: e.target.value }))}
                    placeholder="€"
                    className="w-16 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={nuovoPiatto.categoria}
                    onChange={e => setNuovoPiatto(p => ({ ...p, categoria: e.target.value }))}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra bg-white"
                  >
                    {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={aggiungiPiatto}
                    disabled={!nuovoPiatto.nome.trim()}
                    className="px-4 py-2 bg-terra/10 text-terra font-semibold rounded-xl text-sm disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Lista piatti aggiunti */}
              {piatti.length > 0 && (
                <div className="space-y-1.5">
                  {piatti.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-caffe flex-1">{p.nome}</span>
                      <span className="text-xs text-slate-400">{p.categoria}</span>
                      {p.prezzo && <span className="text-xs font-semibold text-terra">€{p.prezzo}</span>}
                      <button onClick={() => setPiatti(pl => pl.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={salvaMenu}
                    disabled={savingMenu}
                    className="w-full bg-terra text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50 mt-1"
                  >
                    {savingMenu ? 'Salvo…' : `Salva ${piatti.length} piatt${piatti.length === 1 ? 'o' : 'i'}`}
                  </button>
                </div>
              )}
            </div>
          </TaskCard>
        </div>
        </>
        )}
      </div>
    </div>
  )
}

// ── Sub-component ─────────────────────────────────────────────

function TaskCard({
  id, icon, iconBg, title, desc, done, active, onToggle, children, keepOpenWhenDone = false,
}: {
  id: string
  icon: React.ReactNode
  iconBg: string
  title: string
  desc: string
  done: boolean
  active: boolean
  onToggle: () => void
  children: React.ReactNode
  keepOpenWhenDone?: boolean
}) {
  return (
    <div className={`rounded-2xl border transition-all ${done ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${done ? 'bg-emerald-100' : iconBg}`}>
          {done ? <CheckCircle size={16} className="text-emerald-600" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${done ? 'text-emerald-700 line-through' : 'text-caffe'}`}>{title}</p>
          {!done && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>}
        </div>
        {(!done || keepOpenWhenDone) && (
          <div className="shrink-0 text-slate-300">
            {active ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {active && (!done || keepOpenWhenDone) && (
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-slate-100 pt-3">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
