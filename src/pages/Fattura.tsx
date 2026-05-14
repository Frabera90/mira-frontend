import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, FileImage, RotateCcw, CheckCircle, Loader2, CalendarDays, Hash, ArrowLeft, ChevronRight, X } from 'lucide-react'
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
interface FatturaStorico {
  id: string
  numero_fattura: string | null
  data_fattura: string
  totale_euro: number
  totale_iva: number | null
  fornitori: { nome: string } | { nome: string }[] | null
}
interface FatturaDetail {
  id: string
  numero_fattura: string | null
  data_fattura: string
  data_scadenza_pagamento: string | null
  totale_euro: number
  totale_iva: number | null
  fornitori: { nome: string } | null
  fatture_righe: Riga[]
}

type Fase = 'idle' | 'preview' | 'analisi' | 'risultato' | 'errore'

interface Props {
  onBack?: () => void
}

const ACCEPTED_AI_FILES = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const SUPPORTED_AI_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

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
  const [storico, setStorico] = useState<FatturaStorico[]>([])
  const [loadingStorico, setLoadingStorico] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<FatturaDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const caricaStorico = useCallback(async () => {
    setLoadingStorico(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/fatture`)
      const json = await res.json()
      setStorico(json.ok ? json.data ?? [] : [])
    } finally {
      setLoadingStorico(false)
    }
  }, [ristoranteId])

  useEffect(() => { caricaStorico() }, [caricaStorico])

  async function apriDettaglio(id: string) {
    setDetailId(id)
    setDetail(null)
    setLoadingDetail(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/fatture/${id}`)
      const json = await res.json()
      if (json.ok) setDetail(json.data)
    } finally {
      setLoadingDetail(false)
    }
  }

  function handleFile(file: File) {
    if (!SUPPORTED_AI_MEDIA_TYPES.has(file.type)) {
      setErrore('Formato non supportato. Usa JPG, PNG, WEBP, GIF o PDF. Se la foto e in HEIC, esportala come JPG.')
      setFase('errore')
      return
    }
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
    if (file) handleFile(file)
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
      await caricaStorico()
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
            Tocca il riquadro, scegli una foto o un PDF. MIRA carica scorte e prezzi.
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
          <div className="w-16 h-16 bg-terra/10 rounded-2xl flex items-center justify-center">
            <Upload size={30} className="text-terra" />
          </div>
          <div className="text-center">
            <p className="font-bold text-caffe text-lg">Tocca qui per scegliere la fattura</p>
            <p className="text-sm text-slate-500 mt-1">Foto, PDF, galleria o fotocamera</p>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP, GIF o PDF</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_AI_FILES}
            onChange={selezionaFile}
            className="hidden"
          />
        </div>
      )}

      {fase === 'idle' && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-caffe">Fatture caricate</h2>
            <button onClick={caricaStorico} className="text-xs font-semibold text-terra">Aggiorna</button>
          </div>
          {loadingStorico && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 text-sm text-slate-400">
              Carico fatture...
            </div>
          )}
          {!loadingStorico && storico.length === 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 text-sm text-slate-400">
              Nessuna fattura ancora visibile. Carica la prima qui sopra.
            </div>
          )}
          {!loadingStorico && storico.length > 0 && (
            <div className="space-y-2">
              {storico.map(f => {
                const fornitore = Array.isArray(f.fornitori) ? f.fornitori[0]?.nome : f.fornitori?.nome
                return (
                  <button
                    key={f.id}
                    onClick={() => apriDettaglio(f.id)}
                    className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-caffe truncate">{fornitore || 'Fornitore non indicato'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {f.numero_fattura ? `N. ${f.numero_fattura} · ` : ''}{f.data_fattura}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-bold text-terra">€{Number(f.totale_euro ?? 0).toFixed(2)}</p>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Modal dettaglio fattura */}
          {detailId && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setDetailId(null)}>
              <div
                className="bg-white rounded-t-2xl w-full max-w-[480px] mx-auto max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
                  <p className="font-semibold text-caffe">
                    {detail ? (Array.isArray(detail.fornitori) ? detail.fornitori[0]?.nome : detail.fornitori?.nome) ?? 'Fattura' : 'Carico…'}
                  </p>
                  <button onClick={() => setDetailId(null)} className="text-slate-400 p-1"><X size={18} /></button>
                </div>

                {loadingDetail && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="text-terra animate-spin" />
                  </div>
                )}

                {detail && !loadingDetail && (
                  <div className="overflow-y-auto p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        {detail.numero_fattura && (
                          <p className="text-xs text-slate-400">N. {detail.numero_fattura}</p>
                        )}
                        <p className="text-sm text-slate-500">{detail.data_fattura}</p>
                        {detail.data_scadenza_pagamento && (
                          <p className="text-xs text-amber-600 mt-0.5">Scad. {detail.data_scadenza_pagamento}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-terra">€{Number(detail.totale_euro).toFixed(2)}</p>
                        {detail.totale_iva != null && (
                          <p className="text-xs text-slate-400">IVA €{Number(detail.totale_iva).toFixed(2)}</p>
                        )}
                      </div>
                    </div>

                    {detail.fatture_righe?.length > 0 ? (
                      <div className="bg-slate-50 rounded-2xl overflow-hidden">
                        <p className="text-xs font-semibold text-maro px-4 pt-3 pb-2">
                          {detail.fatture_righe.length} righe
                        </p>
                        {detail.fatture_righe.map((r, i) => (
                          <div key={i} className="flex justify-between items-start px-4 py-2.5 border-t border-slate-100">
                            <div className="flex-1 min-w-0 mr-3">
                              <p className="text-sm text-caffe font-medium truncate">{r.descrizione}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {r.quantita} {r.unita_misura ?? ''} × €{Number(r.prezzo_unitario).toFixed(4)}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-caffe shrink-0">
                              €{Number(r.importo_totale).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">Nessuna riga disponibile</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {fase === 'errore' && errore && !previewUrl && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <strong>Errore:</strong> {errore}
        </div>
      )}

      {/* PREVIEW / ERRORE */}
      {(fase === 'preview' || fase === 'errore') && previewUrl && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
            {previewType === 'application/pdf' ? (
              <object data={previewUrl} type="application/pdf" className="w-full h-72">
                <div className="p-6 text-center text-sm text-slate-500">PDF selezionato. Premi Leggi fattura.</div>
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
              Cambia file
            </button>
            <button
              onClick={analizza}
              className="flex-1 flex items-center justify-center gap-2 bg-terra text-white rounded-xl py-3 text-sm font-semibold"
            >
              <FileImage size={15} />
              Leggi fattura
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
            <p className="text-sm font-semibold text-caffe">Ricevuta importazione</p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <MiniMetric label="Righe lette" value={String(estratti.righe.length)} />
              <MiniMetric label="Scorte" value={String(ingredientiCaricati)} />
              <MiniMetric label="Storico" value="Salvata" />
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              La fattura resta nello storico. Se un prodotto non ha nome o prezzo corretto, lo vedrai in Scorte e potrai correggerlo.
            </p>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2 text-center">
      <p className="text-sm font-bold text-caffe">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}
