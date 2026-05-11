import { useEffect, useState, useMemo, useCallback } from 'react'
import { RefreshCw, Plus, Search, ChevronRight, X, ArrowDown, ArrowUp, Pencil, Trash2, ArrowRightLeft, History, ClipboardList, Settings, SlidersHorizontal, Flame, Leaf, Snowflake, Package, Wine, Star } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface ScortaRaw {
  ingrediente_id: string
  quantita_disponibile: number
  data_scadenza_prossima: string | null
  ingredienti: { nome: string; unita_misura: string }[] | null
}
interface StockMin {
  ingrediente_id: string
  stock_minimo: number | null
}
interface Scorta extends ScortaRaw {
  stock_minimo: number
  ingrediente: { nome: string; unita_misura: string } | null
}

type Stato = 'esaurito' | 'scadenza' | 'basso' | 'ok'
type TipoMov = 'carico' | 'scarico' | 'spreco' | 'rettifica'

const STATO_CFG: Record<Stato, { label: string; cls: string }> = {
  esaurito: { label: 'Esaurito',    cls: 'bg-rose-100 text-rose-700' },
  scadenza: { label: 'In scadenza', cls: 'bg-amber-100 text-amber-700' },
  basso:    { label: 'Basso',       cls: 'bg-yellow-100 text-yellow-700' },
  ok:       { label: 'OK',          cls: 'bg-emerald-100 text-emerald-700' },
}

const TIPI_MOV: { id: TipoMov; label: string; Icon: React.ElementType; segno: 1 | -1 }[] = [
  { id: 'carico',    label: 'Arrivo',    Icon: ArrowDown,         segno:  1 },
  { id: 'scarico',   label: 'Utilizzo',  Icon: ArrowUp,           segno: -1 },
  { id: 'spreco',    label: 'Spreco',    Icon: Trash2,            segno: -1 },
  { id: 'rettifica', label: 'Rettifica', Icon: SlidersHorizontal, segno:  1 },
]

function calcolaStato(qty: number, min: number, gg: number | null): Stato {
  if (qty <= 0)               return 'esaurito'
  if (gg !== null && gg <= 1) return 'scadenza'
  if (qty <= min && min > 0)  return 'basso'
  return 'ok'
}

function ggScadenza(data: string | null, oggi: Date): number | null {
  if (!data) return null
  return Math.ceil((new Date(data).getTime() - oggi.getTime()) / 86_400_000)
}

// ── Tipi prodotto ─────────────────────────────────────────────

type TipoProdotto = 'fresco_alta_rotazione' | 'fresco_media_rotazione' | 'congelato' | 'secco' | 'vini_bevande' | 'premium_stagionale'

const TIPI_PRODOTTO: { id: TipoProdotto; label: string; Icon: React.ElementType; vitaGg: number; freqGg: number; sogliaGg: number; leadGg: number; spreco: number; categoria: string }[] = [
  { id: 'fresco_alta_rotazione',  label: 'Fresco alta rot.',  Icon: Flame,     vitaGg: 2,   freqGg: 2,  sogliaGg: 1,  leadGg: 1, spreco: 8,   categoria: 'generico' },
  { id: 'fresco_media_rotazione', label: 'Fresco media rot.', Icon: Leaf,      vitaGg: 7,   freqGg: 5,  sogliaGg: 2,  leadGg: 2, spreco: 6,   categoria: 'generico' },
  { id: 'congelato',              label: 'Surgelato',         Icon: Snowflake, vitaGg: 180, freqGg: 21, sogliaGg: 7,  leadGg: 2, spreco: 4,   categoria: 'surgelati' },
  { id: 'secco',                  label: 'Secco / Dispensa',  Icon: Package,   vitaGg: 365, freqGg: 30, sogliaGg: 10, leadGg: 2, spreco: 2,   categoria: 'secchi' },
  { id: 'vini_bevande',           label: 'Vini / Bevande',    Icon: Wine,      vitaGg: 730, freqGg: 30, sogliaGg: 10, leadGg: 3, spreco: 0.5, categoria: 'bevande' },
  { id: 'premium_stagionale',     label: 'Premium',           Icon: Star,      vitaGg: 7,   freqGg: 5,  sogliaGg: 2,  leadGg: 1, spreco: 10,  categoria: 'premium' },
]

const UNITA = ['kg', 'lt', 'g', 'bt', 'pz', 'conf']

// ── Modal aggiungi ingrediente ────────────────────────────────

interface AggiungiProps {
  onClose: () => void
  onSaved: () => void
}

function AggiungiIngredienteModal({ onClose, onSaved }: AggiungiProps) {
  const ristoranteId = useRistorante()
  const [nome, setNome]               = useState('')
  const [um, setUm]                   = useState('kg')
  const [tipo, setTipo]               = useState<TipoProdotto>('fresco_alta_rotazione')
  const [quantita, setQuantita]       = useState('')
  const [stockMin, setStockMin]       = useState('')
  const [prezzo, setPrezzo]           = useState('')
  const [scadenza, setScadenza]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [errore, setErrore]           = useState<string | null>(null)

  const tipoCfg = TIPI_PRODOTTO.find(t => t.id === tipo)!
  const mostraScadenza = tipo === 'fresco_alta_rotazione' || tipo === 'fresco_media_rotazione' || tipo === 'premium_stagionale'

  async function salva() {
    if (!nome.trim()) { setErrore('Inserisci il nome'); return }
    const qty = parseFloat(quantita.replace(',', '.'))
    if (isNaN(qty) || qty < 0) { setErrore('Quantità non valida'); return }
    setSaving(true); setErrore(null)

    const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/ingredienti`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome.trim(),
        tipo_prodotto: tipo,
        categoria: tipoCfg.categoria,
        unita_misura: um,
        quantita: qty,
        stock_minimo: stockMin ? parseFloat(stockMin.replace(',', '.')) : 0,
        prezzo_acquisto_corrente: prezzo ? parseFloat(prezzo.replace(',', '.')) : null,
        data_scadenza_prossima: scadenza || null,
        vita_giorni_default: tipoCfg.vitaGg,
        frequenza_ordine_giorni_default: tipoCfg.freqGg,
        soglia_alert_giorni_default: tipoCfg.sogliaGg,
        lead_time_fornitore_giorni_default: tipoCfg.leadGg,
        tasso_spreco_percentuale_default: tipoCfg.spreco,
      }),
    })
    const json = await res.json()
    if (!json.ok) { setErrore(json.error ?? 'Errore salvataggio ingrediente'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl p-6 pb-8 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">

        <div className="flex justify-between items-center">
          <h2 className="font-bold text-caffe text-lg">Aggiungi ingrediente</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {/* Nome */}
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Nome *</label>
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="es. Filetto di orata"
            autoFocus
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Tipo</label>
          <div className="grid grid-cols-3 gap-1.5">
            {TIPI_PRODOTTO.map(t => (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium border transition-all ${
                  tipo === t.id ? 'bg-terra text-white border-terra' : 'bg-gray-50 text-gray-500 border-gray-100'
                }`}
              >
                <t.Icon size={15} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Unità + Quantità */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Unità *</label>
            <select
              value={um}
              onChange={e => setUm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            >
              {UNITA.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Quantità attuale *</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={quantita}
              onChange={e => setQuantita(e.target.value)}
              placeholder="0.0"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>

        {/* Stock minimo + Prezzo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Stock minimo</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={stockMin}
              onChange={e => setStockMin(e.target.value)}
              placeholder={`0 ${um}`}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Prezzo / {um} (€)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={prezzo}
              onChange={e => setPrezzo(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>

        {/* Scadenza (solo per freschi) */}
        {mostraScadenza && (
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Scadenza (opzionale)</label>
            <input
              type="date"
              value={scadenza}
              onChange={e => setScadenza(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
            />
          </div>
        )}

        {errore && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{errore}</p>}

        <button
          onClick={salva}
          disabled={saving || !nome.trim() || quantita === ''}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Salvataggio…' : '+ Aggiungi al magazzino'}
        </button>
      </div>
    </div>
  )
}

// ── Dettaglio ingrediente + storico ──────────────────────────

interface Movimento {
  id: string
  tipo_movimento: string
  quantita: number
  data_movimento: string
  motivo: string | null
}

const MOV_CFG: Record<string, { label: string; Icon: React.ElementType; color: string; sign: string }> = {
  carico:       { label: 'Carico',    Icon: ArrowDown,        color: 'text-emerald-600', sign: '+' },
  scarico:      { label: 'Utilizzo',  Icon: ArrowUp,          color: 'text-slate-500',   sign: '−' },
  spreco:       { label: 'Spreco',    Icon: Trash2,           color: 'text-rose-500',    sign: '−' },
  rettifica:    { label: 'Rettifica', Icon: Pencil,           color: 'text-indigo-500',  sign: '±' },
  trasferimento:{ label: 'Trasfert.', Icon: ArrowRightLeft,   color: 'text-amber-500',   sign: '↔' },
}

function DettaglioSheet({ scorta, onClose, onSaved }: { scorta: Scorta; onClose: () => void; onSaved: () => void }) {
  const ristoranteId = useRistorante()
  const [storico, setStorico]           = useState<Movimento[]>([])
  const [loadingStorico, setLoadingStorico] = useState(true)
  const [vista, setVista]               = useState<'storico' | 'forma' | 'modifica'>('storico')

  // form movimento
  const [tipoMov, setTipoMov]   = useState<TipoMov>('carico')
  const [quantita, setQuantita] = useState('')
  const [motivo, setMotivo]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  // form modifica
  const [editNome, setEditNome]           = useState(scorta.ingrediente?.nome ?? '')
  const [editTipo, setEditTipo]           = useState<TipoProdotto>('fresco_alta_rotazione')
  const [editStockMin, setEditStockMin]   = useState(String(scorta.stock_minimo || ''))
  const [editPrezzo, setEditPrezzo]       = useState('')
  const [editScadenza, setEditScadenza]   = useState(scorta.data_scadenza_prossima ?? '')
  const [loadingEdit, setLoadingEdit]     = useState(false)
  const [savingEdit, setSavingEdit]       = useState(false)
  const [erroreEdit, setErroreEdit]       = useState<string | null>(null)
  const [eliminando, setEliminando]       = useState(false)

  const nome = scorta.ingrediente?.nome ?? '—'
  const um   = scorta.ingrediente?.unita_misura ?? ''
  const tipoSel = TIPI_MOV.find(t => t.id === tipoMov)!

  useEffect(() => {
    supabase
      .from('movimenti_scorte')
      .select('id, tipo_movimento, quantita, data_movimento, motivo')
      .eq('ristorante_id', ristoranteId)
      .eq('ingrediente_id', scorta.ingrediente_id)
      .order('data_movimento', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setStorico((data as Movimento[]) ?? [])
        setLoadingStorico(false)
      })
  }, [scorta.ingrediente_id])

  useEffect(() => {
    if (vista !== 'modifica' || loadingEdit === false) return
    setLoadingEdit(true)
    Promise.all([
      supabase
        .from('ingredienti_ristorante')
        .select('prezzo_acquisto_corrente')
        .eq('ristorante_id', ristoranteId)
        .eq('ingrediente_id', scorta.ingrediente_id)
        .single(),
      supabase
        .from('ingredienti')
        .select('tipo_prodotto')
        .eq('id', scorta.ingrediente_id)
        .single(),
    ])
      .then(([ir, ing]) => {
        if (ir.data?.prezzo_acquisto_corrente != null)
          setEditPrezzo(String(ir.data.prezzo_acquisto_corrente))
        if (ing.data?.tipo_prodotto)
          setEditTipo(ing.data.tipo_prodotto as TipoProdotto)
        setLoadingEdit(false)
      })
  }, [vista, scorta.ingrediente_id, loadingEdit])

  function apriModifica() {
    setLoadingEdit(true)
    setVista('modifica')
  }

  async function salvaModifiche() {
    setSavingEdit(true)
    setErroreEdit(null)
    const stockMin = parseFloat(editStockMin.replace(',', '.'))
    const prezzo   = parseFloat(editPrezzo.replace(',', '.'))
    const tipoCfg  = TIPI_PRODOTTO.find(t => t.id === editTipo)!

    const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/ingredienti/${scorta.ingrediente_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: editNome.trim(),
        tipo_prodotto: editTipo,
        categoria: tipoCfg.categoria,
        stock_minimo: isNaN(stockMin) ? 0 : stockMin,
        prezzo_acquisto_corrente: isNaN(prezzo) ? null : prezzo,
        data_scadenza_prossima: editScadenza || null,
        vita_giorni_default: tipoCfg.vitaGg,
        frequenza_ordine_giorni_default: tipoCfg.freqGg,
        soglia_alert_giorni_default: tipoCfg.sogliaGg,
        lead_time_fornitore_giorni_default: tipoCfg.leadGg,
        tasso_spreco_percentuale_default: tipoCfg.spreco,
      }),
    })
    const json = await res.json()
    setSavingEdit(false)
    if (!json.ok) { setErroreEdit(json.error ?? 'Errore salvataggio modifiche'); return }
    onSaved()
  }

  async function eliminaIngrediente() {
    if (!confirm(`Rimuovere "${nome}" dal magazzino?`)) return
    setEliminando(true)
    await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/ingredienti/${scorta.ingrediente_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attivo: false }),
    })
    onSaved()
  }

  async function salva() {
    const qty = parseFloat(quantita.replace(',', '.'))
    if (!qty || qty <= 0) { setErrore('Inserisci una quantità valida'); return }
    setSaving(true)
    setErrore(null)
    const quantitaFinale = tipoSel.segno === -1 ? -Math.abs(qty) : Math.abs(qty)
    const res = await fetch(`${BACKEND_URL}/api/ristoranti/${ristoranteId}/ingredienti/${scorta.ingrediente_id}/movimenti`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_movimento: tipoMov,
        quantita: quantitaFinale,
        motivo: motivo || null,
      }),
    })
    const json = await res.json()
    if (!json.ok) { setErrore(json.error ?? 'Errore registrazione movimento'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl shadow-xl max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-start px-6 pt-5 pb-4 shrink-0 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-caffe text-lg leading-tight">{nome}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {scorta.quantita_disponibile.toFixed(2)} {um}
              {scorta.stock_minimo > 0 && (
                <span className="text-slate-300"> · min {scorta.stock_minimo} {um}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 px-6 py-3 shrink-0">
          <button
            onClick={() => setVista('storico')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              vista === 'storico' ? 'bg-terra text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <History size={12} />
            Storico
          </button>
          <button
            onClick={() => setVista('forma')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              vista === 'forma' ? 'bg-terra text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ClipboardList size={12} />
            Registra
          </button>
          <button
            onClick={apriModifica}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              vista === 'modifica' ? 'bg-terra text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Settings size={12} />
            Modifica
          </button>
        </div>

        {/* Storico */}
        {vista === 'storico' && (
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loadingStorico && (
              <div className="space-y-2 pt-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-12" />
                ))}
              </div>
            )}
            {!loadingStorico && storico.length === 0 && (
              <div className="text-center py-10">
                <History size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nessun movimento registrato</p>
              </div>
            )}
            <div className="space-y-1.5 pt-1">
              {storico.map(m => {
                const cfg = MOV_CFG[m.tipo_movimento] ?? MOV_CFG.carico
                const { Icon } = cfg
                const isPositivo = m.quantita > 0
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-caffe">{cfg.label}</p>
                      {m.motivo && <p className="text-xs text-slate-400 truncate">{m.motivo}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${isPositivo ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {isPositivo ? '+' : ''}{Number(m.quantita).toFixed(2)} {um}
                      </p>
                      <p className="text-[10px] text-slate-300">
                        {new Date(m.data_movimento).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setVista('forma')}
              className="mt-4 w-full bg-terra text-white font-semibold rounded-xl py-3 text-sm"
            >
              + Registra movimento
            </button>
          </div>
        )}

        {/* Modifica */}
        {vista === 'modifica' && (
          <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4 pt-1">
            {loadingEdit && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-12" />)}
              </div>
            )}
            {!loadingEdit && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Nome ingrediente</label>
                  <input
                    type="text"
                    value={editNome}
                    onChange={e => setEditNome(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Tipo stoccaggio</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIPI_PRODOTTO.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setEditTipo(t.id)}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-medium border transition-all ${
                          editTipo === t.id ? 'bg-terra text-white border-terra' : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}
                      >
                        <t.Icon size={15} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-maro mb-1.5">Stock minimo ({um})</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={editStockMin}
                      onChange={e => setEditStockMin(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-maro mb-1.5">Prezzo / {um} (€)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={editPrezzo}
                      onChange={e => setEditPrezzo(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Data scadenza prossima</label>
                  <input
                    type="date"
                    value={editScadenza}
                    onChange={e => setEditScadenza(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </div>

                {erroreEdit && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{erroreEdit}</p>}

                <button
                  onClick={salvaModifiche}
                  disabled={savingEdit || !editNome.trim()}
                  className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
                >
                  {savingEdit ? 'Salvataggio…' : 'Salva modifiche'}
                </button>

                <button
                  onClick={eliminaIngrediente}
                  disabled={eliminando}
                  className="w-full flex items-center justify-center gap-2 border border-rose-200 text-rose-500 font-semibold rounded-xl py-3 text-sm disabled:opacity-50 transition-opacity"
                >
                  <Trash2 size={15} />
                  {eliminando ? 'Rimozione…' : 'Rimuovi dal magazzino'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Form registra */}
        {vista === 'forma' && (
          <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4">
            <div className="grid grid-cols-4 gap-2 pt-1">
              {TIPI_MOV.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTipoMov(t.id)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                    tipoMov === t.id
                      ? 'bg-terra text-white border-terra'
                      : 'bg-slate-50 text-slate-500 border-slate-100'
                  }`}
                >
                  <t.Icon size={15} />
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-maro mb-1.5">Quantità ({um})</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={quantita}
                onChange={e => setQuantita(e.target.value)}
                placeholder="0.0"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-semibold text-caffe outline-none focus:border-terra text-center"
                autoFocus
              />
              {quantita && !isNaN(parseFloat(quantita)) && (
                <p className="text-xs text-center mt-1.5 text-slate-400">
                  Dopo:{' '}
                  <strong className={tipoSel.segno === 1 ? 'text-emerald-600' : 'text-rose-500'}>
                    {(scorta.quantita_disponibile + tipoSel.segno * Math.abs(parseFloat(quantita))).toFixed(2)} {um}
                  </strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-maro mb-1.5">Note (opzionale)</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="es. consegna Pescheria Anzio"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
              />
            </div>

            {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}

            <button
              onClick={salva}
              disabled={saving || !quantita}
              className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Salvataggio…' : `Registra ${tipoSel.label}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pagina Magazzino ─────────────────────────────────────────

interface MagazzinoProps {
  onNavigate?: (page: string) => void
}

export default function Magazzino({ onNavigate }: MagazzinoProps) {
  const ristoranteId = useRistorante()
  const [scorte, setScorte]     = useState<Scorta[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState<'tutti' | 'critici'>('tutti')
  const [cerca, setCerca]       = useState('')
  const [dettaglio, setDettaglio] = useState<Scorta | null>(null)
  const [aggiungi, setAggiungi] = useState(false)
  const oggi = useMemo(() => new Date(), [])

  const carica = useCallback(async () => {
    setLoading(true)
    const [{ data: s }, { data: ir }] = await Promise.all([
      supabase
        .from('scorte')
        .select('ingrediente_id, quantita_disponibile, data_scadenza_prossima, ingredienti(nome, unita_misura)')
        .eq('ristorante_id', ristoranteId),
      supabase
        .from('ingredienti_ristorante')
        .select('ingrediente_id, stock_minimo')
        .eq('ristorante_id', ristoranteId)
        .eq('attivo', true),
    ])

    const minMap = new Map<string, number>(
      ((ir as StockMin[]) ?? []).map(r => [r.ingrediente_id, r.stock_minimo ?? 0])
    )

    const merged: Scorta[] = ((s as ScortaRaw[]) ?? []).map(r => ({
      ...r,
      stock_minimo: minMap.get(r.ingrediente_id) ?? 0,
      ingrediente: Array.isArray(r.ingredienti) ? (r.ingredienti[0] ?? null) : r.ingredienti,
    }))

    merged.sort((a, b) => {
      const ord: Record<Stato, number> = { esaurito: 0, scadenza: 1, basso: 2, ok: 3 }
      return (
        ord[calcolaStato(a.quantita_disponibile, a.stock_minimo, ggScadenza(a.data_scadenza_prossima, oggi))] -
        ord[calcolaStato(b.quantita_disponibile, b.stock_minimo, ggScadenza(b.data_scadenza_prossima, oggi))]
      )
    })

    setScorte(merged)
    setLoading(false)
  }, [oggi, ristoranteId])

  useEffect(() => { carica() }, [carica])

  useEffect(() => {
    const onFocus = () => carica()
    window.addEventListener('focus', onFocus)
    const ch = supabase
      .channel(`magazzino-${ristoranteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scorte' }, carica)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimenti_scorte' }, carica)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredienti_ristorante' }, carica)
      .subscribe()
    return () => {
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(ch)
    }
  }, [carica, ristoranteId])

  const righe = useMemo(() =>
    scorte.filter(s => {
      const nome = s.ingrediente?.nome?.toLowerCase() ?? ''
      if (cerca && !nome.includes(cerca.toLowerCase())) return false
      if (filtro === 'critici') {
        const gg = ggScadenza(s.data_scadenza_prossima, oggi)
        return calcolaStato(s.quantita_disponibile, s.stock_minimo, gg) !== 'ok'
      }
      return true
    }),
    [scorte, filtro, cerca, oggi]
  )

  const critici = scorte.filter(s =>
    calcolaStato(s.quantita_disponibile, s.stock_minimo, ggScadenza(s.data_scadenza_prossima, oggi)) !== 'ok'
  ).length

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-caffe">Scorte</h1>
          <p className="text-sm text-maro mt-0.5">{scorte.length} ingredienti · {critici} critici</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAggiungi(true)}
            className="w-9 h-9 bg-terra text-white rounded-xl flex items-center justify-center active:scale-90 transition-transform"
            title="Aggiungi ingrediente"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={carica}
            className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
            title="Aggiorna"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Cerca ingrediente…"
          value={cerca}
          onChange={e => setCerca(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {(['tutti', 'critici'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtro === f ? 'bg-terra text-white' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {f === 'tutti' ? 'Tutti' : `Critici (${critici})`}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-slate-100 rounded-2xl h-16" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {righe.map(s => {
          const gg    = ggScadenza(s.data_scadenza_prossima, oggi)
          const stato = calcolaStato(s.quantita_disponibile, s.stock_minimo, gg)
          const cfg   = STATO_CFG[stato]
          const um    = s.ingrediente?.unita_misura ?? ''

          return (
            <button
              key={s.ingrediente_id}
              onClick={() => setDettaglio(s)}
              className="w-full bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex justify-between items-center text-left active:scale-[0.99] transition-transform"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="font-semibold text-caffe truncate">{s.ingrediente?.nome ?? '—'}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {s.quantita_disponibile.toFixed(2)} {um}
                  {s.stock_minimo > 0 && (
                    <span className="text-slate-300"> / min {s.stock_minimo} {um}</span>
                  )}
                </p>
                {gg !== null && gg <= 3 && (
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">
                    Scadenza: {gg <= 0 ? 'passata' : `tra ${gg} giorn${gg === 1 ? 'o' : 'i'}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
                  {cfg.label}
                </span>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </div>
            </button>
          )
        })}

        {!loading && righe.length === 0 && (
          cerca ? (
            <p className="text-center text-slate-400 py-16 font-medium">
              Nessun risultato per "{cerca}"
            </p>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <Package size={28} />
              </div>
              <p className="text-lg font-bold text-caffe">Magazzino vuoto</p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Le scorte arrivano dalle fatture oppure puoi aggiungere un prodotto a mano.
              </p>
              <button
                onClick={() => setAggiungi(true)}
                className="mt-5 w-full bg-terra text-white font-semibold rounded-xl py-3.5"
              >
                Aggiungi prodotto a mano
              </button>
            </div>
          )
        )}
      </div>

      {dettaglio && (
        <DettaglioSheet
          scorta={dettaglio}
          onClose={() => setDettaglio(null)}
          onSaved={() => { setDettaglio(null); carica() }}
        />
      )}

      {aggiungi && (
        <AggiungiIngredienteModal
          onClose={() => setAggiungi(false)}
          onSaved={() => { setAggiungi(false); carica() }}
        />
      )}
    </div>
  )
}
