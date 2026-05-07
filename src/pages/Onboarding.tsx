import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Props {
  onComplete: (ristoranteId?: string) => void
}

export default function Onboarding({ onComplete }: Props) {
  const defaultRistoranteId = useRistorante()
  const [nomeChef, setNomeChef] = useState('')
  const [nomeRist, setNomeRist] = useState('')
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  async function salva() {
    setSaving(true)
    setErrore(null)
    localStorage.setItem('mira_chef_name', nomeChef.trim() || 'Chef')

    const { data: { user } } = await supabase.auth.getUser()
    let ristoranteId: string | undefined

    if (user) {
      const { data: esistente } = await supabase
        .from('ristoranti')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (esistente) {
        ristoranteId = esistente.id
        if (nomeRist.trim()) {
          await supabase.from('ristoranti').update({ nome: nomeRist.trim() }).eq('id', ristoranteId)
        }
      } else {
        const { data: nuovo, error } = await supabase
          .from('ristoranti')
          .insert({
            nome:              nomeRist.trim() || 'Il mio ristorante',
            auth_user_id:      user.id,
            ora_briefing:      '07:30',
            ora_report_serale: '22:00',
          })
          .select('id')
          .single()
        if (error) { setErrore(error.message); setSaving(false); return }
        ristoranteId = nuovo.id
      }
    } else {
      if (nomeRist.trim()) {
        const { error } = await supabase.from('ristoranti').update({ nome: nomeRist.trim() }).eq('id', defaultRistoranteId)
        if (error) { setErrore('Errore nel salvataggio. Riprova.'); setSaving(false); return }
      }
    }

    setSaving(false)
    onComplete(ristoranteId)
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="w-14 h-14 rounded-2xl bg-terra flex items-center justify-center mb-8 shadow-lg shadow-terra/20">
        <span className="text-white font-bold text-2xl">M</span>
      </div>

      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-caffe">Benvenuto in MIRA</h1>
          <p className="text-maro mt-2 leading-relaxed">
            Il tuo assistente AI per la gestione del ristorante. Ci vogliono 30 secondi.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Come ti chiami, Chef?</label>
            <input
              type="text"
              value={nomeChef}
              onChange={e => setNomeChef(e.target.value)}
              placeholder="es. Marco"
              autoFocus
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Nome del ristorante</label>
            <input
              type="text"
              value={nomeRist}
              onChange={e => setNomeRist(e.target.value)}
              placeholder="es. Osteria del Borgo"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
            />
          </div>
        </div>

        {errore && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">{errore}</div>
        )}

        <button
          onClick={salva}
          disabled={saving || !nomeChef.trim()}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-terra/20"
        >
          {saving ? 'Un momento…' : <>Entra in MIRA <ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  )
}
