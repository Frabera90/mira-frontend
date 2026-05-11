import { useRef, useState } from 'react'
import { Upload, FileImage, RotateCcw, CheckCircle, Loader2, CalendarDays, Hash, ArrowLeft, ChevronRight } from 'lucide-react'
import { BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Riga {
  descrizione: string
  quantita: number
  unita_misura: string
  prezzo_unitario: number
  importo_totale: number
}
interface FatturaEstratta {
  fornitore_nome: string
  numero_fattura: string | null
  data_fattura: string
  data_scadenza: string | null
  totale_fattura: number
  iva_totale: number
  righe: Riga[]
}

type Fase = 'idle' | 'preview' | 'analisi' | 'risultato' | 'errore'

interface Props {
  onBack?: () => void
}

export default function Fattura({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<{ base64: string; mediaType: string } | null>(null)
  const [estratti, setEstratti] = useState<FatturaEstratta | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [ingredientiCaricati, setIngredientiCaricati] = useState<number>(0)

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setPreviewType(file.type)
    setFase('preview')

    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      const [header, base64] = dataUrl.split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      setFileInfo({ base64, mediaType })
    }
    reader.readAsDataURL(file)
  }

  function selezionaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) handleFile(file)
  }

  async function analizza() {
    if (!fileInfo) return
    setFase('analisi')
    setErrore(null)

    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/fatture/analizza`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: fileInfo.base64, mediaType: fileInfo.mediaType }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Errore sconosciuto')
      setEstratti(json.data.estratti)
      setIngredientiCaricati(json.data.ingredienti_caricati ?? 0)
      setFase('risultato')
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore di rete')
      setFase('errore')
    }
  }

  function reset() {
    setFase('idle')
    setPreviewUrl(null)
    setPreviewType(null)
    setFileInfo(null)
    setEstratti(null)
    setErrore(null)
    setIngredientiCaricati(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 pt-2 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1 shrink-0">
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-semibold text-caffe">Scansiona fattura</h1>
          <p className="text-sm text-maro mt-0.5">
            Fotografa o carica una fattura — l'AI estrae tutto automaticamente
          </p>
        </div>
      </div>

      {/* IDLE — dropzone */}
      {fase === 'idle' && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all ${
            dragOver
              ? 'border-terra bg-indigo-50'
              : 'border-slate-200 bg-white hover:border-terra hover:bg-slate-50'
          }`}
        >
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
            <Upload size={24} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-caffe">Trascina qui o tocca per scegliere</p>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG, PDF — galleria o fotocamera · max 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={selezionaFile}
            className="hidden"
          />
        </div>
      )}

      {/* PREVIEW / ERRORE */}
      {(fase === 'preview' || fase === 'errore') && previewUrl && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
            {previewType === 'application/pdf' ? (
              <object data={previewUrl} type="application/pdf" className="w-full h-72">
                <div className="p-6 text-center text-sm text-slate-500">PDF selezionato. Premi Analizza con AI.</div>
              </object>
            ) : (
              <img src={previewUrl} alt="Fattura" className="w-full object-contain max-h-72 bg-slate-50" />
            )}
          </div>

          {fase === 'errore' && errore && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
              <strong>Errore:</strong> {errore}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-medium hover:bg-slate-50"
            >
              <RotateCcw size={15} />
              Altra foto
            </button>
            <button
              onClick={analizza}
              className="flex-1 flex items-center justify-center gap-2 bg-terra text-white rounded-xl py-3 text-sm font-semibold"
            >
              <FileImage size={15} />
              Analizza con AI
            </button>
          </div>
        </div>
      )}

      {/* ANALISI IN CORSO */}
      {fase === 'analisi' && (
        <div className="flex flex-col items-center gap-5 py-16">
          {previewUrl && (
            previewType === 'application/pdf'
              ? <div className="w-28 h-28 rounded-2xl bg-slate-100 flex items-center justify-center text-xs text-slate-400 opacity-70">PDF</div>
              : <img src={previewUrl} alt="" className="w-28 h-28 object-cover rounded-2xl opacity-40" />
          )}
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="text-terra animate-spin" />
            <div>
              <p className="font-semibold text-caffe">Analisi in corso…</p>
              <p className="text-xs text-slate-400 mt-0.5">AI vision sta leggendo la fattura</p>
            </div>
          </div>
        </div>
      )}

      {/* RISULTATO */}
      {fase === 'risultato' && estratti && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-800">Fattura salvata</p>
              <p className="text-xs text-emerald-600">
                {ingredientiCaricati > 0
                  ? `${ingredientiCaricati} ingredient${ingredientiCaricati === 1 ? 'e caricato' : 'i caricati'} in magazzino`
                  : 'Dati salvati — vai in Magazzino per verificare'}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-caffe text-lg">{estratti.fornitore_nome}</p>
                {estratti.numero_fattura && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Hash size={12} className="text-slate-400" />
                    <p className="text-xs text-slate-400">{estratti.numero_fattura}</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-terra">€{Number(estratti.totale_fattura).toFixed(2)}</p>
                <p className="text-xs text-slate-400">IVA €{Number(estratti.iva_totale).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-slate-500 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-1.5">
                <CalendarDays size={12} />
                <span>{estratti.data_fattura}</span>
              </div>
              {estratti.data_scadenza && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={12} className="text-amber-500" />
                  <span>Scad. {estratti.data_scadenza}</span>
                </div>
              )}
            </div>
          </div>

          {estratti.righe.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-caffe text-sm mb-3">
                Righe <span className="text-slate-400 font-normal">({estratti.righe.length})</span>
              </h3>
              <div className="space-y-0">
                {estratti.righe.map((r, i) => (
                  <div key={i} className="flex justify-between items-start py-2.5 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm text-caffe font-medium truncate">{r.descrizione}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {r.quantita} {r.unita_misura} × €{Number(r.prezzo_unitario).toFixed(4)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-caffe shrink-0">
                      €{Number(r.importo_totale).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {onBack && (
            <button
              onClick={onBack}
              className="w-full bg-terra text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 shadow-lg shadow-terra/20"
            >
              Vai al Magazzino
              <ChevronRight size={15} />
            </button>
          )}

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-medium hover:bg-slate-50"
          >
            <Upload size={15} />
            Scansiona un'altra fattura
          </button>
        </div>
      )}
    </div>
  )
}
