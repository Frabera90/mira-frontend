import { useRef, useState } from 'react'
import { ArrowLeft, FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Loader2, Plus, Trash2, RotateCcw } from 'lucide-react'
import { BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

const CSV_ESEMPIO = `data,piatto,quantita_venduta
2026-05-11,Branzino all'acqua pazza con olive e capperi,4
2026-05-11,Rigatoni all'amatriciana della tradizione,9
2026-05-11,Tiramisu della casa,6`

interface Props {
  onBack: () => void
}

interface Risultato {
  vendite_processate: number
  deduzioni_scorte: number
  errori: string[]
  analisi_servizio?: {
    costo_teorico: number
    costo_sprechi: number
    valore_eccedenze: number
    costo_reale_stimato: number
    messaggio: string
    anomalie: Array<{
      tipo: string
      ingrediente: string
      quantita: number
      unita_misura: string
      costo_stimato: number
      consumo_atteso: number
      peso_su_atteso_pct: number | null
      messaggio: string
    }>
  }
}

export default function VenditeCsv({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const inputRef = useRef<HTMLInputElement>(null)
  const [csv, setCsv] = useState(CSV_ESEMPIO)
  const [loading, setLoading] = useState(false)
  const [savingEvento, setSavingEvento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [risultato, setRisultato] = useState<Risultato | null>(null)
  const [tipoEvento, setTipoEvento] = useState<'spreco' | 'eccedenza'>('spreco')
  const [ingredienteEvento, setIngredienteEvento] = useState('')
  const [quantitaEvento, setQuantitaEvento] = useState('')
  const [motivoEvento, setMotivoEvento] = useState('')
  const [eventi, setEventi] = useState<Array<{ tipo: string; ingrediente: string; quantita: number }>>([])

  async function leggiFile(file: File) {
    const text = await file.text()
    setCsv(text)
    setRisultato(null)
    setErrore(null)
  }

  async function importa() {
    setLoading(true)
    setErrore(null)
    setRisultato(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/vendite/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore import CSV')
      setRisultato(json.data)
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  async function registraEvento() {
    if (!ingredienteEvento.trim() || !quantitaEvento.trim()) {
      setErrore('Inserisci prodotto e quantita.')
      return
    }
    setSavingEvento(true)
    setErrore(null)
    setRisultato(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/servizio/movimento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoEvento,
          ingrediente: ingredienteEvento,
          quantita: parseFloat(quantitaEvento.replace(',', '.')),
          motivo: motivoEvento || 'Registrato da fine servizio',
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore registrazione evento')
      setEventi(prev => [{ tipo: tipoEvento, ingrediente: ingredienteEvento, quantita: parseFloat(quantitaEvento.replace(',', '.')) }, ...prev])
      setIngredienteEvento('')
      setQuantitaEvento('')
      setMotivoEvento('')
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore di rete')
    } finally {
      setSavingEvento(false)
    }
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2 pt-2">
        <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-caffe">Fine servizio</h1>
          <p className="text-sm text-maro mt-0.5">Carica vendite, sprechi ed eccedenze</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-caffe">Formato richiesto</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Il file deve avere: data, piatto, quantita_venduta. Prima puoi segnare qui sotto sprechi o avanzi.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) leggiFile(file)
          }}
        />

        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border border-slate-200 rounded-xl py-3 text-sm font-semibold text-slate-600 flex items-center justify-center gap-2"
        >
          <Upload size={15} />
          Scegli file CSV
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            {tipoEvento === 'spreco' ? <Trash2 size={18} /> : <RotateCcw size={18} />}
          </div>
          <div>
            <p className="text-sm font-semibold text-caffe">Aggiungi spreco o avanzo</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Scrivi il prodotto come lo chiamate in cucina. MIRA lo abbina al magazzino.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTipoEvento('spreco')}
            className={`rounded-xl py-2.5 text-sm font-semibold border ${
              tipoEvento === 'spreco'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            Spreco
          </button>
          <button
            type="button"
            onClick={() => setTipoEvento('eccedenza')}
            className={`rounded-xl py-2.5 text-sm font-semibold border ${
              tipoEvento === 'eccedenza'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            Eccedenza
          </button>
        </div>

        <div className="grid grid-cols-[1fr_96px] gap-2">
          <input
            value={ingredienteEvento}
            onChange={e => setIngredienteEvento(e.target.value)}
            placeholder="Prodotto: branzino, prosecco..."
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
          />
          <input
            value={quantitaEvento}
            onChange={e => setQuantitaEvento(e.target.value)}
            inputMode="decimal"
            placeholder="Qta"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>
        <input
          value={motivoEvento}
          onChange={e => setMotivoEvento(e.target.value)}
          placeholder="Motivo: caduto, avanzato, errore comanda..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
        />
        <button
          onClick={registraEvento}
          disabled={savingEvento || !ingredienteEvento.trim() || !quantitaEvento.trim()}
          className="w-full bg-caffe text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {savingEvento ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {savingEvento ? 'Registro...' : 'Salva spreco/avanzo'}
        </button>

        {eventi.length > 0 && (
          <div className="space-y-1">
            {eventi.slice(0, 3).map((e, i) => (
              <p key={i} className="text-xs text-slate-500">
                {e.tipo === 'spreco' ? '-' : '+'}{e.quantita} {e.ingrediente} registrato come {e.tipo}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
        <label className="block text-xs font-semibold text-maro">File o testo vendite</label>
        <textarea
          value={csv}
          onChange={e => { setCsv(e.target.value); setRisultato(null); setErrore(null) }}
          rows={10}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-terra resize-none"
        />
        <button
          onClick={importa}
          disabled={loading || !csv.trim()}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
          {loading ? 'Importo vendite...' : 'Chiudi servizio e aggiorna magazzino'}
        </button>
      </div>

      {risultato && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-3">
            <CheckCircle size={19} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Vendite importate</p>
              <p className="text-xs text-emerald-700 mt-1">
                {risultato.vendite_processate} righe vendita, {risultato.deduzioni_scorte} scarichi ingredienti.
              </p>
              {risultato.errori?.length > 0 && (
                <div className="mt-2 text-xs text-amber-700">
                  {risultato.errori.slice(0, 4).map((e, i) => <p key={i}>- {e}</p>)}
                </div>
              )}
            </div>
          </div>

          {risultato.analisi_servizio && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  risultato.analisi_servizio.anomalie.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {risultato.analisi_servizio.anomalie.length ? <AlertTriangle size={17} /> : <CheckCircle size={17} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-caffe">Controllo servizio</p>
                  <p className="text-xs text-slate-500 mt-0.5">{risultato.analisi_servizio.messaggio}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Metric label="Teorico" value={`€${risultato.analisi_servizio.costo_teorico.toFixed(2)}`} />
                <Metric label="Sprechi" value={`€${risultato.analisi_servizio.costo_sprechi.toFixed(2)}`} tone="rose" />
                <Metric label="Reale stimato" value={`€${risultato.analisi_servizio.costo_reale_stimato.toFixed(2)}`} />
              </div>

              {risultato.analisi_servizio.anomalie.length > 0 && (
                <div className="space-y-2">
                  {risultato.analisi_servizio.anomalie.slice(0, 5).map((a, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-semibold text-caffe">{a.ingrediente}</p>
                        <p className={`text-xs font-semibold ${a.tipo === 'spreco' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {a.tipo === 'spreco' ? '-' : '+'}{a.quantita} {a.unita_misura}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{a.messaggio}</p>
                      <p className="text-xs text-maro mt-1">Impatto stimato: €{a.costo_stimato.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400">
                Da qui MIRA continua a correggere food cost, scorte e suggerimenti d'ordine usando quello che hai registrato durante il servizio.
              </p>
            </div>
          )}
        </div>
      )}

      {errore && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={19} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700">{errore}</p>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'rose' }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2">
      <p className="text-[10px] uppercase font-semibold text-slate-400">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone === 'rose' ? 'text-rose-600' : 'text-caffe'}`}>{value}</p>
    </div>
  )
}
