import { useEffect, useState } from 'react'
import { ArrowLeft, Save, LogOut, Send, RotateCcw, Smartphone, Share, CreditCard } from 'lucide-react'
import { supabase, BACKEND_URL } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface RistoranteData {
  nome: string
  indirizzo: string | null
  citta: string | null
  email_contatto: string | null
  telefono: string | null
  coperti_medi: number | null
  ora_briefing: string | null
  ora_report_serale: string | null
  telegram_chat_id: string | null
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
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
    telegram_chat_id: null,
  })

  useEffect(() => {
    supabase
      .from('ristoranti')
      .select('nome, indirizzo, citta, email_contatto, telefono, coperti_medi, ora_briefing, ora_report_serale, telegram_chat_id')
      .eq('id', ristoranteId)
      .single()
      .then(({ data }) => {
        if (data) setRist(data as RistoranteData)
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
    </div>
  )
}
