import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Bell, TrendingUp, Package, Clock, ShoppingCart, CheckCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRistorante } from '../contexts/RistoranteContext'

interface Notifica {
  id: string
  tipo: string
  priorita: 'alta' | 'media' | 'bassa'
  titolo: string
  messaggio: string
  letta: boolean
  creato_at: string
}

interface Props {
  onNotificheChange: (count: number) => void
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
}

const PRIORITA_CFG = {
  alta:  { badge: 'bg-rose-100 text-rose-700',   dot: 'bg-rose-500' },
  media: { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  bassa: { badge: 'bg-slate-100 text-slate-500',  dot: 'bg-slate-400' },
}

function TipoIcon({ tipo }: { tipo: string }) {
  const cls = 'text-slate-400'
  const size = 16
  switch (tipo) {
    case 'alert_prezzo':       return <TrendingUp   size={size} className={cls} />
    case 'alert_scorta':       return <Package      size={size} className={cls} />
    case 'alert_scadenza':     return <Clock        size={size} className={cls} />
    case 'suggerimento_piatto':return <ShoppingCart size={size} className={cls} />
    case 'briefing_mattutino': return <Bell         size={size} className={cls} />
    case 'report_serale':      return <Bell         size={size} className={cls} />
    default:                   return <Bell         size={size} className={cls} />
  }
}

export default function Notifiche({ onNotificheChange }: Props) {
  const ristoranteId = useRistorante()
  const [notifiche, setNotifiche]     = useState<Notifica[]>([])
  const [loading, setLoading]         = useState(true)
  const [soloNonLette, setSoloNonLette] = useState(false)
  const [tick, setTick]               = useState(0)

  const carica = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    setLoading(true)
    const q = supabase
      .from('notifiche')
      .select('id, tipo, priorita, titolo, messaggio, letta, creato_at')
      .eq('ristorante_id', ristoranteId)
      .order('creato_at', { ascending: false })
      .limit(60)

    const query = soloNonLette ? q.eq('letta', false) : q

    query.then(({ data, error }) => {
      if (!error) {
        const rows = (data as Notifica[]) ?? []
        setNotifiche(rows)
        onNotificheChange(rows.filter(n => !n.letta).length)
      }
      setLoading(false)
    })
  }, [soloNonLette, onNotificheChange, tick])

  async function segnaLetta(id: string) {
    await supabase.from('notifiche').update({ letta: true }).eq('id', id)
    setNotifiche(prev => {
      const aggiornate = prev.map(n => n.id === id ? { ...n, letta: true } : n)
      onNotificheChange(aggiornate.filter(n => !n.letta).length)
      return aggiornate
    })
  }

  async function segnaLetteTutte() {
    const ids = notifiche.filter(n => !n.letta).map(n => n.id)
    if (ids.length === 0) return
    await supabase.from('notifiche').update({ letta: true }).in('id', ids)
    setNotifiche(prev => prev.map(n => ({ ...n, letta: true })))
    onNotificheChange(0)
  }

  const nonLette = notifiche.filter(n => !n.letta).length

  return (
    <div className="p-4">
      <div className="flex justify-between items-center pt-2 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-caffe">Avvisi</h1>
          {!loading && (
            <p className="text-sm text-maro mt-0.5">
              {nonLette > 0 ? `${nonLette} non letti` : 'Tutto letto'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {nonLette > 0 && (
            <button
              onClick={segnaLetteTutte}
              className="flex items-center gap-1.5 text-xs text-terra border border-terra/30 px-3 py-1.5 rounded-full font-medium"
            >
              <CheckCheck size={13} />
              Segna tutte
            </button>
          )}
          <button
            onClick={carica}
            className="p-2 rounded-xl text-maro hover:bg-slate-100 active:scale-90 transition-all"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {([false, true] as const).map(v => (
          <button
            key={String(v)}
            onClick={() => setSoloNonLette(v)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              soloNonLette === v
                ? 'bg-terra text-white'
                : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {v ? 'Non letti' : 'Tutti'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      <div className="space-y-2">
        {notifiche.map(n => {
          const cfg = PRIORITA_CFG[n.priorita] ?? PRIORITA_CFG.bassa
          return (
            <div
              key={n.id}
              onClick={() => !n.letta && segnaLetta(n.id)}
              className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-sm transition-all cursor-pointer ${
                n.letta ? 'opacity-50' : 'active:scale-[0.99]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <TipoIcon tipo={n.tipo} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className={`font-semibold text-sm leading-snug ${n.letta ? 'text-slate-400' : 'text-caffe'}`}>
                      {n.titolo}
                      {!n.letta && (
                        <span className={`inline-block w-1.5 h-1.5 ${cfg.dot} rounded-full ml-1.5 mb-0.5 align-middle`} />
                      )}
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}>
                      {n.priorita}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.messaggio}</p>
                  <p className="text-[10px] text-slate-300 mt-1.5">
                    {new Date(n.creato_at).toLocaleString('it-IT', {
                      day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          )
        })}

        {!loading && notifiche.length === 0 && (
          <div className="text-center py-16">
            <Bell size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">
              {soloNonLette ? 'Nessun avviso non letto' : 'Nessun avviso'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
