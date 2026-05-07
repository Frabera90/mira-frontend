import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Plus, X, Truck, Mail, Phone, ChevronRight, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Fornitore {
  id: string
  nome: string
  contatto_nome: string | null
  email: string | null
  telefono: string | null
  lead_time_giorni: number | null
  note: string | null
}

interface IngredienteAssegnabile {
  ingrediente_id: string
  nome: string
  fornitore_id: string | null
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

function AddFornitoreModal({ onClose, onSaved }: { onClose: () => void; onSaved: (f: Fornitore) => void }) {
  const ristoranteId = useRistorante()
  const [nome, setNome]               = useState('')
  const [contatto, setContatto]       = useState('')
  const [email, setEmail]             = useState('')
  const [telefono, setTelefono]       = useState('')
  const [giorniConsegna, setGiorni]   = useState('')
  const [note, setNote]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [errore, setErrore]           = useState<string | null>(null)

  async function salva() {
    if (!nome.trim()) { setErrore('Il nome è obbligatorio'); return }
    setSaving(true)
    setErrore(null)

    const { data, error } = await supabase
      .from('fornitori')
      .insert({
        ristorante_id:   ristoranteId,
        nome:            nome.trim(),
        contatto_nome:   contatto.trim() || null,
        email:           email.trim() || null,
        telefono:        telefono.trim() || null,
        lead_time_giorni: giorniConsegna ? parseInt(giorniConsegna) : 1,
        note:            note.trim() || null,
      })
      .select()
      .single()

    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved(data as Fornitore)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl p-6 pb-8 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-caffe text-lg">Nuovo fornitore</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome azienda *</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="es. Pescheria Anzio srl"
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Referente</label>
          <input
            type="text"
            value={contatto}
            onChange={e => setContatto(e.target.value)}
            placeholder="es. Marco Rossi"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Telefono</label>
            <input
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="320 000 0000"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Giorni consegna</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="14"
              value={giorniConsegna}
              onChange={e => setGiorni(e.target.value)}
              placeholder="es. 2"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Email</label>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ordini@fornitore.it"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Note</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="orari, condizioni di pagamento…"
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra resize-none"
          />
        </div>

        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

        <button
          onClick={salva}
          disabled={saving || !nome.trim()}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Salvataggio…' : 'Aggiungi fornitore'}
        </button>
      </div>
    </div>
  )
}

function EditFornitoreModal({ fornitore, onClose, onSaved, onDeleted }: {
  fornitore: Fornitore
  onClose: () => void
  onSaved: (f: Fornitore) => void
  onDeleted: (id: string) => void
}) {
  const [nome, setNome]             = useState(fornitore.nome)
  const [contatto, setContatto]     = useState(fornitore.contatto_nome ?? '')
  const [email, setEmail]           = useState(fornitore.email ?? '')
  const [telefono, setTelefono]     = useState(fornitore.telefono ?? '')
  const [giorni, setGiorni]         = useState(String(fornitore.lead_time_giorni ?? ''))
  const [note, setNote]             = useState(fornitore.note ?? '')
  const [saving, setSaving]         = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [errore, setErrore]         = useState<string | null>(null)

  async function salva() {
    if (!nome.trim()) { setErrore('Il nome è obbligatorio'); return }
    setSaving(true); setErrore(null)
    const { data, error } = await supabase
      .from('fornitori')
      .update({
        nome:            nome.trim(),
        contatto_nome:   contatto.trim() || null,
        email:           email.trim() || null,
        telefono:        telefono.trim() || null,
        lead_time_giorni: giorni ? parseInt(giorni) : 1,
        note:            note.trim() || null,
      })
      .eq('id', fornitore.id)
      .select()
      .single()
    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved(data as Fornitore)
  }

  async function elimina() {
    if (!confirm(`Rimuovere "${fornitore.nome}"?`)) return
    setEliminando(true)
    await supabase.from('fornitori').update({ attivo: false }).eq('id', fornitore.id)
    onDeleted(fornitore.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl p-6 pb-8 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-caffe text-lg">Modifica fornitore</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome azienda *</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Referente</label>
          <input type="text" value={contatto} onChange={e => setContatto(e.target.value)}
            placeholder="es. Marco Rossi"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Telefono</label>
            <input type="tel" inputMode="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Giorni consegna</label>
            <input type="number" inputMode="numeric" min="1" max="14" value={giorni} onChange={e => setGiorni(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Email</label>
          <input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra resize-none" />
        </div>

        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

        <button onClick={salva} disabled={saving || !nome.trim()}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity">
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>

        <button onClick={elimina} disabled={eliminando}
          className="w-full flex items-center justify-center gap-2 border border-rose-200 text-rose-500 font-semibold rounded-xl py-3 text-sm disabled:opacity-50">
          <Trash2 size={15} />
          {eliminando ? 'Rimozione…' : 'Rimuovi fornitore'}
        </button>
      </div>
    </div>
  )
}

function AssegnaModal({ fornitore, onClose, onSaved }: {
  fornitore: Fornitore
  onClose: () => void
  onSaved: () => void
}) {
  const ristoranteId = useRistorante()
  const [ingredienti, setIngredienti] = useState<IngredienteAssegnabile[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('ingredienti_ristorante')
      .select('ingrediente_id, fornitore_id, ingredienti(nome)')
      .eq('ristorante_id', ristoranteId)
      .eq('attivo', true)
      .then(({ data }) => {
        const rows = (data ?? []).map((r: any) => ({
          ingrediente_id: r.ingrediente_id,
          nome: Array.isArray(r.ingredienti) ? r.ingredienti[0]?.nome : r.ingredienti?.nome ?? '—',
          fornitore_id: r.fornitore_id,
        }))
        rows.sort((a: IngredienteAssegnabile, b: IngredienteAssegnabile) => a.nome.localeCompare(b.nome))
        setIngredienti(rows)
        setLoading(false)
      })
  }, [])

  async function toggleAssegna(ing: IngredienteAssegnabile) {
    const isAssegnato = ing.fornitore_id === fornitore.id
    setSaving(ing.ingrediente_id)
    await supabase
      .from('ingredienti_ristorante')
      .update({ fornitore_id: isAssegnato ? null : fornitore.id })
      .eq('ristorante_id', ristoranteId)
      .eq('ingrediente_id', ing.ingrediente_id)
    setIngredienti(prev =>
      prev.map(i =>
        i.ingrediente_id === ing.ingrediente_id
          ? { ...i, fornitore_id: isAssegnato ? null : fornitore.id }
          : i
      )
    )
    setSaving(null)
  }

  const assegnati = ingredienti.filter(i => i.fornitore_id === fornitore.id)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center p-6 pb-3 shrink-0">
          <div>
            <h2 className="font-bold text-caffe text-lg">{fornitore.nome}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{assegnati.length} ingredienti assegnati</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-400 px-6 pb-3 shrink-0">
          Tocca un ingrediente per assegnarlo o rimuoverlo da questo fornitore.
        </p>

        <div className="overflow-y-auto px-4 pb-6 space-y-1.5">
          {loading && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          {ingredienti.map(ing => {
            const isAssegnato = ing.fornitore_id === fornitore.id
            const isSaving    = saving === ing.ingrediente_id
            return (
              <button
                key={ing.ingrediente_id}
                onClick={() => toggleAssegna(ing)}
                disabled={isSaving}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all border ${
                  isAssegnato
                    ? 'bg-indigo-50 border-indigo-200 text-caffe'
                    : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}
              >
                <span className="text-sm font-medium">{ing.nome}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isAssegnato ? 'bg-terra text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {isSaving ? '…' : isAssegnato ? 'Assegnato' : 'Non assegnato'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface Props {
  onBack: () => void
}

export default function Fornitori({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const [fornitori, setFornitori]   = useState<Fornitore[]>([])
  const [loading, setLoading]       = useState(true)
  const [mostraAdd, setMostraAdd]   = useState(false)
  const [assegna, setAssegna]       = useState<Fornitore | null>(null)
  const [modifica, setModifica]     = useState<Fornitore | null>(null)

  const carica = useCallback(() => {
    setLoading(true)
    supabase
      .from('fornitori')
      .select('id, nome, contatto_nome, email, telefono, lead_time_giorni, note')
      .eq('ristorante_id', ristoranteId)
      .eq('attivo', true)
      .order('nome')
      .then(({ data }) => {
        setFornitori((data as Fornitore[]) ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => { carica() }, [carica])

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-caffe">Fornitori</h1>
            {!loading && (
              <p className="text-sm text-maro mt-0.5">{fornitori.length} fornitori</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={carica}
            className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setMostraAdd(true)}
            className="w-9 h-9 bg-terra text-white rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      <div className="space-y-2">
        {fornitori.map(f => (
          <div
            key={f.id}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
          >
            <div className="flex justify-between items-start">
              <button
                onClick={() => setAssegna(f)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                  <Truck size={18} className="text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-caffe truncate">{f.nome}</p>
                  {f.contatto_nome && (
                    <p className="text-xs text-slate-400 mt-0.5">{f.contatto_nome}</p>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => setModifica(f)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <Pencil size={15} />
                </button>
                <ChevronRight size={16} className="text-slate-300" onClick={() => setAssegna(f)} />
              </div>
            </div>

            {(f.email || f.telefono || f.lead_time_giorni) && (
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-50">
                {f.telefono && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Phone size={11} />
                    {f.telefono}
                  </span>
                )}
                {f.email && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Mail size={11} />
                    {f.email}
                  </span>
                )}
                {f.lead_time_giorni && (
                  <span className="text-xs text-slate-400">
                    Consegna in {f.lead_time_giorni}gg
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {!loading && fornitori.length === 0 && (
          <div className="text-center py-16">
            <Truck size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Nessun fornitore</p>
            <button
              onClick={() => setMostraAdd(true)}
              className="mt-4 text-sm text-terra font-medium border border-terra/30 px-4 py-2 rounded-full"
            >
              Aggiungi il primo
            </button>
          </div>
        )}
      </div>

      {mostraAdd && (
        <AddFornitoreModal
          onClose={() => setMostraAdd(false)}
          onSaved={f => { setMostraAdd(false); setFornitori(prev => [...prev, f].sort((a, b) => a.nome.localeCompare(b.nome))) }}
        />
      )}

      {assegna && (
        <AssegnaModal
          fornitore={assegna}
          onClose={() => setAssegna(null)}
          onSaved={() => setAssegna(null)}
        />
      )}

      {modifica && (
        <EditFornitoreModal
          fornitore={modifica}
          onClose={() => setModifica(null)}
          onSaved={f => {
            setModifica(null)
            setFornitori(prev => prev.map(x => x.id === f.id ? f : x).sort((a, b) => a.nome.localeCompare(b.nome)))
          }}
          onDeleted={id => {
            setModifica(null)
            setFornitori(prev => prev.filter(x => x.id !== id))
          }}
        />
      )}
    </div>
  )
}
