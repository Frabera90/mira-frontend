import { useEffect, useRef, useState } from 'react'
import {
  X, Send, Camera, ChefHat, CheckCircle, ChevronDown, ChevronUp,
  ExternalLink, Loader2, Plus, Trash2,
} from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'

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
  const fileRef                   = useRef<HTMLInputElement>(null)

  // Telegram
  const [chatId, setChatId]       = useState('')
  const [savingTg, setSavingTg]   = useState(false)
  const [tgSaved, setTgSaved]     = useState(false)

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
  if (!loaded || allDone) return null

  const done = Object.values(tasks).filter(Boolean).length
  const total = 3

  // ── Telegram ─────────────────────────────────────────────────

  async function verificaTelegram() {
    setSavingTg(true)
    const { data } = await supabase.from('ristoranti').select('telegram_chat_id').eq('id', ristoranteId).single()
    setSavingTg(false)
    if (data?.telegram_chat_id) {
      setTgSaved(true)
      setTasks(t => ({ ...t, telegram: true }))
      setTimeout(() => setActive('fattura'), 800)
    } else {
      alert('Non ancora collegato. Apri Telegram e premi START sul bot.')
    }
  }

  // ── Menu AI ───────────────────────────────────────────────────

  async function analizzaMenu(file: File) {
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
        setTasks(t => ({ ...t, menu: true }))
        setTimeout(() => setActive(null), 1500)
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
    const rows = piatti.map(p => ({
      ristorante_id:  ristoranteId,
      nome:           p.nome.trim(),
      categoria:      p.categoria,
      prezzo_vendita: p.prezzo ? Number(p.prezzo) : null,
      disponibile:    true,
    }))
    await supabase.from('piatti').upsert(rows, { onConflict: 'ristorante_id,nome' })
    setSavingMenu(false)
    setTasks(t => ({ ...t, menu: true }))
    setTimeout(() => setActive(null), 800)
  }

  // ── Render ────────────────────────────────────────────────────

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
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-caffe">Configura MIRA</h2>
            <p className="text-xs text-slate-400 mt-0.5">{done} di {total} completati</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl">
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
            desc="Briefing mattutino, alert scorte e report serale automatici. Parla col bot in italiano — anche in vocale."
            done={tasks.telegram}
            active={active === 'telegram'}
            onToggle={() => setActive(active === 'telegram' ? null : 'telegram')}
          >
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm">
                <p className="font-semibold text-caffe">In automatico ogni giorno:</p>
                <div className="flex gap-2 text-slate-600"><span>☀️</span><span><strong>Briefing mattutino</strong> — ordini urgenti, scadenze, prenotazioni</span></div>
                <div className="flex gap-2 text-slate-600"><span>📊</span><span><strong>Report serale</strong> — sprechi, carichi, fatture del giorno</span></div>
                <div className="flex gap-2 text-slate-600"><span>🗣️</span><span><strong>Messaggi liberi</strong> — scrivi o manda un vocale al bot</span></div>
              </div>

              <p className="text-xs text-slate-500">Tocca il pulsante → Telegram si apre → premi <strong>START</strong> → collegato automaticamente.</p>

              <a
                href={`https://t.me/${BOT}?start=${ristoranteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#229ED9] text-white font-semibold rounded-xl py-3.5 text-sm"
              >
                <ExternalLink size={15} />
                Collega Telegram — premi START
              </a>

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
                  {savingTg ? 'Verifico…' : 'Ho premuto START sul bot ✓'}
                </button>
              )}
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
          >
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Vai alla sezione <strong>Magazzino</strong> → tocca <strong>"Scansiona fattura"</strong>. Poi fotografa o carica un PDF di una qualsiasi fattura fornitore.</p>
              <button
                onClick={() => { setOpen(false); onNavigate('magazzino') }}
                className="w-full bg-terra text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2"
              >
                <Camera size={15} />
                Vai a Magazzino → Scansiona fattura
              </button>
            </div>
          </TaskCard>

          {/* ── MENU ─── */}
          <TaskCard
            id="menu"
            icon={<ChefHat size={16} className="text-indigo-600" />}
            iconBg="bg-indigo-100"
            title="Inserisci il menu"
            desc="Aggiungi i tuoi piatti per calcolare automaticamente il food cost e tenere traccia della marginalità."
            done={tasks.menu}
            active={active === 'menu'}
            onToggle={() => setActive(active === 'menu' ? null : 'menu')}
          >
            <div className="space-y-4">
              {/* AI: fotografa menu */}
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-maro mb-2">Fotografa il menu — l'AI estrae tutto</p>
                {analisiMenu === 'loading' && (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 size={16} className="animate-spin text-terra" />
                    <p className="text-sm text-slate-600">Leggo il menu…</p>
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
                    onClick={() => fileRef.current?.click()}
                    disabled={analisiMenu === 'loading'}
                    className="w-full border border-dashed border-slate-300 rounded-xl py-2.5 text-sm text-slate-500 hover:border-terra hover:text-terra disabled:opacity-50"
                  >
                    📷 Fotografa o carica foto/PDF del menu
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
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
                    placeholder="Nome piatto"
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
      </div>
    </div>
  )
}

// ── Sub-component ─────────────────────────────────────────────

function TaskCard({
  id, icon, iconBg, title, desc, done, active, onToggle, children,
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
        {!done && (
          <div className="shrink-0 text-slate-300">
            {active ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </button>

      {active && !done && (
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-slate-100 pt-3">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
