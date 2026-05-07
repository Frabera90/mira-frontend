import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Bell, X, Download } from 'lucide-react'
import { supabase, RISTORANTE_ID as DEFAULT_RISTORANTE_ID } from './lib/supabase'
import { RistoranteContext } from './contexts/RistoranteContext'
import Login from './pages/Login'
import Casa from './pages/Casa'
import Magazzino from './pages/Magazzino'
import Ordini from './pages/Ordini'
import Fattura from './pages/Fattura'
import Notifiche from './pages/Notifiche'
import Prenotazioni from './pages/Prenotazioni'
import Fornitori from './pages/Fornitori'
import StoricoOrdini from './pages/StoricoOrdini'
import Impostazioni from './pages/Impostazioni'
import FoodCost from './pages/FoodCost'
import Onboarding from './pages/Onboarding'
import BottomNav from './components/BottomNav'
import { registerSW, subscribePush, isPushSupported } from './hooks/usePush'
import Assistente from './pages/Assistente'
import GuideModal from './components/GuideModal'

export type Page = 'casa' | 'magazzino' | 'ordini' | 'fattura' | 'notifiche' | 'assistente' | 'prenotazioni' | 'fornitori' | 'storico-ordini' | 'impostazioni' | 'food-cost'

export default function App() {
  const [session, setSession]       = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [page, setPage]             = useState<Page>('casa')
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('mira_onboarding_done') === 'true'
  )
  const [badgeNotifiche, setBadgeNotifiche] = useState(0)
  const [pushBanner, setPushBanner] = useState(false)
  const [installBanner, setInstallBanner] = useState(false)
  const installPromptRef = useRef<any>(null)
  const [ristoranteId, setRistoranteId] = useState<string>(
    () => localStorage.getItem('mira_ristorante_id') ?? DEFAULT_RISTORANTE_ID
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Resolve ristorante for logged-in user
  useEffect(() => {
    const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'
    if (skipAuth || !session) return
    supabase
      .from('ristoranti')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          setRistoranteId(data.id)
          localStorage.setItem('mira_ristorante_id', data.id)
        }
      })
  }, [session])

  useEffect(() => {
    registerSW().then(reg => {
      if (!reg || !isPushSupported()) return
      if (Notification.permission === 'default') {
        setPushBanner(true)
      }
    })
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      installPromptRef.current = e
      const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches
      if (!alreadyInstalled) setInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function installaApp() {
    if (!installPromptRef.current) return
    installPromptRef.current.prompt()
    const { outcome } = await installPromptRef.current.userChoice
    if (outcome === 'accepted') setInstallBanner(false)
    installPromptRef.current = null
  }

  const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'

  if (!skipAuth && authLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 rounded-2xl bg-terra flex items-center justify-center">
          <span className="text-white font-bold text-xl">M</span>
        </div>
      </div>
    )
  }

  if (!skipAuth && !session) return <Login />

  if (!onboardingDone) {
    return (
      <RistoranteContext.Provider value={ristoranteId}>
        <Onboarding
          onComplete={(id?: string) => {
            if (id) {
              setRistoranteId(id)
              localStorage.setItem('mira_ristorante_id', id)
            }
            localStorage.setItem('mira_onboarding_done', 'true')
            setOnboardingDone(true)
          }}
        />
      </RistoranteContext.Provider>
    )
  }

  async function abilitaNotifiche() {
    setPushBanner(false)
    await subscribePush(ristoranteId)
  }

  function navigate(p: string) {
    setPage(p as Page)
  }

  const navPages: Page[] = ['casa', 'magazzino', 'assistente', 'ordini', 'notifiche']

  return (
    <RistoranteContext.Provider value={ristoranteId}>
      <div className={`max-w-[480px] mx-auto min-h-screen bg-cream relative ${navPages.includes(page) ? 'pb-[72px]' : ''}`}>
        {installBanner && (
          <div className="fixed top-0 left-0 right-0 z-50 max-w-[480px] mx-auto bg-terra text-white px-4 py-3 flex items-center gap-3">
            <Download size={16} className="shrink-0" />
            <p className="text-sm font-medium flex-1">Aggiungi MIRA alla schermata home</p>
            <div className="flex gap-2 shrink-0 items-center">
              <button
                onClick={installaApp}
                className="bg-white text-terra text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                Installa
              </button>
              <button onClick={() => setInstallBanner(false)} className="text-white/70 p-0.5">
                <X size={16} />
              </button>
            </div>
          </div>
        )}
        {pushBanner && !installBanner && (
          <div className="fixed top-0 left-0 right-0 z-40 max-w-[480px] mx-auto bg-slate-900 text-white px-4 py-3 flex items-center gap-3">
            <Bell size={16} className="shrink-0 text-terra" />
            <p className="text-sm font-medium flex-1">Abilita le notifiche per gli alert di MIRA</p>
            <div className="flex gap-2 shrink-0 items-center">
              <button
                onClick={abilitaNotifiche}
                className="bg-terra text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                Abilita
              </button>
              <button onClick={() => setPushBanner(false)} className="text-slate-400 p-0.5">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className={installBanner || pushBanner ? 'pt-[52px]' : ''}>
          {page === 'casa'           && <Casa onNavigate={navigate} />}
          {page === 'magazzino'      && <Magazzino onNavigate={navigate} />}
          {page === 'ordini'         && <Ordini onNavigate={navigate} />}
          {page === 'fattura'        && <Fattura onBack={() => setPage('magazzino')} />}
          {page === 'assistente'     && <Assistente onClose={() => setPage('casa')} />}
          {page === 'prenotazioni'   && <Prenotazioni onBack={() => setPage('casa')} />}
          {page === 'fornitori'      && <Fornitori onBack={() => setPage('ordini')} />}
          {page === 'storico-ordini' && <StoricoOrdini onBack={() => setPage('ordini')} />}
          {page === 'impostazioni'   && <Impostazioni onBack={() => setPage('casa')} />}
          {page === 'food-cost'      && <FoodCost onBack={() => setPage('ordini')} />}
          <div className={page === 'notifiche' ? '' : 'hidden'}>
            <Notifiche onNotificheChange={setBadgeNotifiche} />
          </div>
        </div>

        {navPages.includes(page) && (
          <BottomNav active={page} onChange={setPage} badge={badgeNotifiche} />
        )}

        <GuideModal ristoranteId={ristoranteId} onNavigate={navigate} />
      </div>
    </RistoranteContext.Provider>
  )
}
