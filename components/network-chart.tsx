'use client'

import useSWR from 'swr'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type ActivityPeriod = '24h' | '7d' | '30d'
type Point = { time: string; visits: number; launches: number }
type Stats = { points: Point[]; totalVisits: number; projectClicks: Record<string, number>; live: boolean }
const fetcher = async (url: string): Promise<Stats> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load network activity')
  return response.json()
}
const periodNames: ActivityPeriod[] = ['24h', '7d', '30d']

export function NetworkChart({ period, onPeriodChange }: { period: ActivityPeriod; onPeriodChange: (period: ActivityPeriod) => void }) {
  const { data } = useSWR<Stats>(`/api/public-stats?period=${period}`, fetcher, { refreshInterval: 30000, revalidateOnFocus: true })
  const bucketCount = period === '24h' ? 24 : period === '7d' ? 7 : 30
  const chartData = data?.points?.length
    ? data.points
    : Array.from({ length: bucketCount }, (_, index) => ({ time: String(index + 1), visits: 0, launches: 0 }))
  return (
    <div>
      <div className="mb-2 flex justify-end gap-1" role="group" aria-label="Activity chart time range">
        {periodNames.map((option) => <button key={option} type="button" aria-pressed={period === option} onClick={() => onPeriodChange(option)} className={`rounded-md px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] transition ${period === option ? 'bg-emerald-50 text-emerald-800' : 'text-[#8c958e] hover:bg-[#f5f7f4]'}`}>{option}</button>)}
      </div>
      <div className="h-[220px] w-full" role="img" aria-label={`Network visits and project clicks during the last ${period}, refreshed every 30 seconds`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="launchFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a7f3d0" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#a7f3d0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#edf0ed" strokeDasharray="3 5" />
            <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: '#969d98', fontSize: 10 }} tickMargin={10} interval={period === '24h' ? 5 : period === '7d' ? 0 : 5} />
            <YAxis hide allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e8ece8', boxShadow: '0 8px 30px #0b20100f', fontSize: 12 }} />
            <Area type="monotone" dataKey="visits" name="Network visits" stroke="#059669" strokeWidth={2.5} fill="url(#visitsFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="launches" name="Project clicks" stroke="#9ca9a1" strokeWidth={1.5} fill="url(#launchFill)" activeDot={{ r: 3, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
