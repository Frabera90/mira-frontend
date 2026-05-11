import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ShoppingCart, AlertTriangle, CheckCircle2, Truck, Share2, History, ChefHat, Mail, X } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface OrdineRow {
  ingrediente_id: string
  ingrediente_nome: string
  tipo_prodotto: string
  fornitore_id: string | null
  fornitore_nome: string | null
  stock_attuale: number
  consumo_medio_giornaliero: number
  giorni_copertura_attuale: number
  giorni_copertura_target: number
  quantita_suggerita: number
  costo_stimato: number | null
  urgente: boolean
  deve_ordinare_oggi: boolean
  giorno_ordine_suggerito: string
  motivazione: string
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

interface OrdiniProps {
  onNavigate?: (page: string) => void
}

export default function Ordini({ onNavigate }: OrdiniProps) {
  const ristoranteId = useRistorante()
  const [ordini, setOrdini]           = useState<OrdineRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [soloUrgenti, setSoloUrgenti] = useState(false)
  const [errore, setErrore]           = useState<string | null>(null)
  const [tick, setTick]               = useState(0)
  const [confermati, setConfermati]   = useState<Set<string>>(new Set())
  const [confermando, setConfermando] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<Record<string, { inviata: boolean; motivo?: string; testo_ordine?: string; fornitore_email?: string | null }>>({})
  const [mostraTestoOrdine, setMostraTestoOrdine] = useState<string | null>(null)

  const carica = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    setLoading(true)
    setErrore(null)
    supabase
      .rpc('calcola_ordini_suggeriti', {
        p_ristorante_id: ristoranteId,
        p_data_calcolo: new Date().toISOString().slice(0, 10),
        p_solo_urgenti: soloUrgenti,
      })
      .then(({ data, error }) => {
        if (error) setErrore(error.message)
        else setOrdini((data as OrdineRow[]) ?? [])
        setLoading(false)
      })
  }, [ristoranteId, soloUrgenti, tick])

  useEffect(() => {
    const onFocus = () => carica()
    window.addEventListener('focus', onFocus)

    const channel = supabase
      .channel(`ordini-live-${ristoranteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scorte', filter: `ristorante_id=eq.${ristoranteId}` }, carica)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordini', filter: `ristorante_id=eq.${ristoranteId}` }, carica)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti_scorte', filter: `ristorante_id=eq.${ristoranteId}` }, carica)
      .subscribe()

    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
  }, [carica, ristoranteId])

  async function confermaOrdine(o: OrdineRow) {
    setConfermando(o.ingrediente_id)
    try {
      const res  = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/ordini/conferma`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredienteId: o.ingrediente_id,
          fornitoreId:   o.fornitore_id ?? null,
          quantita:      o.quantita_suggerita,
          costoStimato:  o.costo_stimato ?? null,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setConfermati(prev => new Set([...prev, o.ingrediente_id]))
        if (json.email) setEmailStatus(prev => ({ ...prev, [o.ingrediente_id]: json.email }))
      }
    } finally {
      setConfermando(null)
    }
  }

  const costoTotale  = ordini.reduce((s, o) => s + (o.costo_stimato ?? 0), 0)
  const urgentiCount = ordini.filter(o => o.urgente).length

  function esportaOrdine() {
    const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const gruppi = new Map<string, OrdineRow[]>()
    for (const o of ordini) {
      const key = o.fornitore_nome ?? 'Fornitore non assegnato'
      if (!gruppi.has(key)) gruppi.set(key, [])
      gruppi.get(key)!.push(o)
    }
    let testo = `🛒 Ordine MIRA — ${oggi}\n\n`
    for (const [fornitore, righe] of gruppi) {
      testo += `📦 ${fornitore}:\n`
      for (const r of righe) {
        testo += `• ${r.ingrediente_nome}: ${Number(r.quantita_suggerita).toFixed(2)}\n`
      }
      testo += '\n'
    }
    if (costoTotale > 0) testo += `💰 Totale stimato: €${costoTotale.toFixed(2)}\n`
    if (navigator.share) {
      navigator.share({ title: 'Ordine MIRA', text: testo }).catch(() => {})
    } else {
      navigator.clipboard.writeText(testo).then(() => alert('Ordine copiato negli appunti'))
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-1">
        <div>
          <h1 className="text-xl font-semibold text-caffe">Ordini</h1>
          {!loading && !errore && (
            <p className="text-sm text-maro mt-0.5">
              {ordini.length} prodotti ·{' '}
              <span className="font-semibold text-caffe">€{costoTotale.toFixed(2)}</span> stimati
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!loading && ordini.length > 0 && (
            <button
              onClick={esportaOrdine}
              className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
              title="Esporta ordine"
            >
              <Share2 size={18} />
            </button>
          )}
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate('food-cost')}
                className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
                title="Food Cost"
              >
                <ChefHat size={18} />
              </button>
              <button
                onClick={() => onNavigate('storico-ordini')}
                className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
                title="Storico ordini"
              >
                <History size={18} />
              </button>
              <button
                onClick={() => onNavigate('fornitori')}
                className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
                title="Gestisci fornitori"
              >
                <Truck size={18} />
              </button>
            </>
          )}
          <button
            onClick={carica}
            className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
            title="Aggiorna"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {!loading && urgentiCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2.5 mb-4 mt-3">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <p className="text-sm text-rose-700 font-medium">
            {urgentiCount} prodott{urgentiCount === 1 ? 'o' : 'i'} da ordinare oggi
          </p>
        </div>
      )}

      {!loading && urgentiCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-amber-900">Inventory predictor</p>
          <p className="text-sm text-amber-800 mt-0.5">
            MIRA sta usando ritmo consumi, scorte e copertura stimata: conferma solo gli ordini che vuoi inviare al fornitore.
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-4 mt-3">
        {([false, true] as const).map(u => (
          <button
            key={String(u)}
            onClick={() => setSoloUrgenti(u)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              soloUrgenti === u
                ? 'bg-terra text-white'
                : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {u ? 'Solo urgenti' : 'Tutti'}
          </button>
        ))}
      </div>

      {errore && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 mb-3">
          {errore}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      )}

      <div className="space-y-3">
        {ordini.map(o => {
          const isConfermato  = confermati.has(o.ingrediente_id)
          const isConfermando = confermando === o.ingrediente_id

          const accentColor =
            isConfermato         ? 'border-l-emerald-500' :
            o.stock_attuale <= 0 ? 'border-l-rose-600' :
            o.urgente            ? 'border-l-orange-500' :
            o.deve_ordinare_oggi ? 'border-l-amber-400' :
            'border-l-indigo-300'

          return (
            <div
              key={o.ingrediente_id}
              className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-4 transition-opacity ${accentColor} ${
                isConfermato ? 'opacity-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-semibold text-caffe">{o.ingrediente_nome}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{o.fornitore_nome ?? 'Fornitore non assegnato'}</p>
                </div>
                <StatusBadge
                  isConfermato={isConfermato}
                  esaurito={o.stock_attuale <= 0}
                  urgente={o.urgente}
                  oggi={o.deve_ordinare_oggi}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <Metric label="Copertura"     value={`${Number(o.giorni_copertura_attuale).toFixed(1)} gg`} />
                <Metric label="Da ordinare"   value={Number(o.quantita_suggerita).toFixed(2)} accent />
                <Metric label="Costo stimato" value={o.costo_stimato != null ? `€${Number(o.costo_stimato).toFixed(2)}` : '—'} />
              </div>

              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">{o.motivazione}</p>
              <p className="text-xs text-slate-300 mt-1">
                Ordine suggerito:{' '}
                {new Date(o.giorno_ordine_suggerito).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
              </p>

              {!isConfermato && (
                <button
                  onClick={() => confermaOrdine(o)}
                  disabled={isConfermando}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold active:scale-[0.99] transition-all disabled:opacity-50 hover:bg-slate-100"
                >
                  <ShoppingCart size={15} />
                  {isConfermando ? 'Invio in corso…' : 'Conferma ordine'}
                </button>
              )}

              {isConfermato && emailStatus[o.ingrediente_id] && (
                <div className="mt-2">
                  {emailStatus[o.ingrediente_id].inviata ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                      <Mail size={12} /> Email inviata a {emailStatus[o.ingrediente_id].fornitore_email}
                    </p>
                  ) : emailStatus[o.ingrediente_id].testo_ordine ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Mail size={12} /> Email non inviata
                      </p>
                      <button
                        onClick={() => setMostraTestoOrdine(emailStatus[o.ingrediente_id].testo_ordine ?? null)}
                        className="text-xs text-terra underline"
                      >
                        Copia testo ordine
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}

        {!loading && !errore && ordini.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {soloUrgenti ? 'Nessun ordine urgente' : 'Nessun ordine suggerito'}
            </p>
          </div>
        )}
      </div>

      {/* Modal testo ordine da copiare */}
      {mostraTestoOrdine && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setMostraTestoOrdine(null)}>
          <div className="bg-white rounded-t-2xl p-5 w-full max-w-[480px] mx-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-caffe">Testo ordine</p>
              <button onClick={() => setMostraTestoOrdine(null)} className="text-slate-400 p-1"><X size={16} /></button>
            </div>
            <textarea
              readOnly
              value={mostraTestoOrdine}
              rows={10}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono resize-none"
            />
            <button
              onClick={() => { navigator.clipboard.writeText(mostraTestoOrdine); setMostraTestoOrdine(null) }}
              className="mt-3 w-full bg-terra text-white font-semibold rounded-xl py-3 text-sm"
            >
              Copia negli appunti
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ isConfermato, esaurito, urgente, oggi }: {
  isConfermato: boolean; esaurito: boolean; urgente: boolean; oggi: boolean
}) {
  if (isConfermato)
    return <span className="text-[11px] bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full shrink-0">Inviato</span>
  if (esaurito)
    return <span className="text-[11px] bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded-full shrink-0">Esaurito</span>
  if (urgente)
    return <span className="text-[11px] bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full shrink-0">Urgente</span>
  if (oggi)
    return <span className="text-[11px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full shrink-0">Oggi</span>
  return <span className="text-[11px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full shrink-0">Pianificato</span>
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5 text-center">
      <p className="text-[10px] text-slate-400 mb-0.5 font-medium">{label}</p>
      <p className={`text-sm font-bold ${accent ? 'text-terra' : 'text-caffe'}`}>{value}</p>
    </div>
  )
}
