import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Plus, Users, Calendar, Clock, X, Trash2, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Prenotazione {
  id: string
  data_prenotazione: string
  ora_prenotazione: string | null
  numero_coperti: number
  nome_cliente: string | null
  telefono_cliente: string | null
  occasione: string | null
  note_speciali: string | null
  confermata: boolean
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

function PrenotazioneModal({
  prenotazione,
  onClose,
  onSaved,
}: {
  prenotazione: Prenotazione | null
  onClose: () => void
  onSaved: () => void
}) {
  const ristoranteId = useRistorante()
  const isEdit = prenotazione != null
  const [data, setData]         = useState(prenotazione?.data_prenotazione ?? new Date().toISOString().slice(0, 10))
  const [orario, setOrario]     = useState(prenotazione?.ora_prenotazione?.slice(0, 5) ?? '20:00')
  const [coperti, setCoperti]   = useState(String(prenotazione?.numero_coperti ?? ''))
  const [cliente, setCliente]   = useState(prenotazione?.nome_cliente ?? '')
  const [telefono, setTelefono] = useState(prenotazione?.telefono_cliente ?? '')
  const [occasione, setOccasione] = useState(prenotazione?.occasione ?? '')
  const [note, setNote]         = useState(prenotazione?.note_speciali ?? '')
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  async function salva() {
    const cop = parseInt(coperti)
    if (!coperti || isNaN(cop) || cop <= 0) { setErrore('Inserisci il numero di coperti'); return }
    if (!data) { setErrore('Inserisci la data'); return }
    setSaving(true)
    setErrore(null)

    const payload = {
      data_prenotazione: data,
      ora_prenotazione:  orario || null,
      numero_coperti:    cop,
      nome_cliente:      cliente.trim() || null,
      telefono_cliente:  telefono.trim() || null,
      occasione:         occasione.trim() || null,
      note_speciali:     note.trim() || null,
      confermata:        true,
    }

    const { error } = isEdit
      ? await supabase.from('prenotazioni').update(payload).eq('id', prenotazione!.id)
      : await supabase.from('prenotazioni').insert({ ...payload, ristorante_id: ristoranteId })

    setSaving(false)
    if (error) { setErrore(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl p-6 pb-8 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-caffe text-lg">
            {isEdit ? 'Modifica prenotazione' : 'Nuova prenotazione'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Data *</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Orario</label>
            <input
              type="time"
              value={orario}
              onChange={e => setOrario(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Coperti *</label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            value={coperti}
            onChange={e => setCoperti(e.target.value)}
            placeholder="es. 4"
            autoFocus={!isEdit}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome cliente</label>
          <input
            type="text"
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            placeholder="es. Rossi Mario"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Telefono</label>
          <input
            type="tel"
            inputMode="tel"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="es. 320 000 0000"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Occasione</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {['Compleanno', 'Anniversario', 'Lavoro', 'Famiglia'].map(o => (
              <button
                key={o}
                onClick={() => setOccasione(occasione === o ? '' : o)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  occasione === o
                    ? 'bg-terra text-white border-terra'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={occasione}
            onChange={e => setOccasione(e.target.value)}
            placeholder="o scrivi un'occasione personalizzata…"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Note</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="allergie, richieste speciali…"
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra resize-none"
          />
        </div>

        {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

        <button
          onClick={salva}
          disabled={saving || !coperti}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Aggiungi prenotazione'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  onBack?: () => void
}

export default function Prenotazioni({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([])
  const [loading, setLoading]           = useState(true)
  const [errore, setErrore]             = useState<string | null>(null)
  const [tab, setTab]                   = useState<'future' | 'tutte'>('future')
  const [modalOpen, setModalOpen]       = useState(false)
  const [editTarget, setEditTarget]     = useState<Prenotazione | null>(null)

  const carica = useCallback(() => {
    setLoading(true)
    setErrore(null)
    const oggi = new Date().toISOString().slice(0, 10)
    const q = supabase
      .from('prenotazioni')
      .select('id, data_prenotazione, ora_prenotazione, numero_coperti, nome_cliente, telefono_cliente, occasione, note_speciali, confermata')
      .eq('ristorante_id', ristoranteId)

    const query = tab === 'future'
      ? q.gte('data_prenotazione', oggi).order('data_prenotazione').order('ora_prenotazione')
      : q.order('data_prenotazione', { ascending: false })

    query.then(({ data, error }) => {
      if (error) setErrore(error.message)
      else setPrenotazioni((data as Prenotazione[]) ?? [])
      setLoading(false)
    })
  }, [tab])

  useEffect(() => { carica() }, [carica])

  function apriNuova() { setEditTarget(null); setModalOpen(true) }
  function apriEdit(p: Prenotazione) { setEditTarget(p); setModalOpen(true) }
  function chiudiModal() { setModalOpen(false); setEditTarget(null) }

  async function cancella(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('prenotazioni').delete().eq('id', id)
    setPrenotazioni(prev => prev.filter(p => p.id !== id))
  }

  const totaleCoperti = prenotazioni
    .filter(p => p.confermata)
    .reduce((s, p) => s + p.numero_coperti, 0)

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-1">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-caffe">Prenotazioni</h1>
            {!loading && (
              <p className="text-sm text-maro mt-0.5">
                {prenotazioni.length} prenotazioni · {totaleCoperti} coperti
              </p>
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
            onClick={apriNuova}
            className="w-9 h-9 bg-terra text-white rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 mt-3">
        {(['future', 'tutte'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t ? 'bg-terra text-white' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {t === 'future' ? 'Prossime' : 'Tutte'}
          </button>
        ))}
      </div>

      {errore && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 mb-3">
          {errore}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      )}

      <div className="space-y-2">
        {prenotazioni.map(p => {
          const dataFmt = new Date(p.data_prenotazione).toLocaleDateString('it-IT', {
            weekday: 'short', day: '2-digit', month: 'short',
          })

          return (
            <button
              key={p.id}
              onClick={() => apriEdit(p)}
              className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-left active:scale-[0.99] transition-transform"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={18} className="text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-caffe truncate">
                      {p.nome_cliente ?? 'Senza nome'}
                      {p.occasione && (
                        <span className="ml-2 text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {p.occasione}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar size={11} />
                        {dataFmt}
                      </span>
                      {p.ora_prenotazione && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={11} />
                          {p.ora_prenotazione.slice(0, 5)}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-indigo-600">
                        {p.numero_coperti} cop.
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={e => cancella(p.id, e)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {(p.telefono_cliente || p.note_speciali) && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-50 space-y-0.5">
                  {p.telefono_cliente && (
                    <p className="text-xs text-slate-400">{p.telefono_cliente}</p>
                  )}
                  {p.note_speciali && (
                    <p className="text-xs text-slate-400 italic">{p.note_speciali}</p>
                  )}
                </div>
              )}
            </button>
          )
        })}

        {!loading && prenotazioni.length === 0 && (
          <div className="text-center py-16">
            <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">
              {tab === 'future' ? 'Nessuna prenotazione in arrivo' : 'Nessuna prenotazione'}
            </p>
            <button
              onClick={apriNuova}
              className="mt-4 text-sm text-terra font-medium border border-terra/30 px-4 py-2 rounded-full"
            >
              Aggiungi la prima
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <PrenotazioneModal
          prenotazione={editTarget}
          onClose={chiudiModal}
          onSaved={() => { chiudiModal(); carica() }}
        />
      )}
    </div>
  )
}
