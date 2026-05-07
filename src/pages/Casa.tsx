import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, Clock, Users, TrendingUp,
  Package, CalendarDays, Settings, ChefHat, ChevronRight,
  Camera, ShoppingCart, Send,
} from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface OrdineUrgente {
  ingrediente: string
  stock_gg: number
  ordine_gg: number
  costo: number | null
  fornitore: string
}
interface ProdottoScadenza {
  ingrediente: string
  scadenza: string
  quantita: number
  giorni_rimasti: number
}
interface Prenotazione {
  data: string
  coperti: number
  cliente: string | null
  occasione: string | null
}
interface AlertPrezzo {
  ingrediente: string
  variazione: number
  prezzo_nuovo: number
  data: string
}
interface Briefing {
  data: string
  ordini_urgenti: OrdineUrgente[]
  prodotti_scadenza: ProdottoScadenza[]
  prenotazioni: Prenotazione[]
  alert_prezzi: AlertPrezzo[]
}

const IS_DEV = import.meta.env.VITE_SKIP_AUTH === 'true'

function DevPanel({ onRefresh }: { onRefresh: () => void }) {
  const ristoranteId = useRistorante()
  const [stato, setStato] = useState<Record<string, string>>({})

  async function chiama(label: string, path: string) {
    setStato(s => ({ ...s, [label]: 'loading' }))
    try {
      const res = await fetch(`${BACKEND_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ristoranteId: ristoranteId }),
      })
      const json = await res.json()
      setStato(s => ({ ...s, [label]: json.ok ? 'ok' : 'error' }))
      if (json.ok && label === 'simula') onRefresh()
    } catch {
      setStato(s => ({ ...s, [label]: 'error' }))
    }
  }

  return (
    <div className="border border-dashed border-slate-200 rounded-xl p-3 space-y-2">
      <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-widest">Dev tools</p>
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'simula', text: 'Simula giornata', path: '/api/test/simula-giornata' },
          { label: 'briefing', text: 'Briefing ora', path: '/api/test/briefing-ora' },
        ].map(({ label, text, path }) => (
          <button
            key={label}
            onClick={() => chiama(label, path)}
            disabled={stato[label] === 'loading'}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {text}
            {stato[label] === 'ok' && <span className="ml-1.5 text-emerald-500">✓</span>}
            {stato[label] === 'error' && <span className="ml-1.5 text-rose-500">✗</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

interface CasaProps {
  onNavigate?: (page: string) => void
}

interface FoodCostKpi {
  avgFoodCostPct: number | null
  inAlert: number
}

export default function Casa({ onNavigate }: CasaProps) {
  const ristoranteId = useRistorante()
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [foodCostKpi, setFoodCostKpi] = useState<FoodCostKpi | null>(null)
  const nomeChef = localStorage.getItem('mira_chef_name') || 'Chef'

  const carica = useCallback(() => {
    setLoading(true)
    setErrore(null)
    supabase
      .rpc('genera_briefing_mattutino', {
        p_ristorante_id: ristoranteId,
        p_data: new Date().toISOString().slice(0, 10),
      })
      .then(({ data, error }) => {
        if (error) setErrore(error.message)
        else setBriefing(data as Briefing ?? {
          ordini_urgenti: [], prodotti_scadenza: [], prenotazioni: [], alert_prezzi: [],
        })
        setLoading(false)
      })
  }, [ristoranteId])

  useEffect(() => { carica() }, [carica])

  useEffect(() => {
    supabase
      .from('piatti_food_cost')
      .select('food_cost_pct, soglia_food_cost_pct')
      .eq('ristorante_id', ristoranteId)
      .eq('attivo', true)
      .then(({ data, error }) => {
        if (error || !data?.length) return
        const withPct = data.filter(p => p.food_cost_pct !== null)
        const avg = withPct.length
          ? withPct.reduce((s, p) => s + (p.food_cost_pct ?? 0), 0) / withPct.length
          : null
        const inAlert = data.filter(
          p => p.food_cost_pct !== null && p.food_cost_pct > p.soglia_food_cost_pct
        ).length
        setFoodCostKpi({ avgFoodCostPct: avg, inAlert })
      })
  }, [ristoranteId])

  const ora   = new Date().getHours()
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const oggi  = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-xl font-semibold text-caffe">{saluto}, {nomeChef}</h1>
          <p className="text-maro text-sm capitalize mt-0.5">{oggi}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={carica}
            className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
            title="Aggiorna"
          >
            <RefreshCw size={18} />
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('impostazioni')}
              className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
              title="Impostazioni"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : briefing && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            value={briefing.ordini_urgenti.length}
            label="Ordini urgenti"
            Icon={AlertTriangle}
            colorKey="rose"
          />
          <KpiCard
            value={briefing.prodotti_scadenza.length}
            label="In scadenza"
            Icon={Clock}
            colorKey="amber"
          />
          <KpiCard
            value={briefing.prenotazioni.length}
            label="Prenotazioni"
            Icon={CalendarDays}
            colorKey="indigo"
            onClick={() => onNavigate?.('prenotazioni')}
          />
          <KpiCard
            value={briefing.alert_prezzi.length}
            label="Alert prezzi"
            Icon={TrendingUp}
            colorKey="emerald"
          />
        </div>
      )}

      {/* Food Cost banner */}
      {onNavigate && foodCostKpi && foodCostKpi.avgFoodCostPct !== null && (
        <button
          onClick={() => onNavigate('food-cost')}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <ChefHat size={17} className="text-terra" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-caffe">Food Cost medio</p>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className={`font-semibold ${foodCostKpi.inAlert > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {foodCostKpi.avgFoodCostPct.toFixed(1)}%
              </span>
              {foodCostKpi.inAlert > 0 && (
                <span className="ml-2 text-rose-600">{foodCostKpi.inAlert} piatti sopra soglia</span>
              )}
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-300 shrink-0" />
        </button>
      )}

      {errore && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <strong>Errore:</strong> {errore}
        </div>
      )}

      {/* Empty state — guida per nuovi utenti */}
      {briefing && !loading &&
        briefing.ordini_urgenti.length === 0 &&
        briefing.prodotti_scadenza.length === 0 &&
        briefing.prenotazioni.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="font-semibold text-caffe">Benvenuto! Inizia da qui 👇</p>
            <p className="text-xs text-slate-400 mt-1">Il magazzino è vuoto. Segui questi 3 passi per popolare MIRA.</p>
          </div>
          <div className="space-y-3">
            {[
              {
                n: '1', Icon: Camera, color: 'bg-terra/10 text-terra',
                titolo: 'Fotografa le tue fatture',
                desc: 'Vai in "Magazzino" → "Scansiona fattura". L\'AI legge fornitori, ingredienti e prezzi automaticamente.',
                cta: 'Vai a Magazzino', page: 'magazzino',
              },
              {
                n: '2', Icon: ShoppingCart, color: 'bg-indigo-100 text-indigo-600',
                titolo: 'Vedi i suggerimenti ordine',
                desc: 'Dopo aver caricato almeno 2 fatture, MIRA sa cosa ordinare e quando.',
                cta: 'Vai agli Ordini', page: 'ordini',
              },
              {
                n: '3', Icon: Send, color: 'bg-[#229ED9]/10 text-[#229ED9]',
                titolo: 'Collega Telegram',
                desc: 'Ogni mattina ricevi un briefing automatico. Puoi anche parlare col bot in vocale.',
                cta: 'Impostazioni', page: 'impostazioni',
              },
            ].map(({ n, Icon, color, titolo, desc, cta, page }) => (
              <div key={n} className="flex gap-3 items-start">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-caffe">{titolo}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(page)}
                      className="text-xs text-terra font-semibold mt-1.5 flex items-center gap-0.5"
                    >
                      {cta} <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing && (
        <div className="space-y-3">
          {/* Ordini urgenti */}
          <Section
            title="Ordini urgenti"
            Icon={AlertTriangle}
            count={briefing.ordini_urgenti.length}
            accent="rose"
            empty="Nessun ordine urgente"
          >
            {briefing.ordini_urgenti.map((o, i) => (
              <Row key={i}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center shrink-0">
                    <Package size={14} className="text-rose-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-caffe text-sm truncate">{o.ingrediente}</p>
                    <p className="text-xs text-slate-400 truncate">{o.fornitore}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-semibold text-rose-600">{Number(o.stock_gg).toFixed(1)} gg</p>
                  {o.costo != null && <p className="text-xs text-slate-400">€{Number(o.costo).toFixed(2)}</p>}
                </div>
              </Row>
            ))}
          </Section>

          {/* Prodotti in scadenza */}
          <Section
            title="In scadenza"
            Icon={Clock}
            count={briefing.prodotti_scadenza.length}
            accent="amber"
            empty="Nessun prodotto in scadenza"
          >
            {briefing.prodotti_scadenza.map((p, i) => (
              <Row key={i}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Clock size={14} className="text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-caffe text-sm truncate">{p.ingrediente}</p>
                    <p className="text-xs text-slate-400">qtà {p.quantita}</p>
                  </div>
                </div>
                <GiorniBadge gg={Number(p.giorni_rimasti)} />
              </Row>
            ))}
          </Section>

          {/* Prenotazioni */}
          <Section
            title="Prenotazioni"
            Icon={CalendarDays}
            count={briefing.prenotazioni.length}
            accent="indigo"
            empty="Nessuna prenotazione"
          >
            {briefing.prenotazioni.map((p, i) => (
              <Row key={i}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                    <Users size={14} className="text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-caffe text-sm truncate">{p.cliente ?? 'Senza nome'}</p>
                    <p className="text-xs text-slate-400">{p.occasione ?? '—'}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-semibold text-indigo-600">{p.coperti} cop.</p>
                  <p className="text-xs text-slate-400">
                    {new Date(p.data).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </Row>
            ))}
          </Section>

          {/* Alert prezzi */}
          {briefing.alert_prezzi.length > 0 && (
            <Section
              title="Alert prezzi"
              Icon={TrendingUp}
              count={briefing.alert_prezzi.length}
              accent="emerald"
              empty=""
            >
              {briefing.alert_prezzi.map((a, i) => (
                <Row key={i}>
                  <p className="font-medium text-caffe text-sm">{a.ingrediente}</p>
                  <span className="text-xs font-semibold text-emerald-600">+{Number(a.variazione).toFixed(1)}%</span>
                </Row>
              ))}
            </Section>
          )}
        </div>
      )}

      {IS_DEV && <DevPanel onRefresh={carica} />}
    </div>
  )
}

const KPI_COLORS = {
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    iconBg: 'bg-rose-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   iconBg: 'bg-amber-100' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  iconBg: 'bg-indigo-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100' },
}

function KpiCard({
  value, label, Icon, colorKey, onClick,
}: {
  value: number
  label: string
  Icon: React.ElementType
  colorKey: keyof typeof KPI_COLORS
  onClick?: () => void
}) {
  const c = KPI_COLORS[colorKey]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`${c.bg} rounded-2xl p-4 text-left w-full ${onClick ? 'active:scale-[0.98] transition-transform' : ''}`}
      onClick={onClick}
    >
      <div className={`${c.iconBg} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}>
        <Icon size={16} className={c.text} />
      </div>
      <p className={`text-2xl font-bold ${value > 0 ? c.text : 'text-slate-300'}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
    </Tag>
  )
}

const SECTION_ACCENT = {
  rose:    { dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700' },
  amber:   { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  indigo:  { dot: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700' },
  emerald: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
}

function Section({ title, Icon, count, accent, empty, children }: {
  title: string
  Icon: React.ElementType
  count: number
  accent: keyof typeof SECTION_ACCENT
  empty: string
  children: React.ReactNode
}) {
  const c = SECTION_ACCENT[accent]
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-slate-400" />
          <h2 className="font-semibold text-caffe text-sm">{title}</h2>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{count}</span>
      </div>
      <div className="px-4 pb-4 space-y-0">
        {count === 0 ? (
          <p className="text-xs text-slate-400 py-1">{empty}</p>
        ) : children}
      </div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
      {children}
    </div>
  )
}

function GiorniBadge({ gg }: { gg: number }) {
  const cfg =
    gg <= 0 ? 'bg-rose-100 text-rose-700'
    : gg === 1 ? 'bg-amber-100 text-amber-700'
    : 'bg-amber-50 text-amber-600'
  const label = gg <= 0 ? 'Scaduto' : `${gg}g`
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg}`}>{label}</span>
}
