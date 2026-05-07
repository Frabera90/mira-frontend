import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Plus, X, UtensilsCrossed, Pencil, Trash2, EyeOff, Eye, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Piatto {
  id: string
  nome: string
  categoria: string | null
  prezzo_vendita: number | null
  soglia_food_cost_pct: number | null
  attivo: boolean
  // dalla view piatti_food_cost
  costo_ingredienti?: number
  food_cost_pct?: number
  margine_euro?: number
  n_ingredienti?: number
}

const CATEGORIE = ['Antipasto', 'Primo', 'Secondo', 'Contorno', 'Dolce', 'Vini & Bevande', 'Altro']

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

function PiattoModal({
  piatto,
  onClose,
  onSaved,
  onDeleted,
}: {
  piatto: Piatto | null
  onClose: () => void
  onSaved: (p: Piatto) => void
  onDeleted?: (id: string) => void
}) {
  const ristoranteId = useRistorante()
  const isNew = !piatto
  const [nome, setNome]       = useState(piatto?.nome ?? '')
  const [cat, setCat]         = useState(piatto?.categoria ?? '')
  const [prezzo, setPrezzo]   = useState(piatto?.prezzo_vendita != null ? String(piatto.prezzo_vendita) : '')
  const [soglia, setSoglia]   = useState(piatto?.soglia_food_cost_pct != null ? String(piatto.soglia_food_cost_pct) : '35')
  const [attivo, setAttivo]   = useState(piatto?.attivo ?? true)
  const [saving, setSaving]   = useState(false)
  const [errore, setErrore]   = useState<string | null>(null)

  async function salva() {
    if (!nome.trim()) { setErrore('Il nome è obbligatorio'); return }
    setSaving(true); setErrore(null)
    const payload = {
      ristorante_id:       ristoranteId,
      nome:                nome.trim(),
      categoria:           cat || null,
      prezzo_vendita:      prezzo ? parseFloat(prezzo) : null,
      soglia_food_cost_pct: soglia ? parseFloat(soglia) : 35,
      attivo,
    }
    const q = isNew
      ? supabase.from('piatti').insert(payload).select().single()
      : supabase.from('piatti').update(payload).eq('id', piatto!.id).select().single()
    const { data, error } = await q
    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved(data as Piatto)
  }

  async function elimina() {
    if (!piatto) return
    if (!confirm(`Eliminare "${piatto.nome}" dal menu?`)) return
    await supabase.from('piatti').delete().eq('id', piatto.id)
    onDeleted?.(piatto.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl p-6 pb-8 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-caffe text-lg">{isNew ? 'Nuovo piatto' : 'Modifica piatto'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome piatto *</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="es. Branzino all'acqua pazza"
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIE.map(c => (
              <button
                key={c}
                onClick={() => setCat(cat === c ? '' : c)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  cat === c
                    ? 'bg-terra text-white border-terra'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Prezzo menu (€)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={prezzo}
              onChange={e => setPrezzo(e.target.value)}
              placeholder="es. 18.00"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Soglia food cost (%)</label>
            <input
              type="number"
              inputMode="decimal"
              min="10"
              max="60"
              step="1"
              value={soglia}
              onChange={e => setSoglia(e.target.value)}
              placeholder="35"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setAttivo(a => !a)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center shrink-0 ${attivo ? 'bg-terra' : 'bg-slate-200'}`}
          >
            <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${attivo ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-sm text-caffe font-medium">{attivo ? 'In carta' : 'Non disponibile'}</span>
        </label>

        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

        <button
          onClick={salva}
          disabled={saving || !nome.trim()}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Salvataggio…' : isNew ? 'Aggiungi al menu' : 'Salva modifiche'}
        </button>

        {!isNew && (
          <button
            onClick={elimina}
            className="w-full flex items-center justify-center gap-2 border border-rose-200 text-rose-500 font-semibold rounded-xl py-3 text-sm"
          >
            <Trash2 size={15} />
            Rimuovi dal menu
          </button>
        )}
      </div>
    </div>
  )
}

interface Props {
  onBack: () => void
}

export default function Menu({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const [piatti, setPiatti]   = useState<Piatto[]>([])
  const [loading, setLoading] = useState(true)
  const [mostraModal, setMostraModal] = useState(false)
  const [selezionato, setSelezionato] = useState<Piatto | null>(null)
  const [filtroAttivo, setFiltroAttivo] = useState<'tutti' | 'in_carta' | 'non_disp'>('tutti')

  const carica = useCallback(() => {
    setLoading(true)
    // Leggi dalla view piatti_food_cost che include costo calcolato
    supabase
      .from('piatti_food_cost')
      .select('id, ristorante_id, nome, categoria, prezzo_vendita, soglia_food_cost_pct, attivo, costo_ingredienti, food_cost_pct, margine_euro, n_ingredienti')
      .eq('ristorante_id', ristoranteId)
      .order('categoria')
      .order('nome')
      .then(({ data, error }) => {
        if (!error) setPiatti((data as Piatto[]) ?? [])
        setLoading(false)
      })
  }, [ristoranteId])

  useEffect(() => { carica() }, [carica])

  async function toggleAttivo(p: Piatto) {
    await supabase.from('piatti').update({ attivo: !p.attivo }).eq('id', p.id)
    setPiatti(prev => prev.map(x => x.id === p.id ? { ...x, attivo: !x.attivo } : x))
  }

  const filtrati = piatti.filter(p => {
    if (filtroAttivo === 'in_carta') return p.attivo
    if (filtroAttivo === 'non_disp') return !p.attivo
    return true
  })

  const gruppi = filtrati.reduce<Record<string, Piatto[]>>((acc, p) => {
    const cat = p.categoria ?? 'Altro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  const ordineCategorie = [...CATEGORIE, 'Altro']
  const categoriePresenti = ordineCategorie.filter(c => gruppi[c]?.length)

  const totInCarta = piatti.filter(p => p.attivo).length

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-caffe">Menu</h1>
            {!loading && (
              <p className="text-sm text-maro mt-0.5">{totInCarta} in carta · {piatti.length} totali</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carica} className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => { setSelezionato(null); setMostraModal(true) }}
            className="w-9 h-9 bg-terra text-white rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'tutti',    label: 'Tutti' },
          { id: 'in_carta', label: 'In carta' },
          { id: 'non_disp', label: 'Non disponibili' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltroAttivo(f.id as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroAttivo === f.id
                ? 'bg-caffe text-white border-caffe'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {!loading && categoriePresenti.length === 0 && (
        <div className="text-center py-16">
          <UtensilsCrossed size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nessun piatto nel menu</p>
          <button
            onClick={() => { setSelezionato(null); setMostraModal(true) }}
            className="mt-4 text-sm text-terra font-medium border border-terra/30 px-4 py-2 rounded-full"
          >
            Aggiungi il primo piatto
          </button>
        </div>
      )}

      <div className="space-y-5">
        {categoriePresenti.map(cat => (
          <div key={cat}>
            <p className="text-xs font-bold text-maro uppercase tracking-widest mb-2 px-1">{cat}</p>
            <div className="space-y-2">
              {gruppi[cat].map(p => {
                const fc = p.food_cost_pct ?? 0
                const soglia = p.soglia_food_cost_pct ?? 35
                const fcOk = fc <= soglia

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl p-4 border shadow-sm transition-all ${
                      p.attivo ? 'border-slate-100' : 'border-slate-100 opacity-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-caffe">{p.nome}</p>
                          {!p.attivo && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                              Non disponibile
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {p.prezzo_vendita != null && (
                            <span className="text-sm font-bold text-caffe">€{p.prezzo_vendita.toFixed(2)}</span>
                          )}
                          {p.n_ingredienti != null && p.n_ingredienti > 0 && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              fcOk
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-600'
                            }`}>
                              FC {fc.toFixed(0)}% {!fcOk && '⚠️'}
                            </span>
                          )}
                          {p.margine_euro != null && p.n_ingredienti! > 0 && (
                            <span className="text-xs text-slate-400">
                              margine €{p.margine_euro.toFixed(2)}
                            </span>
                          )}
                          {(p.n_ingredienti ?? 0) === 0 && (
                            <span className="text-xs text-slate-300 italic">nessun ingrediente</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleAttivo(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                          title={p.attivo ? 'Rendi non disponibile' : 'Rimetti in carta'}
                        >
                          {p.attivo ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <button
                          onClick={() => { setSelezionato(p); setMostraModal(true) }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                        >
                          <Pencil size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {mostraModal && (
        <PiattoModal
          piatto={selezionato}
          onClose={() => { setMostraModal(false); setSelezionato(null) }}
          onSaved={p => {
            setMostraModal(false)
            setSelezionato(null)
            carica()
          }}
          onDeleted={id => {
            setMostraModal(false)
            setSelezionato(null)
            setPiatti(prev => prev.filter(x => x.id !== id))
          }}
        />
      )}
    </div>
  )
}
