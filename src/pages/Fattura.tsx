import { useRef, useState } from 'react'
import { Upload, FileImage, RotateCcw, CheckCircle, Loader2, CalendarDays, Hash, ArrowLeft, Package } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
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
  const [fileInfo, setFileInfo] = useState<{ base64: string; mediaType: string } | null>(null)
  const [estratti, setEstratti] = useState<FatturaEstratta | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [righeSelezionate, setRigheSelezionate] = useState<Set<number>>(new Set())
  const [confermando, setConfermando] = useState(false)
  const [scortaAggiornata, setScortaAggiornata] = useState(false)
  const [risultatoScorte, setRisultatoScorte] = useState<{ caricati: number; nonTrovati: string[] } | null>(null)

  function handleFile(file: File) {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
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
      setRigheSelezionate(new Set((json.data.estratti.righe as Riga[]).map((_, i) => i)))
      setFase('risultato')
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Errore di rete')
      setFase('errore')
    }
  }

  function reset() {
    setFase('idle')
    setPreviewUrl(null)
    setFileInfo(null)
    setEstratti(null)
    setErrore(null)
    setRigheSelezionate(new Set())
    setScortaAggiornata(false)
    setRisultatoScorte(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function confermaScorte() {
    if (!estratti || righeSelezionate.size === 0) return
    setConfermando(true)

    let caricati = 0
    const nonTrovati: string[] = []

    for (const idx of righeSelezionate) {
      const riga = estratti.righe[idx]
      if (!riga.quantita || riga.quantita <= 0) continue

      // Try matching by first word, then first two words
      const parole = riga.descrizione.split(' ')
      const keyword1 = parole.slice(0, 2).join(' ')
      const keyword2 = parole[0]

      let ing = null
      for (const kw of [keyword1, keyword2]) {
        const { data } = await supabase
          .from('ingredienti')
          .select('id')
          .ilike('nome', `%${kw}%`)
          .limit(1)
          .maybeSingle()
        if (data) { ing = data; break }
      }

      if (!ing) {
        nonTrovati.push(riga.descrizione)
        continue
      }

      const { data: scorta } = await supabase
        .from('scorte')
        .select('quantita_disponibile')
        .eq('ristorante_id', ristoranteId)
        .eq('ingrediente_id', ing.id)
        .maybeSingle()

      await Promise.all([
        supabase.from('scorte').upsert({
          ristorante_id: ristoranteId,
          ingrediente_id: ing.id,
          quantita_disponibile: (scorta?.quantita_disponibile ?? 0) + riga.quantita,
          data_ultimo_carico: new Date().toISOString().slice(0, 10),
        }, { onConflict: 'ristorante_id,ingrediente_id' }),
        supabase.from('movimenti_scorte').insert({
          ristorante_id: ristoranteId,
          ingrediente_id: ing.id,
          tipo_movimento: 'carico',
          quantita: riga.quantita,
          motivo: `Fattura ${estratti.fornitore_nome}`,
        }),
      ])
      caricati++
    }

    setConfermando(false)
    setRisultatoScorte({ caricati, nonTrovati })
    setScortaAggiornata(true)
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
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <img src={previewUrl} alt="Fattura" className="w-full object-contain max-h-72 bg-slate-50" />
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
            <img src={previewUrl} alt="" className="w-28 h-28 object-cover rounded-2xl opacity-40" />
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
            <div>
              <p className="font-semibold text-emerald-800">Fattura salvata</p>
              <p className="text-xs text-emerald-600">Dati estratti e salvati su Supabase</p>
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

          {estratti.righe.length > 0 && !scortaAggiornata && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-caffe text-sm mb-0.5">Aggiorna magazzino</h3>
              <p className="text-xs text-slate-400 mb-3">Seleziona le righe da caricare in magazzino</p>
              <div className="space-y-2 mb-4">
                {estratti.righe.map((r, i) => (
                  <label key={i} className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={righeSelezionate.has(i)}
                      onChange={e => {
                        const next = new Set(righeSelezionate)
                        if (e.target.checked) next.add(i)
                        else next.delete(i)
                        setRigheSelezionate(next)
                      }}
                      className="w-4 h-4 accent-terra shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-caffe font-medium truncate">{r.descrizione}</p>
                      <p className="text-xs text-slate-400">{r.quantita} {r.unita_misura}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={confermaScorte}
                disabled={confermando || righeSelezionate.size === 0}
                className="w-full bg-terra text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-terra/20"
              >
                {confermando
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Package size={15} />}
                {confermando
                  ? 'Aggiornamento…'
                  : `Carica ${righeSelezionate.size} ingredient${righeSelezionate.size === 1 ? 'e' : 'i'}`}
              </button>
            </div>
          )}

          {scortaAggiornata && risultatoScorte && (
            <div className={`rounded-xl p-4 border ${risultatoScorte.caricati > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start gap-3">
                <CheckCircle size={18} className={`shrink-0 mt-0.5 ${risultatoScorte.caricati > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div>
                  <p className={`text-sm font-semibold ${risultatoScorte.caricati > 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {risultatoScorte.caricati > 0
                      ? `${risultatoScorte.caricati} ingredient${risultatoScorte.caricati === 1 ? 'e caricato' : 'i caricati'}`
                      : 'Nessun ingrediente abbinato'}
                  </p>
                  {risultatoScorte.nonTrovati.length > 0 && (
                    <div className="mt-1">
                      <p className="text-xs text-amber-700 font-medium">{risultatoScorte.nonTrovati.length} righe non abbinate:</p>
                      {risultatoScorte.nonTrovati.map((d, i) => (
                        <p key={i} className="text-xs text-amber-600 truncate">• {d}</p>
                      ))}
                      <p className="text-xs text-amber-500 mt-1">Aggiungili in Magazzino con lo stesso nome della fattura.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
