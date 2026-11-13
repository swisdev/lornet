'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, LoaderCircle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LornetBrand } from '@/components/lornet-brand'

function getAuthMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('invalid login credentials') || message.includes('user not found')) return 'That email and password combination did not match.'
  if (message.includes('email not confirmed')) return 'Please confirm your email using the link we sent you.'
  if (message.includes('password') && (message.includes('weak') || message.includes('least'))) return 'Choose a stronger password and try again.'
  if (message.includes('rate limit') || message.includes('too many requests')) return 'Too many attempts. Please wait a moment and try again.'
  return 'We could not complete that request. Please try again.'
}

export function AuthPage({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const router = useRouter()
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null
    try { return createClient() } catch { return null }
  }, [])
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const routeUser = async () => {
      if (!supabase) { setReady(true); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (user) {
        const { data: isAdmin } = await supabase.rpc('lornet_is_admin')
        if (active) router.replace(isAdmin ? '/admin' : '/')
      } else setReady(true)
    }
    void routeUser()
    const { data: listener } = supabase?.auth.onAuthStateChange(() => { void routeUser() }) || { data: { subscription: { unsubscribe() {} } } }
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [router, supabase])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!supabase) { setError('Sign-in is unavailable right now. Please check the Supabase connection.'); return }
    setBusy(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (mode === 'signup') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback` },
        })
        if (signupError) throw signupError
        if (!data.session) {
          setNotice('Check your email for a confirmation link, then sign in here.')
          setMode('signin')
          setPassword('')
          return
        }
        const { data: { user } } = await supabase.auth.getUser()
        const { data: isAdmin } = await supabase.rpc('lornet_is_admin')
        router.replace(user && isAdmin ? '/admin' : '/')
        return
      }

      const { error: signinError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (signinError) throw signinError
      const { data: { user } } = await supabase.auth.getUser()
      const { data: isAdmin } = await supabase.rpc('lornet_is_admin')
      router.replace(user && isAdmin ? '/admin' : '/')
    } catch (cause) {
      setError(getAuthMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <main className="flex min-h-screen items-center justify-center bg-[#f9f9f8]"><LoaderCircle className="animate-spin text-emerald-700" size={22}/><span className="sr-only">Checking your account</span></main>

  return (
    <main className="min-h-screen bg-[#f9f9f8] px-5 py-8 text-[#16201a]">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Lornet home"><LornetBrand /></Link>
        <Link href="/" className="inline-flex items-center gap-2 text-[12px] text-[#778078] transition hover:text-[#17211a]"><ArrowLeft size={14}/> Back to network</Link>
      </header>
      <div className="mx-auto grid max-w-[980px] items-center gap-14 py-12 md:min-h-[calc(100vh-100px)] md:grid-cols-[1fr_400px] md:py-0">
        <section className="hidden md:block">
          <span className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700"><ShieldCheck size={22}/></span>
          <p className="text-[11px] font-bold uppercase tracking-[.22em] text-emerald-700">One connected network</p>
          <h1 className="mt-3 max-w-[430px] text-[46px] font-semibold leading-[1.08] tracking-[-.055em]">Good things grow when we share them.</h1>
          <p className="mt-5 max-w-[390px] text-[14px] leading-7 text-[#778078]">Create an account or sign in. Network administrators are routed to their workspace automatically.</p>
        </section>
        <section className="rounded-[24px] border border-[#e5e9e4] bg-white p-7 shadow-[0_20px_70px_#17251b0b] sm:p-9">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f2f6f2] text-[#55695b]"><ShieldCheck size={20}/></span>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-700">Lornet account</p>
          <h2 className="mt-2 text-[26px] font-semibold tracking-[-.05em]">{mode === 'signin' ? 'Welcome back' : 'Create an account'}</h2>
          <p className="mt-2 text-[12px] leading-5 text-[#7a837c]">{mode === 'signin' ? 'Sign in to continue to the network.' : 'Join the Lornet network with your email.'}</p>
          <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-[11px] font-medium text-[#58625b]">Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-xl border border-[#e1e6e1] bg-[#fdfefd] px-3.5 text-[13px] text-[#111827] outline-none transition placeholder:text-[#a1a9a2] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="you@example.com"/></label>
            <label className="flex flex-col gap-2 text-[11px] font-medium text-[#58625b]">Password<input type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl border border-[#e1e6e1] bg-[#fdfefd] px-3.5 text-[13px] text-[#111827] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="At least 8 characters"/></label>
            {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[11px] leading-5 text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-[11px] leading-5 text-rose-700">{error}</p>}
            <button disabled={busy} className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">{busy && <LoaderCircle size={15} className="animate-spin"/>}{mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowUpRight size={14}/></button>
          </form>
          <p className="mt-5 text-center text-[11px] text-[#8a938c]">{mode === 'signin' ? 'New to Lornet?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }} className="font-semibold text-emerald-700 hover:text-emerald-800">{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
          <p className="mt-6 border-t border-[#edf0ed] pt-5 text-center text-[10px] leading-5 text-[#9aa19c]">If your account is an administrator, you&apos;ll be taken to the Lornet workspace after signing in.</p>
        </section>
      </div>
    </main>
  )
}
