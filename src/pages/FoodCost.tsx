import { useEffect, useState, useCallback } from 'react'
import {
  ArrowLeft, RefreshCw, Plus, X, ChefHat, TrendingDown,
  AlertTriangle, Search, Trash2, Check, Sparkles, Loader2,
} from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Piatto {
  id: string
  nome: string
  categoria: string | null
  prezzo_vendita: number
  soglia_food_cost_pct: number
  attivo: boolean
  n_ingredienti: number
  costo_ingredienti: number
  food_cost_pct: number | null
  margine_euro: number
}

interface RigaRicetta {
  id: string
  ingrediente_id: string
  ingrediente_nome: string
  um: string
  quantita: number
  prezzo_unitario: number | null
}

interface IngredienteOpzione {
  id: string
  nome: string
  um: string
  prezzo: number | null
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

function foodCostColor(pct: number | null, soglia: number) {
  if (pct === null) return { badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-200' }
  if (pct <= soglia * 0.85)
    return { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' }
  if (pct <= soglia)
    return { badge: 'bg-amber-100 text-amber-700',    bar: 'bg-amber-500' }
  return   { badge: 'bg-rose-100 text-rose-700',      bar: 'bg-rose-500' }
}

interface Props {
  onBack: () => void
}

export default function FoodCost({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const [piatti, setPiatti]           = useState<Piatto[]>([])
  const [loading, setLoading]         = useState(true)
  const [tick, setTick]               = useState(0)
  const [dettaglio, setDettaglio]     = useState<Piatto | null>(null)
  const [mostraAdd, setMostraAdd]     = useState(false)
  const [ricalcola, setRicalcola]     = useState(false)
  const [ricalcolaMsg, setRicalcolaMsg] = useState<string | null>(null)

  const carica = useCallback(() => setTick(t => t + 1), [])

  async function ricalcolaFoodCost() {
    setRicalcola(true)
    setRicalcolaMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/onboarding/abbina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore')
      const d = json.data
      const abbinati = d.abbinamenti?.length ?? 0
      const nonAbb = d.piatti_non_abbinati?.length ?? 0
      setRicalcolaMsg(`✓ ${abbinati} ricette aggiornate${nonAbb > 0 ? ` · ${nonAbb} piatti senza ricetta standard` : ''}`)
      carica()
    } catch (e: any) {
      setRicalcolaMsg(`Errore: ${e.message}`)
    }
    setRicalcola(false)
  }

  useEffect(() => {
    setLoading(true)
    supabase
      .from('piatti_food_cost')
      .select('*')
      .eq('ristorante_id', ristoranteId)
      .eq('attivo', true)
      .order('food_cost_pct', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        setPiatti((data as Piatto[]) ?? [])
        setLoading(false)
      })
  }, [tick])

  const avgFoodCost = piatti.length
    ? piatti.filter(p => p.food_cost_pct !== null).reduce((s, p) => s + (p.food_cost_pct ?? 0), 0) /
      piatti.filter(p => p.food_cost_pct !== null).length
    : null

  const inAlert = piatti.filter(
    p => p.food_cost_pct !== null && p.food_cost_pct > p.soglia_food_cost_pct
  ).length

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-caffe">Food Cost</h1>
            {!loading && avgFoodCost !== null && (
              <p className="text-sm text-maro mt-0.5">
                Media <span className="font-semibold text-caffe">{avgFoodCost.toFixed(1)}%</span>
                {inAlert > 0 && (
                  <span className="ml-2 text-rose-600 font-semibold">{inAlert} sopra soglia</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMostraAdd(true)}
            className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
            title="Aggiungi piatto"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={carica}
            className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
            title="Aggiorna"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Ricalcola banner — shown when all dishes have zero cost */}
      {!loading && piatti.length > 0 && piatti.every(p => Number(p.costo_ingredienti) === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Food cost non calcolato</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Le ricette non sono collegate ai prezzi delle fatture. Clicca per ricalcolare con AI.
              </p>
            </div>
          </div>
          <button
            onClick={ricalcolaFoodCost}
            disabled={ricalcola}
            className="w-full bg-amber-600 text-white font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {ricalcola ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {ricalcola ? 'Ricalcolo in corso (30-60 sec)…' : 'Ricalcola ricette con AI'}
          </button>
          {ricalcolaMsg && (
            <p className={`text-xs font-medium ${ricalcolaMsg.startsWith('Errore') ? 'text-rose-600' : 'text-emerald-700'}`}>
              {ricalcolaMsg}
            </p>
          )}
        </div>
      )}

      {/* Alert banner */}
      {!loading && inAlert > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2.5 mb-4">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <p className="text-sm text-rose-700 font-medium">
            {inAlert} piatt{inAlert === 1 ? 'o' : 'i'} con food cost sopra soglia
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      {!loading && piatti.length === 0 && (
        <div className="text-center py-16">
          <ChefHat size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nessun piatto nel menu</p>
          <button
            onClick={() => setMostraAdd(true)}
            className="mt-4 bg-terra text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            + Aggiungi il primo piatto
          </button>
        </div>
      )}

      <div className="space-y-3">
        {piatti.map(p => {
          const clr = foodCostColor(p.food_cost_pct, p.soglia_food_cost_pct)
          return (
            <button
              key={p.id}
              onClick={() => setDettaglio(p)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left active:scale-[0.99] transition-transform"
            >
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-caffe truncate">{p.nome}</p>
                  {p.categoria && <p className="text-xs text-slate-400 mt-0.5">{p.categoria}</p>}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${clr.badge}`}>
                  {p.food_cost_pct !== null ? `${p.food_cost_pct.toFixed(1)}%` : 'N/D'}
                </span>
              </div>

              {/* Food cost bar */}
              {p.food_cost_pct !== null && (
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${clr.bar}`}
                    style={{ width: `${Math.min(p.food_cost_pct, 100)}%` }}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-xl p-2">
                  <p className="text-[10px] text-slate-400 font-medium">Vendita</p>
                  <p className="text-sm font-bold text-caffe">€{Number(p.prezzo_vendita).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2">
                  <p className="text-[10px] text-slate-400 font-medium">Costo</p>
                  <p className="text-sm font-bold text-caffe">€{Number(p.costo_ingredienti).toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2">
                  <p className="text-[10px] text-slate-400 font-medium">Margine</p>
                  <p className={`text-sm font-bold ${p.margine_euro >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    €{Number(p.margine_euro).toFixed(2)}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {dettaglio && (
        <DettaglioSheet
          piatto={dettaglio}
          onClose={() => setDettaglio(null)}
          onSaved={() => { setDettaglio(null); carica() }}
        />
      )}

      {mostraAdd && (
        <AddPiattoModal
          onClose={() => setMostraAdd(false)}
          onSaved={() => { setMostraAdd(false); carica() }}
        />
      )}
    </div>
  )
}

// ── Dettaglio piatto + ricetta editor ─────────────────────────

function DettaglioSheet({
  piatto, onClose, onSaved,
}: {
  piatto: Piatto
  onClose: () => void
  onSaved: () => void
}) {
  const ristoranteId = useRistorante()
  const [ricetta, setRicetta]   = useState<RigaRicetta[]>([])
  const [loading, setLoading]   = useState(true)
  const [vista, setVista]       = useState<'ricetta' | 'modifica'>('ricetta')

  // form modifica piatto
  const [nome, setNome]         = useState(piatto.nome)
  const [cat, setCat]           = useState(piatto.categoria ?? '')
  const [prezzo, setPrezzo]     = useState(String(piatto.prezzo_vendita))
  const [soglia, setSoglia]     = useState(String(piatto.soglia_food_cost_pct))
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  // aggiungi ingrediente
  const [search, setSearch]         = useState('')
  const [opzioni, setOpzioni]       = useState<IngredienteOpzione[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addingId, setAddingId]     = useState<string | null>(null)
  const [addQty, setAddQty]         = useState('')

  useEffect(() => {
    supabase
      .from('piatti_ingredienti')
      .select('id, quantita, unita_misura, ingrediente_id, ingredienti(nome, unita_misura)')
      .eq('piatto_id', piatto.id)
      .then(async ({ data: righe }) => {
        const ingIds = (righe ?? []).map(r => r.ingrediente_id)
        let prezziMap = new Map<string, number | null>()
        if (ingIds.length) {
          const { data: prezzi } = await supabase
            .from('ingredienti_ristorante')
            .select('ingrediente_id, prezzo_acquisto_corrente')
            .eq('ristorante_id', ristoranteId)
            .in('ingrediente_id', ingIds)
          ;(prezzi ?? []).forEach(p => prezziMap.set(p.ingrediente_id, p.prezzo_acquisto_corrente))
        }
        const rows: RigaRicetta[] = ((righe as any[]) ?? []).map(r => {
          const ing = Array.isArray(r.ingredienti) ? r.ingredienti[0] : r.ingredienti
          return {
            id:               r.id,
            ingrediente_id:   r.ingrediente_id,
            ingrediente_nome: ing?.nome ?? '—',
            um:               r.unita_misura ?? ing?.unita_misura ?? '',
            quantita:         r.quantita,
            prezzo_unitario:  prezziMap.get(r.ingrediente_id) ?? null,
          }
        })
        setRicetta(rows)
        setLoading(false)
      })
  }, [piatto.id])

  useEffect(() => {
    if (search.length < 2) { setOpzioni([]); return }
    setSearchLoading(true)
    const t = setTimeout(async () => {
      const { data: globalData } = await supabase
        .from('ingredienti')
        .select('id, nome, unita_misura')
        .ilike('nome', `%${search}%`)
        .limit(20)
      const ids = (globalData ?? []).map(r => r.id)
      const prezziMap = new Map<string, number | null>()
      if (ids.length) {
        const { data: prezzi } = await supabase
          .from('ingredienti_ristorante')
          .select('ingrediente_id, prezzo_acquisto_corrente')
          .eq('ristorante_id', ristoranteId)
          .in('ingrediente_id', ids)
        ;(prezzi ?? []).forEach((p: any) => prezziMap.set(p.ingrediente_id, p.prezzo_acquisto_corrente))
      }
      setOpzioni(
        (globalData ?? []).slice(0, 6).map((r: any) => ({
          id:     r.id,
          nome:   r.nome,
          um:     r.unita_misura,
          prezzo: prezziMap.get(r.id) ?? null,
        }))
      )
      setSearchLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  async function aggiungiIngrediente(opzione: IngredienteOpzione) {
    const qty = parseFloat(addQty.replace(',', '.'))
    if (!qty || qty <= 0) return
    setAddingId(opzione.id)
    const { error } = await supabase.from('piatti_ingredienti').upsert({
      piatto_id:      piatto.id,
      ingrediente_id: opzione.id,
      quantita:       qty,
      unita_misura:   opzione.um || 'kg',
      opzionale:      false,
    }, { onConflict: 'piatto_id,ingrediente_id' })
    if (!error) {
      setRicetta(prev => {
        const exists = prev.find(r => r.ingrediente_id === opzione.id)
        if (exists) return prev.map(r => r.ingrediente_id === opzione.id ? { ...r, quantita: qty } : r)
        return [...prev, {
          id:              crypto.randomUUID(),
          ingrediente_id:  opzione.id,
          ingrediente_nome: opzione.nome,
          um:              opzione.um,
          quantita:        qty,
          prezzo_unitario: opzione.prezzo,
        }]
      })
      setSearch('')
      setAddQty('')
      setOpzioni([])
    }
    setAddingId(null)
  }

  async function rimuoviIngrediente(id: string) {
    await supabase.from('piatti_ingredienti').delete().eq('id', id)
    setRicetta(prev => prev.filter(r => r.id !== id))
  }

  async function salvaPiatto() {
    setSaving(true); setErrore(null)
    const { error } = await supabase.from('piatti').update({
      nome:                 nome.trim(),
      categoria:            cat.trim() || null,
      prezzo_vendita:       parseFloat(prezzo.replace(',', '.')) || 0,
      soglia_food_cost_pct: parseFloat(soglia.replace(',', '.')) || 35,
    }).eq('id', piatto.id)
    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved()
  }

  async function eliminaPiatto() {
    if (!confirm(`Eliminare "${piatto.nome}"?`)) return
    await supabase.from('piatti').update({ attivo: false }).eq('id', piatto.id)
    onSaved()
  }

  const costoTotale = ricetta.reduce((s, r) => s + r.quantita * (r.prezzo_unitario ?? 0), 0)
  const foodCostPct = piatto.prezzo_vendita > 0 ? (costoTotale / piatto.prezzo_vendita) * 100 : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl shadow-xl max-h-[90vh] flex flex-col">

        <div className="flex justify-between items-start px-6 pt-5 pb-4 shrink-0 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-caffe text-lg leading-tight">{piatto.nome}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {foodCostPct !== null
                ? `Food cost ${foodCostPct.toFixed(1)}% · margine €${(piatto.prezzo_vendita - costoTotale).toFixed(2)}`
                : `€${Number(piatto.prezzo_vendita).toFixed(2)} · ricetta vuota`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 px-6 py-3 shrink-0">
          <button
            onClick={() => setVista('ricetta')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              vista === 'ricetta' ? 'bg-terra text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ChefHat size={12} />
            Ricetta
          </button>
          <button
            onClick={() => setVista('modifica')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              vista === 'modifica' ? 'bg-terra text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <TrendingDown size={12} />
            Prezzi
          </button>
        </div>

        {vista === 'ricetta' && (
          <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4">
            {/* Lista ingredienti ricetta */}
            {loading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <div className="space-y-0">
                {ricetta.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-caffe truncate">{r.ingrediente_nome}</p>
                      <p className="text-xs text-slate-400">
                        {r.quantita} {r.um}
                        {r.prezzo_unitario != null && (
                          <span className="ml-2 text-slate-300">
                            €{(r.quantita * r.prezzo_unitario).toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => rimuoviIngrediente(r.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {ricetta.length === 0 && (
                  <p className="text-xs text-slate-400 py-2">Nessun ingrediente nella ricetta.</p>
                )}
              </div>
            )}

            {/* Aggiungi ingrediente */}
            <div>
              <p className="text-xs font-semibold text-maro mb-2">Aggiungi ingrediente</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca ingrediente…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-terra"
                />
              </div>

              {search.length >= 2 && (
                <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  {searchLoading && (
                    <p className="text-xs text-slate-400 px-4 py-3">Ricerca…</p>
                  )}
                  {!searchLoading && opzioni.length === 0 && (
                    <p className="text-xs text-slate-400 px-4 py-3">Nessun risultato</p>
                  )}
                  {opzioni.map(o => (
                    <div key={o.id} className="flex items-center gap-2 px-3 py-2 border-b border-slate-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-caffe font-medium truncate">{o.nome}</p>
                        {o.prezzo != null && (
                          <p className="text-xs text-slate-400">€{Number(o.prezzo).toFixed(2)} / {o.um}</p>
                        )}
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder={`qtà (${o.um})`}
                        value={addingId === o.id ? addQty : ''}
                        onClick={() => setAddingId(o.id)}
                        onChange={e => { setAddingId(o.id); setAddQty(e.target.value) }}
                        className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-terra shrink-0"
                      />
                      <button
                        onClick={() => aggiungiIngrediente(o)}
                        disabled={!addQty || addingId !== o.id}
                        className="p-1.5 rounded-lg bg-terra text-white disabled:opacity-30 shrink-0"
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totale ricetta */}
            {ricetta.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Costo ricetta totale</span>
                  <span className="font-bold text-caffe">€{costoTotale.toFixed(2)}</span>
                </div>
                {foodCostPct !== null && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-500">Food cost</span>
                    <span className={`font-bold ${foodCostPct > piatto.soglia_food_cost_pct ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {foodCostPct.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {vista === 'modifica' && (
          <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-maro mb-1.5">Nome piatto</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-maro mb-1.5">Categoria</label>
              <input
                type="text"
                value={cat}
                onChange={e => setCat(e.target.value)}
                placeholder="es. Antipasto, Primo, Secondo"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Prezzo vendita (€)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={prezzo}
                  onChange={e => setPrezzo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Soglia food cost (%)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="1"
                  value={soglia}
                  onChange={e => setSoglia(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                />
              </div>
            </div>

            {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

            <button
              onClick={salvaPiatto}
              disabled={saving || !nome.trim()}
              className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Salvataggio…' : 'Salva modifiche'}
            </button>

            <button
              onClick={eliminaPiatto}
              className="w-full flex items-center justify-center gap-2 border border-rose-200 text-rose-500 font-semibold rounded-xl py-3 text-sm"
            >
              <Trash2 size={15} />
              Elimina piatto
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Aggiungi piatto ───────────────────────────────────────────

function AddPiattoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const ristoranteId = useRistorante()
  const [nome, setNome]     = useState('')
  const [cat, setCat]       = useState('')
  const [prezzo, setPrezzo] = useState('')
  const [soglia, setSoglia] = useState('35')
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function salva() {
    if (!nome.trim()) { setErrore('Inserisci il nome del piatto'); return }
    setSaving(true); setErrore(null)
    const { error } = await supabase.from('piatti').insert({
      ristorante_id:        ristoranteId,
      nome:                 nome.trim(),
      categoria:            cat.trim() || null,
      prezzo_vendita:       parseFloat(prezzo.replace(',', '.')) || 0,
      soglia_food_cost_pct: parseFloat(soglia) || 35,
    })
    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl p-6 pb-8 space-y-4 shadow-xl">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-caffe text-lg">Nuovo piatto</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="es. Branzino al sale"
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Categoria</label>
          <input
            type="text"
            value={cat}
            onChange={e => setCat(e.target.value)}
            placeholder="es. Secondo, Antipasto"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Prezzo vendita (€)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={prezzo}
              onChange={e => setPrezzo(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Soglia food cost (%)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              value={soglia}
              onChange={e => setSoglia(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>

        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

        <button
          onClick={salva}
          disabled={saving || !nome.trim()}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Salvataggio…' : '+ Aggiungi piatto'}
        </button>
      </div>
    </div>
  )
}
