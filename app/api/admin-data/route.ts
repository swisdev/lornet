import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: allowed, error: roleError } = await supabase.rpc('lornet_is_admin')
  if (roleError || !allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: projects, error: projectsError }, { data: logs, error: logsError }, { count: totalVisits, error: countError }, role] = await Promise.all([
    supabase.from('projects').select('id,title,slug,description,url,category,status,visible,launches,created_at').order('created_at', { ascending: false }),
    supabase.from('visitor_logs').select('id,project_id,project_title,event_type,ip_address,user_agent,device,created_at').order('created_at', { ascending: false }).limit(1200),
    supabase.from('visitor_logs').select('id', { count: 'exact', head: true }),
    user.email?.toLowerCase() === 'lolfaw99@gmail.com'
      ? supabase.from('admins').select('email,created_at').order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (projectsError || logsError || countError) return NextResponse.json({ error: 'Unable to load network data' }, { status: 500 })

  let clickCounts: (readonly [string, number])[]
  try {
    clickCounts = await Promise.all((projects || []).map(async (project) => {
      const { count, error } = await supabase.from('visitor_logs').select('id', { count: 'exact', head: true }).eq('project_id', project.id).eq('event_type', 'launch')
      if (error) throw error
      return [project.id, count || 0] as const
    }))
  } catch {
    return NextResponse.json({ error: 'Unable to load click totals' }, { status: 500 })
  }
  const clicksByProject = Object.fromEntries(clickCounts)
  return NextResponse.json({
    projects: (projects || []).map((project) => ({ ...project, launches: clicksByProject[project.id] || 0 })),
    logs: logs || [],
    admins: role.data || [],
    role: user.email?.toLowerCase() === 'lolfaw99@gmail.com' ? 'owner' : 'admin',
    totalVisits: totalVisits || 0,
  })
}
