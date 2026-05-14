import { useEffect, useState } from 'react'
import { ArrowLeft, Save, LogOut, Send, RotateCcw, Smartphone, Share, CreditCard, Trash2, AlertTriangle, X } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'
import { DEFAULT_DAYS, encodeOperativita, parseOperativita, promptTime, type Operativita } from '../lib/operativita'

interface RistoranteData {
  nome: string
  indirizzo: string | null
  citta: string | null
  email_contatto: string | null
  telefono: string | null
  coperti_medi: number | null
  ora_briefing: string | null
  ora_report_serale: string | null
  giorni_apertura: number[] | null
  telegram_chat_id: string | null
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

interface DeleteConfig {
  title: string
  descrizione: string
  cascata: string[]
  ctaLabel: string
  onConfirm: () => Promise<void>
}

function ConfirmDeleteSheet({ cfg, onClose }: { cfg: DeleteConfig; onClose: () => void }) {
  const [step, setStep] = useState<'warn' | 'confirm'>('warn')
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function esegui() {
    setLoading(true)
    setErrore(null)
    try {
      await cfg.onConfirm()
      onClose()
    } catch (e: any) {
      setErrore(e.message ?? 'Errore durante la cancellazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[480px] rounded-t-3xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="shrink-0 flex justify-between items-center px-6 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <AlertTriangle size={15} className="text-rose-600" />
            </div>
            <h2 className="font-bold text-caffe text-base">{cfg.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{cfg.descrizione}</p>

          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Effetti a cascata</p>
            {cfg.cascata.map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-rose-400 mt-0.5 shrink-0">•</span>
                <p className="text-xs text-rose-700 leading-relaxed">{c}</p>
              </div>
            ))}
          </div>

          {step === 'confirm' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800">Sei davvero sicuro?</p>
              <p className="text-xs text-amber-700 mt-1">Questa azione è irreversibile. Tutti i dati elencati verranno eliminati definitivamente.</p>
            </div>
          )}

          {errore && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{errore}</p>}
        </div>

        <div className="shrink-0 px-6 pb-8 pt-4 space-y-3">
          {step === 'warn' ? (
            <>
              <button
                onClick={() => setStep('confirm')}
                className="w-full bg-rose-500 text-white font-semibold rounded-xl py-3.5"
              >
                Continua — ho capito le conseguenze
              </button>
              <button
                onClick={onClose}
                className="w-full border border-slate-200 text-slate-500 font-medium rounded-xl py-3 text-sm"
              >
                Annulla
              </button>
            </>
          ) : (
            <>
              <button
                onClick={esegui}
                disabled={loading}
                className="w-full bg-rose-600 text-white font-bold rounded-xl py-3.5 disabled:opacity-50"
              >
                {loading ? 'Eliminazione…' : cfg.ctaLabel}
              </button>
              <button
                onClick={() => setStep('warn')}
                disabled={loading}
                className="w-full border border-slate-200 text-slate-500 font-medium rounded-xl py-3 text-sm disabled:opacity-50"
              >
                Torna indietro
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ServizioBox({
  title, active, dalle, alle, onActive, onDalle, onAlle,
}: {
  title: string
  active: boolean
  dalle: string
  alle: string
  onActive: (value: boolean) => void
  onDalle: (value: string) => void
  onAlle: (value: string) => void
}) {
  return (
    <div className={`rounded-xl border p-3 ${active ? 'border-terra/25 bg-terra/5' : 'border-slate-100 bg-slate-50'}`}>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-caffe">{title}</span>
          <span className="block text-[11px] text-slate-400 mt-0.5">
            {active ? `Mira chiede i coperti alle ${promptTime(dalle)}` : 'Nessun messaggio automatico'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={active}
          onChange={e => onActive(e.target.checked)}
          className="w-5 h-5 accent-terra"
        />
      </label>

      {active && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-[11px] font-semibold text-maro mb-1">Dalle</label>
            <input
              type="time"
              value={dalle}
              onChange={e => onDalle(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-maro mb-1">Alle</label>
            <input
              type="time"
              value={alle}
              onChange={e => onAlle(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-terra"
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  onBack: () => void
  onNavigate?: (page: string) => void
}

export default function Impostazioni({ onBack, onNavigate }: Props) {
  const ristoranteId = useRistorante()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  const [nomeChef, setNomeChef] = useState(() => localStorage.getItem('mira_chef_name') ?? '')
  const [botLink, setBotLink] = useState<string | null>(null)
  const [deleteCfg, setDeleteCfg] = useState<DeleteConfig | null>(null)

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/telegram/bot-username`)
      .then(r => r.json())
      .then(j => j.username && setBotLink(`https://t.me/${j.username}?start=${ristoranteId}`))
      .catch(() => {})
  }, [])
  const [rist, setRist]         = useState<RistoranteData>({
    nome: '', indirizzo: null, citta: null,
    email_contatto: null, telefono: null,
    coperti_medi: null, ora_briefing: null, ora_report_serale: null,
    giorni_apertura: DEFAULT_DAYS,
    telegram_chat_id: null,
  })
  const [operativita, setOperativita] = useState<Operativita>(() => parseOperativita(DEFAULT_DAYS))

  useEffect(() => {
    supabase
      .from('ristoranti')
      .select('nome, indirizzo, citta, email_contatto, telefono, coperti_medi, ora_briefing, ora_report_serale, giorni_apertura, telegram_chat_id')
      .eq('id', ristoranteId)
      .single()
      .then(({ data }) => {
        if (data) {
          setRist(data as RistoranteData)
          setOperativita(parseOperativita(data.giorni_apertura))
        }
        setLoading(false)
      })
  }, [])

  function field(key: keyof RistoranteData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setRist(prev => ({ ...prev, [key]: e.target.value || null }))
  }

  async function salva() {
    setSaving(true); setSaved(false); setErrore(null)
    localStorage.setItem('mira_chef_name', nomeChef.trim())
    const { error } = await supabase
      .from('ristoranti')
      .update({
        nome:              rist.nome.trim() || 'Ristorante',
        indirizzo:         rist.indirizzo,
        citta:             rist.citta,
        email_contatto:    rist.email_contatto,
        telefono:          rist.telefono,
        coperti_medi:      rist.coperti_medi ? Number(rist.coperti_medi) : null,
        ora_briefing:      rist.ora_briefing,
        ora_report_serale: rist.ora_report_serale,
        giorni_apertura:   encodeOperativita(operativita),
        telegram_chat_id:  rist.telegram_chat_id?.trim() || null,
      })
      .eq('id', ristoranteId)
    setSaving(false)
    if (error) { setErrore(error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function esci() {
    if (!confirm('Sei sicuro di voler uscire?')) return
    await supabase.auth.signOut()
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-6">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 -ml-1">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold text-caffe">Impostazioni</h1>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : (
        <div className="space-y-5">

          {/* Profilo chef */}
          <section>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Profilo</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Il tuo nome</label>
                <input
                  type="text"
                  value={nomeChef}
                  onChange={e => setNomeChef(e.target.value)}
                  placeholder="es. Marco"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10"
                />
              </div>
            </div>
          </section>

          {/* Ristorante */}
          <section>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Ristorante</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Nome ristorante</label>
                <input
                  type="text"
                  value={rist.nome}
                  onChange={e => setRist(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Città</label>
                  <input
                    type="text"
                    value={rist.citta ?? ''}
                    onChange={field('citta')}
                    placeholder="Roma"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Coperti</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={rist.coperti_medi ?? ''}
                    onChange={field('coperti_medi')}
                    placeholder="50"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Indirizzo</label>
                <input
                  type="text"
                  value={rist.indirizzo ?? ''}
                  onChange={field('indirizzo')}
                  placeholder="Via Roma 1"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Email</label>
                  <input
                    type="email"
                    value={rist.email_contatto ?? ''}
                    onChange={field('email_contatto')}
                    placeholder="info@ristorante.it"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-maro mb-1.5">Telefono</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={rist.telefono ?? ''}
                    onChange={field('telefono')}
                    placeholder="06 000 0000"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Installa app */}
          <section>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">App</p>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-terra/10 flex items-center justify-center shrink-0">
                  <Smartphone size={16} className="text-terra" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-caffe">Aggiungi alla schermata Home</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Su <span className="font-semibold text-caffe">iPhone/iPad (Safari)</span>: tocca{' '}
                    <span className="inline-flex items-center gap-0.5 font-semibold text-caffe">
                      <Share size={11} /> Condividi
                    </span>{' '}
                    poi <span className="font-semibold text-caffe">«Aggiungi a Home»</span>
                    <br/>
                    Su <span className="font-semibold text-caffe">Android (Chrome)</span>: appare in automatico il banner «Installa» in cima alla pagina
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Telegram */}
          <section>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Telegram</p>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#229ED9]/10 flex items-center justify-center shrink-0">
                  <Send size={16} className="text-[#229ED9]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-caffe">Collega il bot MIRA</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    1. Apri Telegram e cerca il bot <span className="font-semibold text-caffe">@{import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'il tuo bot MIRA'}</span><br/>
                    2. Scrivi qualsiasi messaggio — il bot risponde con il tuo Chat ID<br/>
                    3. Incolla il Chat ID qui sotto e salva
                  </p>
                </div>
              </div>
              {botLink && (
                <a
                  href={botLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#229ED9] text-white text-sm font-semibold rounded-xl py-2.5 w-full"
                >
                  <Send size={14} />
                  Collega automaticamente via Telegram
                </a>
              )}
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Telegram Chat ID</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={rist.telegram_chat_id ?? ''}
                  onChange={e => setRist(prev => ({ ...prev, telegram_chat_id: e.target.value || null }))}
                  placeholder="es. 6666456360"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 font-mono"
                />
              </div>
            </div>
          </section>

          {/* Operatività */}
          <section>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Operatività</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Ora briefing</label>
                <input
                  type="time"
                  value={rist.ora_briefing?.slice(0, 5) ?? '07:30'}
                  onChange={field('ora_briefing')}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-maro mb-1.5">Ora report serale</label>
                <input
                  type="time"
                  value={rist.ora_report_serale?.slice(0, 5) ?? '22:00'}
                  onChange={field('ora_report_serale')}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-terra"
                />
              </div>
            </div>
          </section>

          {/* Integrazioni */}
          <section>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Integrazioni</p>
            <button
              onClick={() => onNavigate?.('collega-cassa')}
              className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-terra/10 flex items-center justify-center shrink-0">
                <CreditCard size={16} className="text-terra" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-caffe">Collega Cassa</p>
                <p className="text-xs text-slate-400 mt-0.5">Webhook e importazione CSV per qualsiasi POS</p>
              </div>
              <ArrowLeft size={16} className="text-slate-300 rotate-180 shrink-0" />
            </button>
          </section>

          {errore && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
              {errore}
            </div>
          )}

          <button
            onClick={salva}
            disabled={saving}
            className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
          >
            {saved ? (
              <><Save size={16} /> Salvato!</>
            ) : saving ? (
              'Salvataggio…'
            ) : (
              <><Save size={16} /> Salva impostazioni</>
            )}
          </button>

          {/* Dati */}
          <section>
            <p className="text-xs font-semibold text-maro uppercase tracking-wide mb-3">Gestione dati</p>
            <div className="space-y-2">
              {[
                {
                  label: 'Cancella tutto il menu',
                  sub: 'Piatti, ricette e food cost',
                  cfg: {
                    title: 'Cancella il menu',
                    descrizione: 'Verranno eliminati tutti i piatti, le bevande e le ricette che hai caricato.',
                    cascata: [
                      'Il food cost tornerà a zero per tutti i piatti',
                      'Le ricette e gli abbinamenti verranno persi',
                      'Dovrai ricaricare il menu e rieseguire l\'abbinamento',
                    ],
                    ctaLabel: 'Sì, cancella tutto il menu',
                    onConfirm: async () => {
                      const { error } = await supabase.from('piatti').delete().eq('ristorante_id', ristoranteId)
                      if (error) throw new Error(error.message)
                    },
                  } as DeleteConfig,
                },
                {
                  label: 'Cancella tutte le fatture',
                  sub: 'Fatture, prezzi ingredienti e scorte',
                  cfg: {
                    title: 'Cancella le fatture',
                    descrizione: 'Verranno eliminate tutte le fatture caricate con i relativi dati di spesa.',
                    cascata: [
                      'I prezzi di tutti gli ingredienti verranno azzerati',
                      'Le scorte in magazzino verranno azzerate',
                      'Il food cost non sarà più calcolabile senza nuove fatture',
                      'La spesa per fornitore andrà a zero',
                    ],
                    ctaLabel: 'Sì, cancella tutte le fatture',
                    onConfirm: async () => {
                      const { error: ef } = await supabase.from('fatture').delete().eq('ristorante_id', ristoranteId)
                      if (ef) throw new Error(ef.message)
                      await supabase.from('scorte').delete().eq('ristorante_id', ristoranteId)
                      await supabase.from('ingredienti_ristorante').update({ prezzo_acquisto_corrente: null }).eq('ristorante_id', ristoranteId)
                    },
                  } as DeleteConfig,
                },
                {
                  label: 'Cancella tutti i fornitori',
                  sub: 'Anagrafica fornitori',
                  cfg: {
                    title: 'Cancella i fornitori',
                    descrizione: 'Verranno eliminati tutti i fornitori e le relative assegnazioni agli ingredienti.',
                    cascata: [
                      'Le fatture associate ai fornitori rimarranno ma senza collegamento al fornitore',
                      'Dovrai riassegnare gli ingredienti ai nuovi fornitori',
                    ],
                    ctaLabel: 'Sì, cancella tutti i fornitori',
                    onConfirm: async () => {
                      const { error } = await supabase.from('fornitori').delete().eq('ristorante_id', ristoranteId)
                      if (error) throw new Error(error.message)
                    },
                  } as DeleteConfig,
                },
              ].map(({ label, sub, cfg }) => (
                <button
                  key={label}
                  onClick={() => setDeleteCfg(cfg)}
                  className="w-full bg-white border border-rose-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-rose-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                    <Trash2 size={15} className="text-rose-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-rose-700">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={() => {
              localStorage.setItem('mira_onboarding_done', 'false')
              localStorage.removeItem('mira_chef_name')
              localStorage.removeItem('mira_ristorante_id')
              window.location.reload()
            }}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-400 font-medium rounded-xl py-3 text-sm"
          >
            <RotateCcw size={15} />
            Ripeti onboarding
          </button>

          <button
            onClick={esci}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-500 font-medium rounded-xl py-3 text-sm"
          >
            <LogOut size={15} />
            Esci dall'account
          </button>
        </div>
      )}

      {deleteCfg && <ConfirmDeleteSheet cfg={deleteCfg} onClose={() => setDeleteCfg(null)} />}
    </div>
  )
}
