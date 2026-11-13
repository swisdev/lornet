'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, Check, ChevronDown, CircleHelp, ExternalLink, Eye, EyeOff, Globe2, Layers3, LoaderCircle, LogOut, Menu, MoreHorizontal, Plus, Search, Shield, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LornetBrand } from '@/components/lornet-brand'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

type Project = { id: string; title: string; slug: string; description: string; url: string; category: string; status: 'Live' | 'Beta' | 'Popular'; visible: boolean; launches: number; created_at?: string }
type VisitorLog = { id: string; project_id: string | null; project_title: string; event_type: string; ip_address: string | null; user_agent: string | null; device: string; created_at: string }
type AdminData = { projects: Project[]; logs: VisitorLog[]; admins: { email: string; created_at: string }[]; role: 'owner' | 'admin'; totalVisits: number }
type VisitorInsight = { ip: string; views: number; clicks: number; topWebsite: string; lastActive: string }
type WebsiteInsight = { website: string; clicks: number }
const visitorChartConfig = { clicks: { label: 'Website clicks', color: '#16865e' } } satisfies ChartConfig
const fetcher = async (url: string): Promise<AdminData> => { const response = await fetch(url); if (!response.ok) throw new Error('Unable to load network data'); return response.json() }
const timeframes = ['7D', '30D', '90D', '1Y'] as const
const tabs = ['Overview', 'Websites & services', 'IP & usage logs', 'Admin access'] as const
type Tab = typeof tabs[number]
const chartColors = ['#16865e', '#8cac91', '#d5aa71', '#778d9b', '#b9a3c7', '#d78e74']

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function formatTime(value: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function getAuthErrorMessage(error: unknown) {
  const message = (error instanceof Error ? error.message : '').toLowerCase()
  if (message.includes('invalid login credentials') || message.includes('user not found')) return 'Invalid email or password.'
  if (message.includes('email not confirmed')) return 'Please confirm your email before signing in.'
  if (message.includes('password') && (message.includes('weak') || message.includes('least'))) return 'Choose a stronger password and try again.'
  if (message.includes('rate limit') || message.includes('too many requests')) return 'Too many attempts. Please wait a moment and try again.'
  return 'Unable to complete sign-in. Please try again.'
}

export function AdminPortal() {
  const supabase = useMemo(() => {
    if (typeof window === 'undefined') return null
    try { return createClient() } catch { return null }
  }, [])
  const [authReady, setAuthReady] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [denied, setDenied] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [timeframe, setTimeframe] = useState<(typeof timeframes)[number]>('7D')
  const [query, setQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState('all')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectForm, setProjectForm] = useState({ title: '', description: '', url: '', category: 'Website', status: 'Live' as Project['status'] })
  const [projectBusy, setProjectBusy] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminError, setAdminError] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const { data, error, mutate } = useSWR<AdminData>(authorized ? '/api/admin-data' : null, fetcher, { refreshInterval: 30000, revalidateOnFocus: true })
  const isOwner = userEmail.toLowerCase() === 'lolfaw99@gmail.com'

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    let alive = true
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!alive) return
      if (!user) { setAuthReady(true); return }
      const currentEmail = user.email || ''
      const { data: allowed } = await supabase.rpc('lornet_is_admin')
      if (!alive) return
      if (!allowed) {
        await supabase.auth.signOut()
        setDenied(true)
        setAuthReady(true)
        return
      }
      setUserEmail(currentEmail)
      setAuthorized(true)
      setAuthReady(true)
    }
    void checkUser()
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void checkUser() })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [supabase])

  useEffect(() => {
    if (!authorized || !supabase) return
    const channel = supabase.channel('lornet-network-presence-admin', { config: { presence: { key: `admin-${userEmail}` } } })
      .on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(channel.presenceState()).length))
      .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString(), role: 'admin' }) })
    const changes = supabase.channel('admin-project-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => { void mutate() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitor_logs' }, () => { void mutate() })
      .subscribe()
    return () => { void supabase.removeChannel(channel); void supabase.removeChannel(changes) }
  }, [authorized, supabase, userEmail, mutate])

  const filteredLogs = useMemo(() => {
    const logs = data?.logs || []
    const needle = query.trim().toLowerCase()
    return logs.filter((log) => {
      const matchesProject = selectedProject === 'all' || log.project_id === selectedProject
      const matchesSearch = !needle || [log.ip_address, log.project_title, log.device, log.user_agent].some((value) => value?.toLowerCase().includes(needle))
      return matchesProject && matchesSearch
    })
  }, [data?.logs, query, selectedProject])

  const projects = data?.projects || []
  const logs = data?.logs || []
  const totalLaunches = projects.reduce((sum, project) => sum + Number(project.launches || 0), 0)
  const mostUsed = [...projects].sort((a, b) => Number(b.launches) - Number(a.launches))[0]
  const chartData = useMemo(() => {
    const days = timeframe === '7D' ? 7 : timeframe === '30D' ? 30 : timeframe === '90D' ? 90 : 365
    const step = days > 30 ? Math.ceil(days / 14) : 1
    const result = []
    for (let ago = days - 1; ago >= 0; ago -= step) {
      const date = new Date(); date.setDate(date.getDate() - ago)
      const key = date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
      const dayLogs = logs.filter((log) => new Date(log.created_at).toDateString() === date.toDateString())
      const visits = dayLogs.filter((log) => log.event_type === 'visit').length
      const launches = dayLogs.filter((log) => log.event_type === 'launch').length
      result.push({ date: key, visits, launches })
    }
    return result
  }, [logs, timeframe])
  const usageData = useMemo(() => projects.filter((project) => project.visible).map((project) => ({ name: project.title, value: Number(project.launches || 0) })), [projects])
  const visitorInsights = useMemo(() => {
    const byIp = new Map<string, { ip: string; views: number; clicks: number; lastActive: string; sites: Map<string, number> }>()
    const siteClicks = new Map<string, number>()
    for (const log of filteredLogs) {
      const ip = log.ip_address || 'Unknown'
      const visitor = byIp.get(ip) || { ip, views: 0, clicks: 0, lastActive: log.created_at, sites: new Map<string, number>() }
      if (log.event_type === 'visit') visitor.views += 1
      if (log.event_type === 'launch') {
        visitor.clicks += 1
        visitor.sites.set(log.project_title, (visitor.sites.get(log.project_title) || 0) + 1)
        siteClicks.set(log.project_title, (siteClicks.get(log.project_title) || 0) + 1)
      }
      if (new Date(log.created_at).getTime() > new Date(visitor.lastActive).getTime()) visitor.lastActive = log.created_at
      byIp.set(ip, visitor)
    }
    const visitors: VisitorInsight[] = [...byIp.values()].map((visitor) => ({
      ip: visitor.ip,
      views: visitor.views,
      clicks: visitor.clicks,
      lastActive: visitor.lastActive,
      topWebsite: [...visitor.sites.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
    })).sort((a, b) => b.clicks - a.clicks || b.views - a.views)
    const topWebsites: WebsiteInsight[] = [...siteClicks.entries()].map(([website, clicks]) => ({ website, clicks })).sort((a, b) => b.clicks - a.clicks).slice(0, 8)
    return { visitors, topWebsites }
  }, [filteredLogs])
  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError('')
    if (!supabase) { setAuthError('Authentication is currently unavailable. Please check the Supabase connection.'); return }
    setAuthBusy(true)
    const normalizedEmail = (authMode === 'signup' ? 'lolfaw99@gmail.com' : email.trim()).toLowerCase()
    try {
      if (authMode === 'signup') {
        if (normalizedEmail !== 'lolfaw99@gmail.com') throw new Error('Only the network owner can create the initial account.')
        const { error } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback` } })
        if (error) throw error
        setAuthError('Check your email for a confirmation link, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        if (error) throw error
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Invalid email or password.')
        const { data: allowed } = await supabase.rpc('lornet_is_admin')
        if (!allowed) { await supabase.auth.signOut(); setDenied(true); return }
        setUserEmail(user.email || normalizedEmail); setAuthorized(true)
      }
    } catch (cause) {
      setAuthError(getAuthErrorMessage(cause))
    } finally { setAuthBusy(false) }
  }

  async function signOut() { if (supabase) await supabase.auth.signOut(); setAuthorized(false); setUserEmail(''); setDenied(false) }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setProjectError('')
    if (!supabase) { setProjectError('Supabase is not connected.'); return }
    setProjectBusy(true)
    const slug = slugify(projectForm.title)
    try {
      const parsedUrl = new URL(projectForm.url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Use a secure website URL beginning with https://.')
      const { error: saveError } = await supabase.from('projects').insert({ ...projectForm, url: parsedUrl.toString(), slug, visible: true })
      if (saveError) throw saveError
      setShowProjectModal(false); setProjectForm({ title: '', description: '', url: '', category: 'Website', status: 'Live' }); await mutate()
    } catch (cause) { setProjectError(cause instanceof Error ? cause.message : 'Could not save project.') }
    finally { setProjectBusy(false) }
  }

  async function toggleVisibility(project: Project) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('projects').update({ visible: !project.visible }).eq('id', project.id)
    if (updateError) window.alert('Could not update visibility. Please try again.'); else await mutate()
  }
  async function deleteProject(project: Project) {
    if (!supabase) return
    if (!window.confirm(`Remove ${project.title} from the network?`)) return
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', project.id)
    if (deleteError) window.alert('Could not remove this project. Please try again.'); else await mutate()
  }
  async function addAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAdminError('')
    if (!supabase) { setAdminError('Supabase is not connected.'); return }
    const normalized = adminEmail.trim().toLowerCase()
    if (!normalized.includes('@') || normalized === 'lolfaw99@gmail.com') { setAdminError('Enter a valid sub-admin email.'); return }
    const { error: insertError } = await supabase.from('admins').insert({ email: normalized })
    if (insertError) setAdminError(insertError.code === '23505' ? 'This email already has access.' : 'Unable to add this admin.')
    else { setAdminEmail(''); await mutate() }
  }
  async function removeAdmin(target: string) {
    if (!supabase) return
    if (!window.confirm(`Remove admin access for ${target}?`)) return
    const { error: removeError } = await supabase.from('admins').delete().eq('email', target)
    if (removeError) setAdminError('Unable to remove this admin.'); else await mutate()
  }

  if (!authReady) return <div className="flex min-h-screen items-center justify-center bg-[#f8f9f7]"><LoaderCircle className="animate-spin text-emerald-700" size={22}/><span className="sr-only">Loading admin portal</span></div>
  if (denied) return <main className="flex min-h-screen items-center justify-center bg-[#f8f9f7] px-5"><div className="w-full max-w-[430px] rounded-[24px] border border-[#e6e9e5] bg-white p-8 text-center shadow-[0_24px_80px_#17251b0b]"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Shield size={22}/></span><h1 className="mt-5 text-[24px] font-semibold tracking-[-.05em]">Access denied</h1><p className="mt-2 text-[13px] leading-6 text-[#727b74]">Unauthorized account. This email does not have access to the Lornet admin portal.</p><Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[#111827] px-4 text-[12px] font-medium text-white">Back to Lornet <ArrowLeft size={14}/></Link></div></main>

  if (!authorized) return <main className="min-h-screen bg-[#f8f9f7] px-5 py-8"><header className="mx-auto flex max-w-[1180px] items-center justify-between"><Link href="/" aria-label="Lornet home" className="flex items-center gap-2.5"><LornetBrand /></Link><Link href="/" className="text-[12px] text-[#778078] hover:text-[#111827]">Back to network</Link></header><div className="mx-auto grid max-w-[980px] items-center gap-14 py-12 md:min-h-[calc(100vh-100px)] md:grid-cols-[1fr_400px] md:py-0"><section className="hidden md:block"><div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700"><Activity size={22}/></div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-emerald-700">Lornet workspace</p><h1 className="mt-3 max-w-[420px] text-[46px] font-semibold leading-[1.08] tracking-[-.06em]">A clearer view of the network.</h1><p className="mt-5 max-w-[390px] text-[14px] leading-7 text-[#778078]">Manage the projects, people, and activity connected across Lornet.</p><div className="mt-10 flex gap-3 text-[11px] text-[#7c857e]"><span className="flex items-center gap-2 rounded-full border border-[#e6eae5] bg-white px-3 py-2"><ShieldCheck size={14} className="text-emerald-700"/>Secure admin access</span><span className="flex items-center gap-2 rounded-full border border-[#e6eae5] bg-white px-3 py-2"><Globe2 size={14} className="text-emerald-700"/>Live network</span></div></section><section className="rounded-[24px] border border-[#e5e9e4] bg-white p-7 shadow-[0_20px_70px_#17251b0b] sm:p-9"><div className="flex size-11 items-center justify-center rounded-2xl bg-[#f2f6f2] text-[#55695b]"><ShieldCheck size={20}/></div><h2 className="mt-6 text-[25px] font-semibold tracking-[-.05em]">{authMode === 'signin' ? 'Welcome back' : 'Create your owner account'}</h2><p className="mt-2 text-[12px] leading-5 text-[#7a837c]">{authMode === 'signin' ? 'Sign in with your approved Lornet admin email.' : 'Owner access is reserved for the network owner.'}</p><form onSubmit={handleAuth} className="mt-7 flex flex-col gap-4"><label className="flex flex-col gap-2 text-[11px] font-medium text-[#58625b]">Email address<input type="email" required autoComplete="email" value={authMode === 'signup' ? 'lolfaw99@gmail.com' : email} readOnly={authMode === 'signup'} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-xl border border-[#e1e6e1] bg-[#fdfefd] px-3.5 text-[13px] text-[#111827] outline-none transition placeholder:text-[#a1a9a2] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="you@organization.com"/></label><label className="flex flex-col gap-2 text-[11px] font-medium text-[#58625b]">Password<input type="password" required minLength={8} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl border border-[#e1e6e1] bg-[#fdfefd] px-3.5 text-[13px] text-[#111827] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="At least 8 characters"/></label>{authError && <p role="status" className="rounded-xl bg-[#f5f7f4] px-3 py-2.5 text-[11px] leading-5 text-[#66716a]">{authError}</p>}<button disabled={authBusy} className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">{authBusy && <LoaderCircle size={15} className="animate-spin"/>}{authMode === 'signin' ? 'Sign in to workspace' : 'Create account'} <ArrowUpRight size={14}/></button></form><p className="mt-5 text-center text-[11px] text-[#8a938c]">{authMode === 'signin' ? 'First time here?' : 'Already registered?'} <button onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthError('') }} className="font-semibold text-emerald-700 hover:text-emerald-800">{authMode === 'signin' ? 'Create owner account' : 'Sign in'}</button></p><p className="mt-6 border-t border-[#edf0ed] pt-5 text-center text-[10px] leading-5 text-[#9aa19c]">Email confirmation may be required before your first sign-in.</p></section></div></main>

  const navIcon = (tab: Tab) => tab === 'Overview' ? <BarChart3 size={16}/> : tab === 'Websites & services' ? <Globe2 size={16}/> : tab === 'IP & usage logs' ? <Activity size={16}/> : <Users size={16}/>
  const activeProjects = projects.filter((project) => project.visible).length

  return <main className="min-h-screen bg-[#f8f9f7] text-[#17211a]"><aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col border-r border-[#e7eae6] bg-[#fbfcfa] px-4 py-5 lg:flex"><Link href="/" aria-label="Lornet home" className="flex items-center gap-2.5 px-2"><LornetBrand /></Link><div className="mt-10 px-2 text-[9px] font-semibold uppercase tracking-[.16em] text-[#a0a8a1]">Workspace</div><nav className="mt-3 flex flex-col gap-1" aria-label="Admin sections">{tabs.filter((tab) => tab !== 'Admin access' || isOwner).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[12px] font-medium transition ${activeTab === tab ? 'bg-[#eaf2eb] text-[#27704b]' : 'text-[#707a72] hover:bg-[#f2f5f1] hover:text-[#344238]'}`}>{navIcon(tab)}{tab}</button>)}</nav><div className="mt-auto rounded-2xl border border-[#e7ebe6] bg-white p-3.5"><div className="flex items-center gap-2"><span className="relative flex size-2"><span className="absolute size-full animate-ping rounded-full bg-emerald-400 opacity-50"/><span className="relative size-2 rounded-full bg-emerald-500"/></span><span className="text-[11px] font-semibold text-[#405047]">Network live</span></div><p className="mt-2 text-[10px] leading-4 text-[#929b94]">{onlineCount} active {onlineCount === 1 ? 'session' : 'sessions'} on this channel</p></div><div className="mt-4 flex items-center gap-3 border-t border-[#e9ece8] pt-4"><span className="flex size-8 items-center justify-center rounded-full bg-[#e6ece6] text-[10px] font-bold text-[#526257]">{userEmail.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#3d4941]">{userEmail}</p><p className="text-[9px] capitalize text-[#8b948d]">{isOwner ? 'Owner' : 'Admin'}</p></div><button aria-label="Sign out" onClick={signOut} className="text-[#89928b] hover:text-[#26352b]"><LogOut size={15}/></button></div></aside>

    <div className="lg:pl-[238px]"><header className="sticky top-0 z-10 flex h-[66px] items-center justify-between border-b border-[#e7eae6] bg-[#f8f9f7]/90 px-5 backdrop-blur-xl sm:px-8"><div className="flex items-center gap-3"><Link href="/" aria-label="Lornet home" className="lg:hidden"><LornetBrand compact markClassName="size-8 rounded-lg" /></Link><div className="hidden text-[11px] text-[#8b948d] sm:block">Workspace <span className="mx-1.5">/</span> <strong className="font-semibold text-[#455148]">{activeTab}</strong></div><span className="text-[11px] font-semibold text-[#455148] sm:hidden">{activeTab}</span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-medium text-emerald-700 sm:inline-flex"><span className="size-1.5 rounded-full bg-emerald-500"/>{onlineCount} live</span><button className="flex size-8 items-center justify-center rounded-lg text-[#78827a] hover:bg-white" aria-label="Help"><CircleHelp size={17}/></button><span className="flex size-8 items-center justify-center rounded-full bg-[#e6ece6] text-[10px] font-bold text-[#526257]">{userEmail.slice(0,1).toUpperCase()}</span></div></header>

    <div className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8 sm:py-9"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-700">Lornet network</p><h1 className="mt-2 text-[27px] font-semibold tracking-[-.055em] sm:text-[32px]">{activeTab === 'Overview' ? 'Network overview' : activeTab}</h1><p className="mt-1.5 text-[12px] text-[#7c857e]">A live view of the projects and people moving across your network.</p></div><div className="flex items-center gap-2"><span className="hidden items-center gap-2 rounded-xl border border-[#e5e9e4] bg-white px-3 py-2 text-[10px] text-[#68736b] sm:inline-flex"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500"/> Updated just now</span>{activeTab === 'Websites & services' && <button onClick={() => setShowProjectModal(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"><Plus size={15}/> Add website</button>}</div></div>

      {error && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">Could not load network data. Please refresh or try again.</div>}
      {!data && !error && <div className="flex min-h-[300px] items-center justify-center text-[12px] text-[#78827a]"><LoaderCircle size={17} className="mr-2 animate-spin"/>Loading network data</div>}
      {data && activeTab === 'Overview' && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Live users right now" value={String(onlineCount)} hint="Across network" trend="LIVE" icon={<Users size={16}/>} live />
          <KpiCard label="Total network visits" value={Number(data.totalVisits).toLocaleString()} hint="Recorded visits and clicks" trend="LOG" icon={<Activity size={16}/>} />
          <KpiCard label="Active projects" value={String(activeProjects).padStart(2, '0')} hint={`${projects.length - activeProjects} hidden from public`} trend="LIVE" icon={<Globe2 size={16}/>} />
          <KpiCard label="Most clicked website" value={mostUsed?.title || '—'} hint={`${Number(mostUsed?.launches || 0).toLocaleString()} clicks`} trend="TOP" icon={<Layers3 size={16}/>} compact />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <section className="rounded-2xl border border-[#e6eae5] bg-white p-5 shadow-[0_2px_8px_#15201605] sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-[14px] font-semibold tracking-[-.02em]">Network traffic</h2><p className="mt-1 text-[10px] text-[#89928b]">Visits and website clicks over time</p></div><div className="flex rounded-lg bg-[#f4f6f3] p-1" role="group" aria-label="Timeframe">{timeframes.map((range) => <button key={range} onClick={() => setTimeframe(range)} className={`rounded-md px-2.5 py-1.5 text-[9px] font-semibold transition ${timeframe === range ? 'bg-white text-[#324038] shadow-sm' : 'text-[#8b948d] hover:text-[#455148]'}`}>{range}</button>)}</div></div><div className="mt-4 flex items-center gap-4 text-[10px] text-[#8a938c]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-600"/>Network visits</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#aebcb0]"/>Website clicks</span></div><div className="mt-3 h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 6, left: -23, bottom: 0 }}><defs><linearGradient id="adminVisits" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a36a" stopOpacity={.2}/><stop offset="100%" stopColor="#16a36a" stopOpacity={0}/></linearGradient><linearGradient id="adminLaunch" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#afc3b4" stopOpacity={.16}/><stop offset="100%" stopColor="#afc3b4" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef1ed" strokeDasharray="3 5"/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#929a93', fontSize: 9 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#929a93', fontSize: 9 }}/><Tooltip contentStyle={{ border: '1px solid #e8ece8', borderRadius: 12, boxShadow: '0 8px 30px #0b20100f', fontSize: 11 }}/><Area type="monotone" dataKey="visits" stroke="#059669" strokeWidth={2} fill="url(#adminVisits)"/><Area type="monotone" dataKey="launches" stroke="#91a597" strokeWidth={1.5} fill="url(#adminLaunch)"/></AreaChart></ResponsiveContainer></div></section>
          <section className="rounded-2xl border border-[#e6eae5] bg-white p-5 shadow-[0_2px_8px_#15201605] sm:p-6"><div><h2 className="text-[14px] font-semibold tracking-[-.02em]">Usage by project</h2><p className="mt-1 text-[10px] text-[#89928b]">Share of recorded website clicks</p></div><div className="relative mt-2 h-[218px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={usageData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">{usageData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]}/>)}</Pie><Tooltip contentStyle={{ border: '1px solid #e8ece8', borderRadius: 12, fontSize: 11 }}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[25px] font-semibold tracking-[-.06em]">{totalLaunches.toLocaleString()}</span><span className="text-[9px] text-[#8a938c]">total clicks</span></div></div><div className="flex flex-col gap-2.5">{usageData.slice(0, 5).map((entry, index) => <button key={entry.name} onClick={() => { setSelectedProject(projects.find((project) => project.title === entry.name)?.id || 'all'); setActiveTab('IP & usage logs') }} className="flex items-center gap-2.5 text-left"><span className="size-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }}/><span className="flex-1 truncate text-[10px] text-[#69736b]">{entry.name}</span><span className="text-[10px] font-semibold text-[#3e4b42]">{entry.value.toLocaleString()}</span></button>)}</div></section>
        </div>
        <div className="mt-4 rounded-2xl border border-[#e6eae5] bg-white p-5 shadow-[0_2px_8px_#15201605] sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-[14px] font-semibold tracking-[-.02em]">Recent network activity</h2><p className="mt-1 text-[10px] text-[#89928b]">Latest visits and website clicks</p></div><button onClick={() => setActiveTab('IP & usage logs')} className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800">View all <ArrowUpRight size={12} className="ml-1 inline"/></button></div><LogsTable logs={logs.slice(0, 5)} compact/></div>
      </>}

      {data && activeTab === 'Websites & services' && <section className="overflow-hidden rounded-2xl border border-[#e6eae5] bg-white shadow-[0_2px_8px_#15201605]"><div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] p-4 sm:flex-row sm:items-center sm:p-5"><div><h2 className="text-[13px] font-semibold">Websites & services</h2><p className="mt-1 text-[10px] text-[#89928b]">Add, update, and manage public projects in the network.</p></div><span className="rounded-lg bg-[#f4f6f3] px-2.5 py-1.5 text-[10px] text-[#69736b]">{projects.length} total</span></div><div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left"><thead><tr className="border-b border-[#f0f2ef] text-[9px] font-semibold uppercase tracking-[.1em] text-[#9aa29b]"><th className="px-5 py-3">Project</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Website clicks</th><th className="px-4 py-3">Visibility</th><th className="px-4 py-3 text-right">Manage</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id} className="border-b border-[#f1f3f0] last:border-0"><td className="px-5 py-3.5"><div className="text-[11px] font-semibold text-[#354138]">{project.title}</div><a href={project.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-[260px] items-center gap-1 truncate text-[9px] text-[#909990] hover:text-emerald-700">{project.url}<ExternalLink size={10}/></a></td><td className="px-4 py-3.5 text-[10px] text-[#717b73]">{project.category}</td><td className="px-4 py-3.5"><span className="rounded-md bg-[#f1f5f1] px-2 py-1 text-[9px] font-medium text-[#617267]">{project.status}</span></td><td className="px-4 py-3.5 text-[10px] font-medium text-[#556158]">{Number(project.launches).toLocaleString()}</td><td className="px-4 py-3.5"><button onClick={() => void toggleVisibility(project)} aria-label={`${project.visible ? 'Hide' : 'Show'} ${project.title}`} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-semibold ${project.visible ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f3f4f2] text-[#89928b]'}`}>{project.visible ? <Eye size={12}/> : <EyeOff size={12}/>} {project.visible ? 'Visible' : 'Hidden'}</button></td><td className="px-4 py-3.5 text-right"><button onClick={() => void deleteProject(project)} aria-label={`Delete ${project.title}`} className="inline-flex size-8 items-center justify-center rounded-lg text-[#a0a8a1] transition hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14}/></button></td></tr>)}</tbody></table></div></section>}

      {data && activeTab === 'IP & usage logs' && <div className="space-y-4"><VisitorInsightsPanel visitors={visitorInsights.visitors} websites={visitorInsights.topWebsites} activityCount={filteredLogs.length}/><section className="overflow-hidden rounded-2xl border border-[#e6eae5] bg-white shadow-[0_2px_8px_#15201605]"><div className="flex flex-col justify-between gap-3 border-b border-[#edf0ed] p-4 sm:flex-row sm:items-center sm:p-5"><div><h2 className="text-[13px] font-semibold">Visitor IP & usage logs</h2><p className="mt-1 text-[10px] text-[#89928b]">{filteredLogs.length.toLocaleString()} records match your filters</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ba49c]"/><input aria-label="Search logs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search IP, project, device" className="h-9 w-full rounded-lg border border-[#e8ece7] bg-[#fbfcfa] pl-8 pr-3 text-[10px] outline-none focus:border-emerald-500 sm:w-[205px]"/></label><label className="sr-only" htmlFor="project-filter">Filter by project</label><select id="project-filter" value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)} className="h-9 rounded-lg border border-[#e8ece7] bg-[#fbfcfa] px-3 text-[10px] text-[#66716a] outline-none focus:border-emerald-500"><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></div></div><LogsTable logs={filteredLogs}/></section></div>}

      {data && activeTab === 'Admin access' && isOwner && <section className="grid gap-4 xl:grid-cols-[.88fr_1.12fr]"><div className="rounded-2xl border border-[#e6eae5] bg-white p-5 shadow-[0_2px_8px_#15201605] sm:p-6"><div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Users size={18}/></div><h2 className="mt-4 text-[15px] font-semibold">Add a sub-admin</h2><p className="mt-1.5 text-[11px] leading-5 text-[#7e8880]">Give a team member access to project management and network analytics. Only the owner can manage this list.</p><form onSubmit={addAdmin} className="mt-5 flex flex-col gap-3"><label className="flex flex-col gap-2 text-[10px] font-medium text-[#566259]">Admin email<input type="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="teammate@organization.com" className="h-10 rounded-xl border border-[#e1e6e1] px-3 text-[11px] outline-none focus:border-emerald-500"/></label>{adminError && <p role="alert" className="text-[10px] text-rose-600">{adminError}</p>}<button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#18251d] text-[11px] font-semibold text-white transition hover:bg-[#26372b]"><Plus size={14}/> Add admin access</button></form><div className="mt-5 flex items-start gap-2 rounded-xl bg-[#f5f7f4] p-3 text-[9px] leading-5 text-[#778078]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-700"/> Sub-admin permissions are restricted by database policies. They cannot change team access.</div></div><div className="rounded-2xl border border-[#e6eae5] bg-white shadow-[0_2px_8px_#15201605]"><div className="border-b border-[#edf0ed] p-5"><h2 className="text-[13px] font-semibold">Team access</h2><p className="mt-1 text-[10px] text-[#89928b]">{(data.admins?.length || 0) + 1} approved accounts</p></div><div className="divide-y divide-[#f0f2ef]"><div className="flex items-center gap-3 px-5 py-4"><span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">L</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#37433a]">lolfaw99@gmail.com</p><p className="mt-0.5 text-[9px] text-[#909990]">Owner · Full access</p></div><span className="rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">Owner</span></div>{data.admins?.map((admin) => <div key={admin.email} className="flex items-center gap-3 px-5 py-4"><span className="flex size-9 items-center justify-center rounded-full bg-[#f0f2ee] text-[10px] font-bold uppercase text-[#67736a]">{admin.email.slice(0,1)}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#37433a]">{admin.email}</p><p className="mt-0.5 text-[9px] text-[#909990]">Sub-admin · Analytics and project management</p></div><span className="rounded-md bg-[#f3f4f2] px-2 py-1 text-[9px] font-semibold text-[#68736b]">Admin</span><button onClick={() => void removeAdmin(admin.email)} aria-label={`Remove ${admin.email}`} className="flex size-8 items-center justify-center rounded-lg text-[#99a19a] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13}/></button></div>)}</div></div></section>}
    </div></div>

    {showProjectModal && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#17211a]/30 p-4 backdrop-blur-[3px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowProjectModal(false) }}><section role="dialog" aria-modal="true" aria-labelledby="project-modal-title" className="w-full max-w-[470px] rounded-[22px] border border-[#e5e9e4] bg-white p-6 shadow-[0_24px_80px_#0b20102b]"><div className="flex items-start justify-between"><div><h2 id="project-modal-title" className="text-[18px] font-semibold tracking-[-.04em]">Add a website</h2><p className="mt-1 text-[11px] text-[#808a82]">Add a project to the Lornet network.</p></div><button onClick={() => setShowProjectModal(false)} aria-label="Close dialog" className="flex size-8 items-center justify-center rounded-lg text-[#8d968f] hover:bg-[#f4f6f3]"><X size={16}/></button></div><form onSubmit={saveProject} className="mt-5 flex flex-col gap-3.5"><label className="flex flex-col gap-1.5 text-[10px] font-medium text-[#5d685f]">Title<input required maxLength={100} value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} className="h-10 rounded-lg border border-[#e3e8e3] px-3 text-[11px] outline-none focus:border-emerald-500" placeholder="Project name"/></label><label className="flex flex-col gap-1.5 text-[10px] font-medium text-[#5d685f]">Description<textarea required maxLength={500} value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} className="min-h-[76px] resize-y rounded-lg border border-[#e3e8e3] px-3 py-2.5 text-[11px] outline-none focus:border-emerald-500" placeholder="What is this project about?"/></label><label className="flex flex-col gap-1.5 text-[10px] font-medium text-[#5d685f]">Project URL<input required type="url" value={projectForm.url} onChange={(event) => setProjectForm({ ...projectForm, url: event.target.value })} className="h-10 rounded-lg border border-[#e3e8e3] px-3 text-[11px] outline-none focus:border-emerald-500" placeholder="https://example.org"/></label><div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-[10px] font-medium text-[#5d685f]">Category<input required maxLength={50} value={projectForm.category} onChange={(event) => setProjectForm({ ...projectForm, category: event.target.value })} className="h-10 rounded-lg border border-[#e3e8e3] px-3 text-[11px] outline-none focus:border-emerald-500" placeholder="Website"/></label><label className="flex flex-col gap-1.5 text-[10px] font-medium text-[#5d685f]">Status<select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value as Project['status'] })} className="h-10 rounded-lg border border-[#e3e8e3] bg-white px-3 text-[11px] outline-none focus:border-emerald-500"><option>Live</option><option>Beta</option><option>Popular</option></select></label></div>{projectError && <p role="alert" className="text-[10px] text-rose-600">{projectError}</p>}<div className="mt-1 flex justify-end gap-2"><button type="button" onClick={() => setShowProjectModal(false)} className="h-10 rounded-lg border border-[#e5e9e4] px-4 text-[10px] font-semibold text-[#67736a]">Cancel</button><button disabled={projectBusy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-[10px] font-semibold text-white disabled:opacity-60">{projectBusy && <LoaderCircle size={13} className="animate-spin"/>}Add website</button></div></form></section></div>}
  </main>
}

function KpiCard({ label, value, hint, trend, icon, live, compact }: { label: string; value: string; hint: string; trend: string; icon: React.ReactNode; live?: boolean; compact?: boolean }) {
  return <section className="rounded-2xl border border-[#e6eae5] bg-white p-4 shadow-[0_2px_8px_#15201605] sm:p-5"><div className="flex items-center justify-between"><span className="flex size-8 items-center justify-center rounded-lg bg-[#f4f6f3] text-[#78847b]">{icon}</span><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[8px] font-semibold ${live ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f5f6f4] text-[#728076]'}`}>{live && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500"/>}{trend !== 'LIVE' && trend !== 'TOP' && <ArrowUpRight size={10}/>} {trend}</span></div><p className="mt-4 text-[10px] font-medium text-[#7f8981]">{label}</p><p className={`mt-1 truncate font-semibold tracking-[-.05em] text-[#26332a] ${compact ? 'text-[19px]' : 'text-[27px]'}`}>{value}</p><p className="mt-1 text-[9px] text-[#9aa29b]">{hint}</p></section>
}

function LogsTable({ logs, compact = false }: { logs: VisitorLog[]; compact?: boolean }) {
  const counts = useMemo(() => logs.reduce<Record<string, number>>((result, log) => { const ip = log.ip_address || 'Unknown'; result[ip] = (result[ip] || 0) + 1; return result }, {}), [logs])
  if (!logs.length) return <div className="px-5 py-12 text-center"><div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-[#f4f6f3] text-[#859088]"><Activity size={17}/></div><p className="mt-3 text-[11px] font-medium text-[#59655c]">No activity found</p><p className="mt-1 text-[10px] text-[#929b94]">New visitor events will appear here as they happen.</p></div>
  return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-[#f0f2ef] text-[9px] font-semibold uppercase tracking-[.1em] text-[#9aa29b]"><th className="px-5 py-3">IP address</th><th className="px-4 py-3">Service / website</th><th className="px-4 py-3">Total uses</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Last active</th></tr></thead><tbody>{logs.slice(0, compact ? 5 : undefined).map((log) => <tr key={log.id} className="border-b border-[#f1f3f0] last:border-0"><td className="px-5 py-3.5 font-mono text-[10px] text-[#4f5c52]">{log.ip_address || '—'}</td><td className="px-4 py-3.5"><div className="text-[10px] font-medium text-[#4e5a51]">{log.project_title}</div><div className="mt-0.5 text-[9px] capitalize text-[#9aa29b]">{log.event_type}</div></td><td className="px-4 py-3.5 text-[10px] font-semibold text-[#4b584e]">{counts[log.ip_address || 'Unknown'] || 1}</td><td className="px-4 py-3.5 text-[10px] text-[#727d74]">{log.device}</td><td className="px-4 py-3.5 text-[10px] text-[#8b948d]">{formatTime(log.created_at)}</td></tr>)}</tbody></table></div>
}

function VisitorInsightsPanel({ visitors, websites, activityCount }: { visitors: VisitorInsight[]; websites: WebsiteInsight[]; activityCount: number }) {
  return (
    <section className="rounded-2xl border border-[#e6eae5] bg-white p-5 shadow-[0_2px_8px_#15201605] sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-[14px] font-semibold tracking-[-.02em]">Visitor behavior by IP</h2><p className="mt-1 text-[10px] text-[#89928b]">Most-clicked websites and activity grouped by network address.</p></div>
        <span className="rounded-lg bg-[#f4f6f3] px-2.5 py-1.5 text-[9px] text-[#69736b]">{visitors.length} IP addresses · {activityCount} recent events</span>
      </div>
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-xl border border-[#edf0ed] p-4" aria-label="Most clicked websites chart">
          <h3 className="text-[11px] font-semibold text-[#455148]">Most-clicked websites</h3>
          <p className="mt-1 text-[9px] text-[#89928b]">Website link clicks in the current activity records</p>
          {websites.length ? <ChartContainer config={visitorChartConfig} className="mt-3 h-[230px] w-full">
            <BarChart accessibilityLayer data={websites} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#eef1ed" strokeDasharray="3 5" />
              <XAxis dataKey="website" tickLine={false} axisLine={false} tick={{ fill: '#7f8981', fontSize: 9 }} tickFormatter={(value) => String(value).length > 13 ? `${String(value).slice(0, 12)}…` : value} interval={0} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#929a93', fontSize: 9 }} allowDecimals={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="clicks" name="Website clicks" fill="var(--color-clicks)" radius={[5, 5, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ChartContainer> : <div className="flex h-[230px] items-center justify-center px-6 text-center text-[10px] text-[#89928b]">No website clicks in the current activity records yet.</div>}
        </section>
        <section className="overflow-hidden rounded-xl border border-[#edf0ed]" aria-label="Visitor activity summarized by IP address">
          <div className="border-b border-[#edf0ed] px-4 py-3"><h3 className="text-[11px] font-semibold text-[#455148]">IP activity summary</h3><p className="mt-1 text-[9px] text-[#89928b]">Visits count views of the Lornet directory; clicks show the most-clicked destination.</p></div>
          {visitors.length ? <div className="max-h-[270px] overflow-auto"><table className="w-full min-w-[600px] text-left"><thead className="sticky top-0 bg-white"><tr className="border-b border-[#f0f2ef] text-[8px] font-semibold uppercase tracking-[.09em] text-[#9aa29b]"><th className="px-3 py-2.5">IP address</th><th className="px-3 py-2.5">Views</th><th className="px-3 py-2.5">Clicks</th><th className="px-3 py-2.5">Most-clicked website</th><th className="px-3 py-2.5">Last active</th></tr></thead><tbody>{visitors.map((visitor) => <tr key={visitor.ip} className="border-b border-[#f1f3f0] last:border-0"><td className="px-3 py-3 font-mono text-[9px] text-[#4f5c52]">{visitor.ip}</td><td className="px-3 py-3 text-[9px] text-[#59655c]">{visitor.views.toLocaleString()}</td><td className="px-3 py-3 text-[9px] font-semibold text-[#3e4b42]">{visitor.clicks.toLocaleString()}</td><td className="max-w-[180px] truncate px-3 py-3 text-[9px] text-[#59655c]" title={visitor.topWebsite}>{visitor.topWebsite}</td><td className="px-3 py-3 text-[9px] text-[#89928b]">{formatTime(visitor.lastActive)}</td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-[10px] text-[#89928b]">Visitor summaries will appear when activity is recorded.</p>}
          <p className="border-t border-[#edf0ed] px-4 py-2.5 text-[9px] leading-4 text-[#89928b]">IP addresses can represent shared networks or change over time, so they are not guaranteed to identify one person.</p>
        </section>
      </div>
    </section>
  )
}
