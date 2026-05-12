import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Copy, Check, Eye, EyeOff, Upload, Terminal, ChevronDown } from 'lucide-react'
import { BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Props {
  onBack: () => void
}

interface CsvRow {
  nome: string
  porzioni: number
}

export default function CollegaCassa({ onBack }: Props) {
  const ristoranteId = useRistorante()
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [loading, setLoading] = useState(true)

  // CSV import state
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvRaws, setCsvRaws] = useState<string[][]>([])
  const [colNome, setColNome] = useState<number>(0)
  const [colPorzioni, setColPorzioni] = useState<number>(1)
  const [csvDataStr, setCsvDataStr] = useState(() => new Date().toISOString().slice(0, 10))
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const webhookUrl = `${BACKEND_URL}/api/ristoranti/${ristoranteId}/pos/vendite`

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/pos/api-key`)
      .then(r => r.json())
      .then(j => {
        if (j.api_key) setApiKey(j.api_key)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ristoranteId])

  function copy(text: string, which: 'key' | 'url' | 'curl') {
    navigator.clipboard.writeText(text).catch(() => {})
    if (which === 'key') { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }
    if (which === 'url') { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000) }
    if (which === 'curl') { setCopiedCurl(true); setTimeout(() => setCopiedCurl(false), 2000) }
  }

  const curlExample = apiKey
    ? `curl -X POST "${webhookUrl}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"piatti":[{"nome":"Spaghetti carbonara","porzioni":3},{"nome":"Bistecca","porzioni":2}]}'`
    : ''

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = text
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => l.split(/[,;\t]/))
      setCsvRaws(rows)
      setImportResult(null)
      // Auto-detect columns
      const header = rows[0]?.map(h => h.toLowerCase().replace(/"/g, '').trim()) ?? []
      const nIdx = header.findIndex(h => h.includes('nom') || h.includes('piatt') || h.includes('desc'))
      const pIdx = header.findIndex(h => h.includes('por') || h.includes('qta') || h.includes('qty') || h.includes('quant') || h.includes('cov'))
      if (nIdx >= 0) setColNome(nIdx)
      if (pIdx >= 0) setColPorzioni(pIdx)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const csvHeaders = csvRaws[0] ?? []
  const csvDataRows = csvRaws.slice(1).filter(r => r.length > 1)

  const preview: CsvRow[] = csvDataRows.slice(0, 5).map(r => ({
    nome: r[colNome]?.replace(/"/g, '').trim() ?? '',
    porzioni: Number(r[colPorzioni]?.replace(/"/g, '').trim()) || 1,
  })).filter(r => r.nome)

  async function importaCsv() {
    if (!apiKey || !preview.length) return
    setImporting(true)
    setImportResult(null)
    try {
      const allRows: CsvRow[] = csvDataRows.map(r => ({
        nome: r[colNome]?.replace(/"/g, '').trim() ?? '',
        porzioni: Number(r[colPorzioni]?.replace(/"/g, '').trim()) || 1,
      })).filter(r => r.nome)

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: csvDataStr,
          servizio: 'CSV',
          piatti: allRows,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        const d = json.data
        setImportResult({
          ok: true,
          msg: `${d.piatti_salvati ?? 0} piatti importati · ${d.ingredienti_scalati ?? 0} ingredienti scalati` +
            (d.non_riconosciuti?.length ? `\nNon riconosciuti: ${d.non_riconosciuti.join(', ')}` : ''),
        })
      } else {
        setImportResult({ ok: false, msg: json.error ?? 'Errore sconosciuto' })
      }
    } catch (err: any) {
      setImportResult({ ok: false, msg: err.message })
    }
    setImporting(false)
  }

  return (
    <div className="p-4 pb-10">
      <div className="flex items-center gap-2 pt-2 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-caffe">Collega Cassa</h1>
      </div>

      <div className="space-y-5">

        {/* Intro */}
        <div className="bg-terra/5 border border-terra/20 rounded-2xl p-4 text-sm text-caffe leading-relaxed">
          Collega qualsiasi POS o software di cassa a MIRA tramite webhook o importazione CSV.
          Ogni vendita aggiorna automaticamente il magazzino e calcola il food cost reale.
        </div>

        {/* Webhook URL */}
        <section>
          <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Endpoint webhook</p>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-xs font-mono text-slate-600 break-all">
                {webhookUrl}
              </code>
              <button
                onClick={() => copy(webhookUrl, 'url')}
                className="shrink-0 p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                {copiedUrl ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Metodo: <span className="font-semibold text-caffe">POST</span> ·
              Auth: <span className="font-semibold text-caffe">Bearer &lt;api_key&gt;</span> ·
              Body: <span className="font-mono text-caffe">JSON</span>
            </p>
          </div>
        </section>

        {/* API Key */}
        <section>
          <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">API Key</p>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            {loading ? (
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-xs font-mono text-slate-600 break-all">
                  {showKey ? apiKey : apiKey?.replace(/./g, '•')}
                </code>
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="shrink-0 p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  onClick={() => apiKey && copy(apiKey, 'key')}
                  className="shrink-0 p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                >
                  {copiedKey ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400">
              La chiave è generata deterministicamente dal tuo ristorante — non cambia a meno che non cambi il segreto del server.
            </p>
          </div>
        </section>

        {/* cURL example */}
        {apiKey && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-maro uppercase tracking-wide">Esempio cURL</p>
              <button
                onClick={() => copy(curlExample, 'curl')}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-caffe"
              >
                <Terminal size={12} />
                {copiedCurl ? 'Copiato!' : 'Copia'}
              </button>
            </div>
            <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">{curlExample}</pre>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Il campo <code className="font-mono">porzioni</code> accetta anche <code className="font-mono">quantita</code> o <code className="font-mono">qty</code>.
              Il campo <code className="font-mono">data</code> è opzionale (default: oggi).
            </p>
          </section>
        )}

        {/* CSV Import */}
        <section>
          <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Importa CSV</p>
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-terra/40 hover:text-terra transition-colors"
            >
              <Upload size={20} />
              <span className="text-sm font-medium">Seleziona file CSV</span>
              <span className="text-xs">Formati supportati: .csv, .txt (separatori: virgola, punto e virgola, tab)</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />

            {csvRaws.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-maro mb-1.5">Colonna nome piatto</label>
                    <div className="relative">
                      <select
                        value={colNome}
                        onChange={e => setColNome(Number(e.target.value))}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm pr-8 outline-none focus:border-terra"
                      >
                        {csvHeaders.map((h, i) => (
                          <option key={i} value={i}>{h || `Colonna ${i + 1}`}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-maro mb-1.5">Colonna porzioni</label>
                    <div className="relative">
                      <select
                        value={colPorzioni}
                        onChange={e => setColPorzioni(Number(e.target.value))}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm pr-8 outline-none focus:border-terra"
                      >
                        {csvHeaders.map((h, i) => (
                          <option key={i} value={i}>{h || `Colonna ${i + 1}`}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Data servizio</label>
                  <input
                    type="date"
                    value={csvDataStr}
                    onChange={e => setCsvDataStr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </div>

                {preview.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-maro mb-2">Anteprima ({Math.min(5, csvDataRows.length)} di {csvDataRows.length} righe)</p>
                    <div className="bg-slate-50 rounded-xl overflow-hidden">
                      {preview.map((row, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-slate-100 last:border-0">
                          <span className="text-sm text-caffe truncate flex-1">{row.nome}</span>
                          <span className="text-sm font-semibold text-terra ml-2 shrink-0">{row.porzioni} pz</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult && (
                  <div className={`rounded-xl p-3 text-sm leading-relaxed ${importResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {importResult.msg.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                  </div>
                )}

                <button
                  onClick={importaCsv}
                  disabled={importing || !preview.length || !apiKey}
                  className="w-full bg-terra text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                >
                  {importing ? 'Importazione in corso…' : `Importa ${csvDataRows.length} righe`}
                </button>
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
