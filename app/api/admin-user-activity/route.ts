import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: allowed, error: roleError } = await supabase.rpc('lornet_is_admin')
  if (roleError || !allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() || ''
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const { data: logs, count, error } = await supabase
    .from('visitor_logs')
    .select('id,project_id,project_title,event_type,ip_address,user_agent,device,created_at,user_id,user_email', { count: 'exact' })
    .eq('user_email', email)
    .order('created_at', { ascending: false })
    .limit(1200)

  if (error) return NextResponse.json({ error: 'Unable to load visitor activity.' }, { status: 500 })
  return NextResponse.json({ email, logs: logs || [], total: count || 0 }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}
