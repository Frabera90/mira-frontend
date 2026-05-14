import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, Clock, Users, TrendingUp,
  Package, CalendarDays, Settings, ChefHat, ChevronRight,
  Camera, UtensilsCrossed, Truck, ClipboardCheck, CheckCircle,
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
interface PredictorAlert {
  ingrediente: string
  giorni_copertura: number
  quantita_suggerita: number
  costo_stimato: number | null
  fornitore: string | null
  messaggio: string
}
interface SetupIssue {
  key: string
  severity: 'blocking' | 'important'
  title: string
  text: string
  action: { label: string; page: string }
}
interface SetupStatus {
  ready: boolean
  counts: {
    fatture: number
    piatti: number
    scorte: number
    piatti_attivi?: number
    piatti_con_ricetta?: number
    piatti_con_food_cost?: number
    prodotti_prezzo?: number
    prodotti_totali?: number
  }
  quality: {
    score: number
    summary: string
    issues: SetupIssue[]
    next_action: { label: string; page: string }
  }
}

export default function Casa({ onNavigate }: CasaProps) {
  const ristoranteId = useRistorante()
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [foodCostKpi, setFoodCostKpi] = useState<FoodCostKpi | null>(null)
  const [predictor, setPredictor] = useState<PredictorAlert[]>([])
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
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

  const caricaPredictor = useCallback(() => {
    fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/inventory-predictor`)
      .then(r => r.json())
      .then(j => { if (j.ok) setPredictor(j.data ?? []) })
      .catch(() => {})
  }, [ristoranteId])

  useEffect(() => {
    caricaPredictor()
  }, [caricaPredictor])

  const caricaSetup = useCallback(() => {
    fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/setup-status`)
      .then(r => r.json())
      .then(j => { if (j.ok) setSetupStatus(j.data) })
      .catch(() => {})
  }, [ristoranteId])

  useEffect(() => {
    caricaSetup()
  }, [caricaSetup])

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

  useEffect(() => {
    const refresh = () => {
      carica()
      caricaPredictor()
      caricaSetup()
    }
    window.addEventListener('focus', refresh)

    const channel = supabase
      .channel(`casa-live-${ristoranteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scorte', filter: `ristorante_id=eq.${ristoranteId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti_scorte', filter: `ristorante_id=eq.${ristoranteId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini', filter: `ristorante_id=eq.${ristoranteId}` }, refresh)
      .subscribe()

    return () => {
      window.removeEventListener('focus', refresh)
      supabase.removeChannel(channel)
    }
  }, [carica, caricaPredictor, caricaSetup, ristoranteId])

  const ora   = new Date().getHours()
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const oggi  = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const copertiPrevisti = briefing?.prenotazioni.reduce((s, p) => s + (p.coperti ?? 0), 0) ?? 0

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

      {onNavigate && setupStatus && (
        <MiraStatusCard status={setupStatus} onNavigate={onNavigate} />
      )}

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
            value={copertiPrevisti}
            label="Coperti"
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

      {onNavigate && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { Icon: Camera,          label: 'Fattura',       page: 'fattura',      tone: 'text-terra bg-terra/10' },
            { Icon: UtensilsCrossed, label: 'Menu',          page: 'menu',         tone: 'text-caffe bg-slate-100' },
            { Icon: Users,           label: 'Fine servizio', page: 'vendite-csv',  tone: 'text-emerald-700 bg-emerald-50' },
          ].map(({ Icon, label, page, tone }) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon size={19} />
              </div>
              <span className="text-[11px] font-semibold text-caffe">{label}</span>
            </button>
          ))}
        </div>
      )}

      {errore && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <strong>Errore:</strong> {errore}
        </div>
      )}

      {onNavigate && predictor.length > 0 && (
        <button
          onClick={() => onNavigate('ordini')}
          className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left flex gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Inventory predictor</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {predictor[0].messaggio} Vuoi preparare l'ordine?
            </p>
          </div>
          <ChevronRight size={16} className="text-amber-500 shrink-0 mt-2" />
        </button>
      )}

      {/* Accesso rapido */}
      {onNavigate && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {[
            { icon: Truck,           label: 'Fornitori',   page: 'fornitori',    color: 'bg-indigo-50 text-indigo-600' },
            { icon: ClipboardCheck,  label: 'Sprechi/avanzi', page: 'vendite-csv',  color: 'bg-amber-50 text-amber-700' },
            { icon: CalendarDays,    label: 'Coperti',      page: 'prenotazioni', color: 'bg-amber-50 text-amber-600' },
            { icon: ChefHat,         label: 'Food Cost',   page: 'food-cost',    color: 'bg-emerald-50 text-emerald-600' },
          ].map(({ icon: Icon, label, page, color }) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className="flex flex-col items-center gap-1.5 bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm active:scale-95 transition-transform shrink-0"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={17} />
              </div>
              <span className="text-[11px] font-semibold text-caffe whitespace-nowrap">{label}</span>
            </button>
          ))}
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

          {/* Coperti previsti */}
          <Section
            title="Coperti previsti"
            Icon={CalendarDays}
            count={copertiPrevisti}
            accent="indigo"
            empty="Nessun coperto indicato"
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

function MiraStatusCard({ status, onNavigate }: { status: SetupStatus; onNavigate: (page: string) => void }) {
  const hasBasicSetup = Boolean(status.ready)
  const fallbackScore = hasBasicSetup ? 70 : 25
  const score = Math.max(0, Math.min(100, status.quality?.score ?? fallbackScore))
  const issue = status.quality?.issues?.[0]
  const action = issue?.action ?? status.quality?.next_action
  const ok = score >= 85 && !issue
  const scoreColor = score >= 85 ? 'text-emerald-700' : score >= 55 ? 'text-amber-700' : 'text-rose-700'
  const barColor = score >= 85 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-terra/10 text-terra'}`}>
          {ok ? <CheckCircle size={19} /> : <AlertTriangle size={19} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-caffe">MIRA è pronta?</p>
            <p className={`text-sm font-bold ${scoreColor}`}>{score}%</p>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {issue
              ? issue.text
              : status.quality?.summary ?? 'MIRA sta controllando menu, fatture, scorte e collegamento Telegram.'}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniMetric label="Menu" value={status.counts.piatti} />
            <MiniMetric label="Fatture" value={status.counts.fatture} />
            <MiniMetric label="Scorte" value={status.counts.scorte} />
          </div>
          {(status.counts.piatti_attivi ?? 0) > 0 && (
            <p className="text-[11px] text-slate-400 mt-2">
              Food cost calcolabile: {status.counts.piatti_con_food_cost ?? 0}/{status.counts.piatti_attivi ?? 0} voci menu · Prezzi: {status.counts.prodotti_prezzo ?? 0}/{status.counts.prodotti_totali ?? 0}
            </p>
          )}
        </div>
      </div>
      {action && (
        <button
          onClick={() => onNavigate(action.page)}
          className={`mt-4 w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 ${
            ok ? 'bg-emerald-600 text-white' : 'bg-terra text-white'
          }`}
        >
          {issue ? action.label : 'Continua con MIRA'}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2 text-center">
      <p className="text-sm font-bold text-caffe">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
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
