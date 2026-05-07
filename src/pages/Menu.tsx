import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Plus, X, UtensilsCrossed, Pencil, Trash2, EyeOff, Eye, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Piatto {
  id: string
  nome: string
  categoria: string | null
  prezzo_vendita: number | null
  costo_ingredienti: number | null
  disponibile: boolean
  stagionale: boolean
  note_chef: string | null
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
  const [nome, setNome]         = useState(piatto?.nome ?? '')
  const [cat, setCat]           = useState(piatto?.categoria ?? '')
  const [prezzo, setPrezzo]     = useState(piatto?.prezzo_vendita != null ? String(piatto.prezzo_vendita) : '')
  const [costo, setCosto]       = useState(piatto?.costo_ingredienti != null ? String(piatto.costo_ingredienti) : '')
  const [note, setNote]         = useState(piatto?.note_chef ?? '')
  const [disp, setDisp]         = useState(piatto?.disponibile ?? true)
  const [stag, setStag]         = useState(piatto?.stagionale ?? false)
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  async function salva() {
    if (!nome.trim()) { setErrore('Il nome è obbligatorio'); return }
    setSaving(true); setErrore(null)
    const payload = {
      ristorante_id:     ristoranteId,
      nome:              nome.trim(),
      categoria:         cat || null,
      prezzo_vendita:    prezzo ? parseFloat(prezzo) : null,
      costo_ingredienti: costo  ? parseFloat(costo)  : null,
      note_chef:         note.trim() || null,
      disponibile:       disp,
      stagionale:        stag,
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

  const margine = prezzo && costo ? parseFloat(prezzo) - parseFloat(costo) : null
  const pct     = margine != null && parseFloat(prezzo!) > 0
    ? Math.round((margine / parseFloat(prezzo!)) * 100) : null

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
            <label className="block text-xs font-semibold text-maro mb-1.5">Costo ingredienti (€)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={costo}
              onChange={e => setCosto(e.target.value)}
              placeholder="es. 5.50"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>

        {margine != null && (
          <div className={`rounded-xl p-3 text-sm font-medium ${pct! >= 60 ? 'bg-emerald-50 text-emerald-700' : pct! >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
            Margine: €{margine.toFixed(2)} — food cost {100 - pct!}%
            {pct! < 60 && ' ⚠️ food cost alto'}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Note per la cucina</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="allergie, varianti, note preparazione…"
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra resize-none"
          />
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setDisp(d => !d)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center ${disp ? 'bg-terra' : 'bg-slate-200'}`}
            >
              <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${disp ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-caffe font-medium">Disponibile</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setStag(s => !s)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center ${stag ? 'bg-amber-400' : 'bg-slate-200'}`}
            >
              <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${stag ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-caffe font-medium">Stagionale</span>
          </label>
        </div>

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
  const [filtroDisp, setFiltroDisp]   = useState<'tutti' | 'disponibili' | 'non_disponibili'>('tutti')

  const carica = useCallback(() => {
    setLoading(true)
    supabase
      .from('piatti')
      .select('id, nome, categoria, prezzo_vendita, costo_ingredienti, disponibile, stagionale, note_chef')
      .eq('ristorante_id', ristoranteId)
      .order('categoria')
      .order('nome')
      .then(({ data }) => {
        setPiatti((data as Piatto[]) ?? [])
        setLoading(false)
      })
  }, [ristoranteId])

  useEffect(() => { carica() }, [carica])

  async function toggleDisponibile(p: Piatto) {
    await supabase.from('piatti').update({ disponibile: !p.disponibile }).eq('id', p.id)
    setPiatti(prev => prev.map(x => x.id === p.id ? { ...x, disponibile: !x.disponibile } : x))
  }

  const filtrati = piatti.filter(p => {
    if (filtroDisp === 'disponibili')     return p.disponibile
    if (filtroDisp === 'non_disponibili') return !p.disponibile
    return true
  })

  // Raggruppa per categoria
  const gruppi = filtrati.reduce<Record<string, Piatto[]>>((acc, p) => {
    const cat = p.categoria ?? 'Altro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  const ordineCategorie = [...CATEGORIE, 'Altro']
  const categoriePresenti = ordineCategorie.filter(c => gruppi[c]?.length)

  const totDisp  = piatti.filter(p => p.disponibile).length
  const totPiatti = piatti.length

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center pt-2 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-caffe">Menu</h1>
            {!loading && (
              <p className="text-sm text-maro mt-0.5">{totDisp} disponibili · {totPiatti} totali</p>
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

      {/* Filtro */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { id: 'tutti',           label: 'Tutti' },
          { id: 'disponibili',     label: 'In carta' },
          { id: 'non_disponibili', label: 'Non disponibili' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltroDisp(f.id as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              filtroDisp === f.id
                ? 'bg-caffe text-white border-caffe'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
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
                const margine = p.prezzo_vendita != null && p.costo_ingredienti != null
                  ? p.prezzo_vendita - p.costo_ingredienti : null
                const foodCostPct = margine != null && p.prezzo_vendita! > 0
                  ? Math.round((p.costo_ingredienti! / p.prezzo_vendita!) * 100) : null

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl p-4 border shadow-sm transition-all ${
                      p.disponibile ? 'border-slate-100' : 'border-slate-100 opacity-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-caffe">{p.nome}</p>
                          {p.stagionale && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Stagionale</span>
                          )}
                          {!p.disponibile && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Non disponibile</span>
                          )}
                        </div>
                        {p.note_chef && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.note_chef}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {p.prezzo_vendita != null && (
                            <span className="text-sm font-bold text-caffe">€{p.prezzo_vendita.toFixed(2)}</span>
                          )}
                          {foodCostPct != null && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              foodCostPct <= 30 ? 'bg-emerald-50 text-emerald-700'
                              : foodCostPct <= 40 ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-600'
                            }`}>
                              food cost {foodCostPct}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleDisponibile(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                          title={p.disponibile ? 'Rendi non disponibile' : 'Rendi disponibile'}
                        >
                          {p.disponibile ? <Eye size={15} /> : <EyeOff size={15} />}
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
            setPiatti(prev => {
              const idx = prev.findIndex(x => x.id === p.id)
              if (idx >= 0) return prev.map(x => x.id === p.id ? p : x)
              return [...prev, p]
            })
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
