import { useRef, useState } from 'react'
import { ArrowLeft, FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
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
}

export default function VenditeCsv({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const inputRef = useRef<HTMLInputElement>(null)
  const [csv, setCsv] = useState(CSV_ESEMPIO)
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [risultato, setRisultato] = useState<Risultato | null>(null)

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

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2 pt-2">
        <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-caffe">Vendite CSV</h1>
          <p className="text-sm text-maro mt-0.5">Scarica ingredienti dalle vendite del registratore</p>
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
              Colonne: data, piatto, quantita_venduta. Il nome piatto deve combaciare con il Menu.
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

      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
        <label className="block text-xs font-semibold text-maro">CSV vendite</label>
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
          {loading ? 'Importo vendite...' : 'Importa e aggiorna magazzino'}
        </button>
      </div>

      {risultato && (
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
