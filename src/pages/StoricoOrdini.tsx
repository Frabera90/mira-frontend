import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Package, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface OrdineEffettuato {
  id: string
  data_ordine: string
  quantita: number
  costo_stimato: number | null
  stato: string
  ingrediente_id: string
  ingrediente_nome: string
  fornitore_nome: string | null
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

const STATO_CFG: Record<string, { label: string; cls: string }> = {
  inviato:    { label: 'Inviato',    cls: 'bg-indigo-100 text-indigo-700' },
  ricevuto:   { label: 'Ricevuto',   cls: 'bg-emerald-100 text-emerald-700' },
  annullato:  { label: 'Annullato',  cls: 'bg-slate-100 text-slate-500' },
}

interface Props {
  onBack: () => void
}

export default function StoricoOrdini({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const [ordini, setOrdini]   = useState<OrdineEffettuato[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick]       = useState(0)
  const [segnando, setSegnando] = useState<string | null>(null)

  const carica = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    setLoading(true)
    supabase
      .from('ordini_effettuati')
      .select(`
        id, data_ordine, quantita, costo_stimato, stato, ingrediente_id,
        ingredienti(nome),
        fornitori(nome)
      `)
      .eq('ristorante_id', ristoranteId)
      .order('data_ordine', { ascending: false })
      .order('creato_at', { ascending: false })
      .limit(80)
      .then(({ data }) => {
        const rows = ((data as any[]) ?? []).map(r => ({
          id:               r.id,
          data_ordine:      r.data_ordine,
          quantita:         r.quantita,
          costo_stimato:    r.costo_stimato,
          stato:            r.stato ?? 'inviato',
          ingrediente_id:   r.ingrediente_id,
          ingrediente_nome: Array.isArray(r.ingredienti) ? r.ingredienti[0]?.nome : r.ingredienti?.nome ?? '—',
          fornitore_nome:   Array.isArray(r.fornitori)   ? r.fornitori[0]?.nome   : r.fornitori?.nome ?? null,
        }))
        setOrdini(rows)
        setLoading(false)
      })
  }, [tick])

  async function segnaRicevuto(id: string) {
    setSegnando(id)
    const ordine = ordini.find(o => o.id === id)
    if (!ordine) { setSegnando(null); return }

    await supabase.from('ordini_effettuati').update({ stato: 'ricevuto' }).eq('id', id)

    const { data: scorta } = await supabase
      .from('scorte')
      .select('quantita_disponibile')
      .eq('ristorante_id', ristoranteId)
      .eq('ingrediente_id', ordine.ingrediente_id)
      .maybeSingle()

    await Promise.all([
      supabase.from('scorte').update({
        quantita_disponibile: (scorta?.quantita_disponibile ?? 0) + Number(ordine.quantita),
        data_ultimo_carico: new Date().toISOString().slice(0, 10),
      })
        .eq('ristorante_id', ristoranteId)
        .eq('ingrediente_id', ordine.ingrediente_id),
      supabase.from('movimenti_scorte').insert({
        ristorante_id:  ristoranteId,
        ingrediente_id: ordine.ingrediente_id,
        tipo_movimento: 'carico',
        quantita:       Number(ordine.quantita),
        motivo:         'Ricezione ordine',
      }),
    ])

    setOrdini(prev => prev.map(o => o.id === id ? { ...o, stato: 'ricevuto' } : o))
    setSegnando(null)
  }

  const totaleStimato = ordini
    .filter(o => o.stato !== 'annullato')
    .reduce((s, o) => s + (o.costo_stimato ?? 0), 0)

  const gruppiData = ordini.reduce<Record<string, OrdineEffettuato[]>>((acc, o) => {
    const k = o.data_ordine
    if (!acc[k]) acc[k] = []
    acc[k].push(o)
    return acc
  }, {})

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-caffe">Storico ordini</h1>
            {!loading && (
              <p className="text-sm text-maro mt-0.5">
                {ordini.length} ordini · <span className="font-semibold text-caffe">€{totaleStimato.toFixed(2)}</span> totali
              </p>
            )}
          </div>
        </div>
        <button onClick={carica} className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all">
          <RefreshCw size={18} />
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {!loading && ordini.length === 0 && (
        <div className="text-center py-16">
          <Package size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nessun ordine ancora confermato</p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(gruppiData).map(([data, righe]) => (
          <div key={data}>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-2">
              {new Date(data).toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <div className="space-y-2">
              {righe.map(o => {
                const cfg = STATO_CFG[o.stato] ?? STATO_CFG.inviato
                return (
                  <div
                    key={o.id}
                    className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-opacity ${
                      o.stato === 'annullato' ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-caffe text-sm truncate">{o.ingrediente_nome}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {o.fornitore_nome ?? 'Fornitore non assegnato'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400">Quantità</p>
                          <p className="text-sm font-bold text-caffe">{Number(o.quantita).toFixed(2)}</p>
                        </div>
                        {o.costo_stimato != null && (
                          <div>
                            <p className="text-[10px] text-slate-400">Costo</p>
                            <p className="text-sm font-bold text-caffe">€{Number(o.costo_stimato).toFixed(2)}</p>
                          </div>
                        )}
                      </div>

                      {o.stato === 'inviato' && (
                        <button
                          onClick={() => segnaRicevuto(o.id)}
                          disabled={segnando === o.id}
                          className="flex items-center gap-1.5 text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-full font-medium disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} />
                          {segnando === o.id ? 'Aggiorno…' : 'Ricevuto'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
