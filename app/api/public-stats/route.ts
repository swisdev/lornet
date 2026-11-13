import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 0

const ranges = {
  '24h': { buckets: 24, duration: 60 * 60 * 1000, interval: 'hour' },
  '7d': { buckets: 7, duration: 24 * 60 * 60 * 1000, interval: 'day' },
  '30d': { buckets: 30, duration: 24 * 60 * 60 * 1000, interval: 'day' },
} as const

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period')
  const range = period && period in ranges ? ranges[period as keyof typeof ranges] : ranges['24h']
  const empty = { points: [], totalVisits: 0, projectClicks: {}, live: false }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return NextResponse.json(empty)

  const supabase = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const now = Date.now()
  const since = new Date(now - range.buckets * range.duration).toISOString()
  const [{ data: activity, count, error }, { data: projects, error: projectError }] = await Promise.all([
    supabase.from('visitor_logs').select('event_type,created_at', { count: 'exact' }).gte('created_at', since).order('created_at', { ascending: true }).limit(10000),
    supabase.from('projects').select('id').eq('visible', true),
  ])
  if (error || projectError) return NextResponse.json(empty)

  const points = Array.from({ length: range.buckets }, (_, index) => {
    const bucketStart = new Date(now - (range.buckets - 1 - index) * range.duration)
    const bucketKey = range.interval === 'hour'
      ? `${bucketStart.getFullYear()}-${bucketStart.getMonth()}-${bucketStart.getDate()}-${bucketStart.getHours()}`
      : `${bucketStart.getFullYear()}-${bucketStart.getMonth()}-${bucketStart.getDate()}`
    const bucketActivity = (activity || []).filter((log) => {
      const date = new Date(log.created_at)
      const logKey = range.interval === 'hour'
        ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`
        : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      return logKey === bucketKey
    })
    return {
      time: range.interval === 'hour'
        ? bucketStart.toLocaleTimeString('en', { hour: '2-digit', hour12: false })
        : bucketStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      visits: bucketActivity.filter((log) => log.event_type === 'visit').length,
      launches: bucketActivity.filter((log) => log.event_type === 'launch').length,
    }
  })

  const counts = await Promise.all((projects || []).map(async ({ id }) => {
    const { count: clicks } = await supabase.from('visitor_logs').select('id', { count: 'exact', head: true }).eq('project_id', id).eq('event_type', 'launch')
    return [id, clicks || 0] as const
  }))
  return NextResponse.json({ points, totalVisits: count || 0, projectClicks: Object.fromEntries(counts), live: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
