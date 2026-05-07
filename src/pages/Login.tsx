import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Modo = 'login' | 'signup' | 'reset'

export default function Login() {
  const [modo, setModo]           = useState<Modo>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [errore, setErrore]       = useState<string | null>(null)
  const [successo, setSuccesso]   = useState<string | null>(null)

  async function accedi(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErrore(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErrore(error.message === 'Invalid login credentials'
      ? 'Email o password errati'
      : error.message)
    setLoading(false)
  }

  async function registrati(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setErrore('La password deve avere almeno 6 caratteri'); return }
    setLoading(true); setErrore(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setErrore(error.message === 'User already registered'
        ? 'Email già registrata — accedi oppure reimposta la password'
        : error.message)
    } else {
      setSuccesso('Controlla la tua email per confermare l\'account, poi accedi.')
      setModo('login')
    }
    setLoading(false)
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErrore(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) setErrore(error.message)
    else setSuccesso('Email inviata! Controlla la casella e segui il link.')
    setLoading(false)
  }

  function cambia(m: Modo) { setModo(m); setErrore(null); setSuccesso(null) }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-terra rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
          <span className="text-white font-bold text-3xl tracking-tight">M</span>
        </div>
        <h1 className="text-2xl font-bold text-caffe tracking-tight">MIRA</h1>
        <p className="text-maro text-sm mt-1">Gestione magazzino AI per ristoranti</p>
      </div>

      {modo !== 'reset' && (
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6 w-full max-w-sm">
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => cambia(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                modo === m ? 'bg-white text-caffe shadow-sm' : 'text-slate-400'
              }`}
            >
              {m === 'login' ? 'Accedi' : 'Crea account'}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={modo === 'login' ? accedi : modo === 'signup' ? registrati : resetPassword}
        className="w-full max-w-sm space-y-4"
      >
        {modo === 'reset' && (
          <div className="text-center mb-2">
            <p className="font-semibold text-caffe">Reimposta password</p>
            <p className="text-xs text-maro mt-1">Inserisci la tua email e ti mandiamo il link.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-maro mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="chef@osteria.it"
            required
            autoComplete="email"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
          />
        </div>

        {modo !== 'reset' && (
          <div>
            <label className="block text-xs font-semibold text-maro mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={modo === 'signup' ? 'min. 6 caratteri' : '••••••••'}
              required
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-terra focus:ring-2 focus:ring-terra/10 transition-all"
            />
          </div>
        )}

        {errore && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
            {errore}
          </div>
        )}
        {successo && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
            {successo}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || (modo !== 'reset' && !password)}
          className="w-full bg-terra text-white font-semibold rounded-xl py-3.5 text-sm transition-all disabled:opacity-50 active:scale-[0.99] shadow-lg shadow-terra/20"
        >
          {loading
            ? 'Attendere…'
            : modo === 'login'
            ? 'Accedi'
            : modo === 'signup'
            ? 'Crea account'
            : 'Invia email di reset'}
        </button>
      </form>

      <div className="mt-5 text-center space-y-2">
        {modo === 'login' && (
          <button onClick={() => cambia('reset')} className="text-xs text-slate-400 underline">
            Password dimenticata?
          </button>
        )}
        {modo === 'reset' && (
          <button onClick={() => cambia('login')} className="text-xs text-slate-400 underline">
            Torna al login
          </button>
        )}
      </div>
    </div>
  )
}
