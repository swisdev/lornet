'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ArrowUpRightFromSquare, ArrowRight, Box, Globe2, Layers3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NetworkChart, type ActivityPeriod } from '@/components/network-chart'
import type { Project } from '@/lib/projects'

type PublicStats = { points: { time: string; visits: number; launches: number }[]; totalVisits: number; projectClicks: Record<string, number>; live: boolean }
const statsFetcher = async (url: string): Promise<PublicStats> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Network stats unavailable')
  return response.json()
}

const statusStyles: Record<string, string> = {
  Live: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Beta: 'bg-amber-50 text-amber-700 ring-amber-100',
  Popular: 'bg-stone-100 text-stone-700 ring-stone-200',
}

function safeProjectUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '#projects'
  } catch { return '#projects' }
}

function visit(project: Project, eventType: 'visit' | 'launch') {
  void fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: project.id.startsWith('demo-') ? null : project.id, title: project.title, eventType }),
    keepalive: true,
  }).catch(() => undefined)
}

export function PublicHub({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects)
  const [period, setPeriod] = useState<ActivityPeriod>('24h')
  const { data: networkStats } = useSWR<PublicStats>(`/api/public-stats?period=${period}`, statsFetcher, { refreshInterval: 30000, revalidateOnFocus: true })
  const [onlineCount, setOnlineCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const home = { id: 'hub', title: 'Lornet Network', slug: 'lornet', description: '', url: '', category: 'Network', status: 'Live' as const, visible: true, launches: 0 }
    visit(home, 'visit')
    let supabase: ReturnType<typeof createClient>
    try { supabase = createClient() } catch { return }
    const channel = supabase.channel('lornet-network-presence', { config: { presence: { key: crypto.randomUUID() } } })
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length)
        setIsConnected(true)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString(), page: 'network' })
      })
    const updates = supabase.channel('public-project-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async () => {
        const { data } = await supabase.from('projects').select('id,title,slug,description,url,category,status,visible,launches').eq('visible', true).order('created_at')
        if (data) setProjects(data as Project[])
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel); void supabase.removeChannel(updates) }
  }, [])

  const visibleProjects = useMemo(() => projects.filter((project) => project.visible), [projects])

  return (
    <main className="min-h-screen bg-[#f9f9f8] text-[#111827]">
      <header className="sticky top-0 z-30 border-b border-[#e9ebe8] bg-[#f9f9f8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="Lornet home">
            <span data-logo-slot="lornet" className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-[#111827] text-white"><Layers3 size={18} strokeWidth={1.8} /></span>
            <span className="text-[20px] font-semibold tracking-[-0.06em]">lornet<span className="text-emerald-600">.</span></span>
          </a>
          <nav aria-label="Main navigation" className="hidden items-center gap-9 text-[13px] font-medium text-[#6b7280] md:flex">
            <a className="transition hover:text-[#111827]" href="#about">About network</a>
            <a className="transition hover:text-[#111827]" href="#projects">Projects</a>
            <a className="transition hover:text-[#111827]" href="#stats">Live stats</a>
          </nav>
          <Link href="/sign-in" className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-4 text-[13px] font-medium shadow-[0_1px_2px_#1018280a] transition hover:border-[#cbd5ce] hover:bg-[#fbfdfb]">
            Sign in <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      <section id="top" className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-14 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-16 lg:pb-[84px]">
        <div id="about" className="max-w-[560px]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#e6e9e5] bg-white px-3 py-1.5 text-[11px] font-medium tracking-[.01em] text-[#66716a] shadow-[0_1px_2px_#10182808]">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>
            {isConnected ? 'Network connected' : 'Lornet network'}
          </div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[.22em] text-emerald-700">One connected network</p>
          <h1 className="max-w-[620px] text-[46px] font-semibold leading-[1.04] tracking-[-.065em] sm:text-[60px] lg:text-[68px]">Good things grow <span className="together-word" role="text" aria-label="together."><span className="word-sans" aria-hidden="true">together.</span><span className="word-serif" aria-hidden="true">together.</span></span></h1>
          <p className="mt-6 max-w-[460px] text-[16px] leading-7 text-[#6b7280] sm:text-[17px]">Lornet builds connected websites and digital projects that make useful ideas easier to find, share, and bring to life.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#projects" className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-[13px] font-semibold text-white shadow-[0_4px_12px_#0596692b] transition hover:bg-emerald-700">Explore the network <ArrowDownRight size={16} /></a>
            <a href="#stats" className="inline-flex h-12 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-[#5f6962] transition hover:bg-white">How it connects <ArrowRight size={15} /></a>
          </div>
          <div className="mt-11 flex items-center gap-4 border-t border-[#e8ebe7] pt-6">
            <div className="flex -space-x-2">
              {['N', 'F', 'C', 'O'].map((letter, index) => <span key={letter} className={`flex size-8 items-center justify-center rounded-full border-2 border-[#f9f9f8] text-[10px] font-semibold ${['bg-[#e8e6dc] text-[#656359]', 'bg-[#dce9e1] text-[#45624e]', 'bg-[#e6dfeb] text-[#65576e]', 'bg-[#e9e1d9] text-[#726456]'][index]}`}>{letter}</span>)}
            </div>
            <p className="text-[12px] text-[#737d76]"><span className="font-semibold text-[#303a33]">{visibleProjects.length} open projects</span><span className="mx-2 text-[#c6ccc7]">·</span>Built for everyone</p>
          </div>
        </div>

        <div id="stats" className="relative overflow-hidden rounded-[24px] border border-[#e5e9e4] bg-white p-5 shadow-[0_18px_60px_#17251b0a] sm:p-7">
          <div className="absolute right-[-50px] top-[-70px] size-44 rounded-full bg-emerald-100/50 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div><p className="text-[12px] font-medium text-[#768079]">Network activity</p><p className="mt-2 text-[30px] font-semibold tracking-[-.06em]">{(networkStats?.totalVisits || 0).toLocaleString()} <span className="text-[13px] font-medium tracking-normal text-[#828b84]">visits in {period}</span></p></div>
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />{networkStats?.live ? 'LIVE' : 'DEMO'}</span>
          </div>
          <div className="relative mt-5 flex items-center gap-5 text-[11px] text-[#7c857e]"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-600" /> Network visits</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#a6b2aa]" /> Website clicks</span></div>
          <div className="relative mt-2"><NetworkChart period={period} onPeriodChange={setPeriod} /></div>
          <div className="relative flex items-center justify-between border-t border-[#edf0ed] pt-4 text-[11px] text-[#818a83]"><span className="flex items-center gap-2"><span className="relative size-2"><span className="absolute size-2 animate-ping rounded-full bg-emerald-400 opacity-50"/><span className="relative block size-2 rounded-full bg-emerald-500"/></span>{isConnected ? `${onlineCount} browsing now` : networkStats?.live ? 'Live network' : 'Waiting for live feed'}</span><span>Last {period}</span></div>
        </div>
      </section>

      <section id="projects" className="border-y border-[#ebedea] bg-[#f4f5f2] py-[68px] sm:py-[82px]">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <div className="mb-9 flex flex-col justify-between gap-5 sm:mb-11 sm:flex-row sm:items-end">
            <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-[.17em] text-emerald-700">The Lornet network</p><h2 className="text-[34px] font-semibold tracking-[-.055em] sm:text-[42px]">Made to be explored.</h2><p className="mt-3 max-w-[500px] text-[14px] leading-6 text-[#727b74]">Every project is open to everyone. Find something useful, follow an idea, or simply see what we&apos;re building.</p></div>
            <div className="flex items-center gap-2 pb-1 text-[12px] text-[#7a837c]"><Globe2 size={15} className="text-emerald-700" /> {visibleProjects.length} projects across the network</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project) => <article key={project.id} className="group flex min-h-[246px] flex-col rounded-2xl border border-[#e5e9e4] bg-white p-5 shadow-[0_2px_8px_#15201606] transition duration-300 hover:-translate-y-1 hover:border-[#cbd8cd] hover:shadow-[0_14px_35px_#1520160d] sm:p-6">
              <div className="flex items-center justify-between"><span className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusStyles[project.status] || statusStyles.Live}`}>{project.status}</span><span className="flex size-9 items-center justify-center rounded-xl bg-[#f5f7f4] text-[#707b73] group-hover:bg-emerald-50 group-hover:text-emerald-700"><Box size={17} strokeWidth={1.7} /></span></div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.13em] text-[#9aa19c]">{project.category}</p>
              <h3 className="mt-1 text-[19px] font-semibold tracking-[-.035em]">{project.title}</h3>
              <p className="mt-2 min-h-[42px] text-[12px] leading-[1.7] text-[#778078]">{project.description}</p>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#eff1ee] pt-4">
                <span className="text-[11px] text-[#8a938c]"><strong className="font-semibold text-[#4d5951]">{Number(networkStats?.projectClicks?.[project.id] || 0).toLocaleString()}</strong> clicks</span>
                <a href={safeProjectUrl(project.url)} target={safeProjectUrl(project.url).startsWith('https://') || safeProjectUrl(project.url).startsWith('http://') ? '_blank' : undefined} rel="noopener noreferrer" onClick={(event) => { if (safeProjectUrl(project.url) === '#projects') event.preventDefault(); else visit(project, 'launch') }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700">Go to website <ArrowUpRightFromSquare size={13} /></a>
              </div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 sm:py-[72px]">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[22px] border border-[#e6eae5] bg-white px-6 py-8 shadow-[0_4px_20px_#17251b05] sm:flex-row sm:items-center sm:px-9 sm:py-9">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.15em] text-emerald-700">One connected network</p><h2 className="mt-2 text-[25px] font-semibold tracking-[-.045em]">A little more connected, every day.</h2><p className="mt-2 max-w-[470px] text-[13px] leading-6 text-[#778078]">Lornet brings independent websites and digital projects together in one open, evolving ecosystem.</p></div>
          <Link href="/sign-in" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#e4e9e4] bg-[#fbfcfb] px-4 text-[12px] font-semibold text-[#28352c] transition hover:border-[#b9cbbd]">Sign in to Lornet <ArrowUpRight size={14} /></Link>
        </div>
        <footer className="flex flex-col items-start justify-between gap-3 py-8 text-[11px] text-[#8a938c] sm:flex-row sm:items-center"><span className="font-semibold tracking-[-.03em] text-[#556057]">lornet<span className="text-emerald-600">.</span></span><span>Independent projects. Shared possibility.</span><span>Usage analytics record visitor IP, browser, and device data.</span><span>© {new Date().getFullYear()} Lornet</span></footer>
      </section>
    </main>
  )
}
