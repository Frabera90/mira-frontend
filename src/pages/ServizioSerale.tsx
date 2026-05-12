import { useEffect, useState, useMemo } from 'react'
import { ArrowLeft, Minus, Plus, ChefHat, CheckCircle, Loader2 } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Props { onBack: () => void }

interface Piatto {
  id: string
  nome: string
  categoria: string | null
  prezzo_vendita: number | null
  costo_per_porzione: number | null
  ha_ricetta: boolean
}

interface Risultato {
  piatti_salvati: number
  costo_totale: number
  ingredienti_scalati: number
}

export default function ServizioSerale({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const [piatti, setPiatti] = useState<Piatto[]>([])
  const [porzioni, setPorzioni] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [risultato, setRisultato] = useState<Risultato | null>(null)

  useEffect(() => {
    carica()
  }, [])

  async function carica() {
    setLoading(true)
    const { data: piattiRaw } = await supabase
      .from('piatti')
      .select('id, nome, categoria, prezzo_vendita')
      .eq('ristorante_id', ristoranteId)
      .eq('attivo', true)
      .order('categoria', { nullsFirst: false })
      .order('nome')

    if (!piattiRaw?.length) { setLoading(false); return }

    const [{ data: ricette }, { data: prezzi }] = await Promise.all([
      supabase.from('piatti_ingredienti')
        .select('piatto_id, ingrediente_id, quantita')
        .in('piatto_id', piattiRaw.map(p => p.id)),
      supabase.from('ingredienti_ristorante')
        .select('ingrediente_id, prezzo_acquisto_corrente')
        .eq('ristorante_id', ristoranteId)
        .eq('attivo', true),
    ])

    const priceMap = new Map((prezzi ?? []).map(p => [p.ingrediente_id, Number(p.prezzo_acquisto_corrente ?? 0)]))

    // Group recipes by dish
    const ricetteMap: Record<string, { ingrediente_id: string; quantita: number }[]> = {}
    for (const r of ricette ?? []) {
      (ricetteMap[r.piatto_id] ??= []).push(r)
    }

    const result: Piatto[] = piattiRaw.map(p => {
      const ings = ricetteMap[p.id] ?? []
      const costo = ings.length > 0
        ? ings.reduce((s, i) => s + Number(i.quantita) * (priceMap.get(i.ingrediente_id) ?? 0), 0)
        : null
      return {
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        prezzo_vendita: p.prezzo_vendita,
        costo_per_porzione: costo !== null && costo > 0 ? Math.round(costo * 100) / 100 : null,
        ha_ricetta: ings.length > 0,
      }
    })

    setPiatti(result)
    setLoading(false)
  }

  function cambiaPortione(piattoId: string, delta: number) {
    setPorzioni(prev => {
      const curr = prev[piattoId] ?? 0
      const next = Math.max(0, curr + delta)
      return { ...prev, [piattoId]: next }
    })
  }

  const costoTotale = useMemo(() => {
    return piatti.reduce((s, p) => {
      const port = porzioni[p.id] ?? 0
      if (port <= 0 || !p.costo_per_porzione) return s
      return s + port * p.costo_per_porzione
    }, 0)
  }, [piatti, porzioni])

  const totalePorzioni = Object.values(porzioni).reduce((s, v) => s + v, 0)

  async function salva() {
    const piattiDaInviare = Object.entries(porzioni)
      .filter(([, p]) => p > 0)
      .map(([piatto_id, p]) => ({ piatto_id, porzioni: p }))
    if (!piattiDaInviare.length) return

    setSaving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/servizio-serale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piatti: piattiDaInviare }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore salvataggio')
      setRisultato(json.data)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Group dishes by category
  const perCategoria = useMemo(() => {
    const map: Record<string, Piatto[]> = {}
    for (const p of piatti) {
      const cat = p.categoria ?? 'Altro'
      ;(map[cat] ??= []).push(p)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'it'))
  }, [piatti])

  if (risultato) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
            <CheckCircle size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-caffe">Servizio registrato!</h2>
            <p className="text-sm text-maro mt-1">Scorte aggiornate automaticamente.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Piatti', value: String(risultato.piatti_salvati) },
              { label: 'Costo ing.', value: `€${risultato.costo_totale.toFixed(2)}` },
              { label: 'Ingredienti', value: String(risultato.ingredienti_scalati) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-xl p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-bold text-caffe mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <button
            onClick={onBack}
            className="w-full bg-terra text-white font-semibold rounded-xl py-3.5"
          >
            Torna alla home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      <div className="sticky top-0 bg-cream/95 backdrop-blur-sm z-10 px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-caffe">Servizio serale</h1>
            <p className="text-xs text-slate-400">
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {loading ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <Loader2 size={18} className="text-terra animate-spin" />
            <p className="text-sm text-slate-500">Carico il menu…</p>
          </div>
        ) : piatti.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-700">Nessun piatto trovato. Carica prima il menu.</p>
          </div>
        ) : (
          perCategoria.map(([categoria, lista]) => (
            <div key={categoria}>
              <p className="text-xs font-bold text-maro uppercase tracking-wide mb-2">{categoria}</p>
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                {lista.map((p, i) => {
                  const qty = porzioni[p.id] ?? 0
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-3 ${i < lista.length - 1 ? 'border-b border-slate-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${qty > 0 ? 'text-caffe' : 'text-slate-500'}`}>{p.nome}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {p.costo_per_porzione != null
                            ? `€${p.costo_per_porzione.toFixed(2)}/pz`
                            : p.ha_ricetta ? 'ricetta senza prezzi' : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => cambiaPortione(p.id, -1)}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
                        >
                          <Minus size={13} />
                        </button>
                        <span className={`w-7 text-center text-sm font-bold ${qty > 0 ? 'text-terra' : 'text-slate-300'}`}>
                          {qty}
                        </span>
                        <button
                          onClick={() => cambiaPortione(p.id, 1)}
                          className="w-7 h-7 rounded-lg bg-terra/10 text-terra flex items-center justify-center active:scale-95 transition-transform"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sticky footer */}
      {!loading && piatti.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-slate-100 px-4 py-4 shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-xs text-slate-400">Piatti inseriti</p>
              <p className="text-sm font-bold text-caffe">{totalePorzioni} porzioni</p>
            </div>
            {costoTotale > 0 && (
              <div className="text-right">
                <p className="text-xs text-slate-400">Costo ingredienti stimato</p>
                <p className="text-sm font-bold text-terra">€{costoTotale.toFixed(2)}</p>
              </div>
            )}
          </div>
          <button
            onClick={salva}
            disabled={saving || totalePorzioni === 0}
            className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-terra/20"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />}
            {saving ? 'Salvataggio…' : 'Registra servizio'}
          </button>
        </div>
      )}
    </div>
  )
}
