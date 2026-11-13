import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const projectIdPattern = /^[0-9a-f-]{36}$/i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = typeof body.projectId === 'string' && projectIdPattern.test(body.projectId) ? body.projectId : null
    const title = typeof body.title === 'string' ? body.title.slice(0, 160) : ''
    const eventType = body.eventType === 'launch' ? 'launch' : 'visit'
    if (!title || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ipAddress = forwardedFor || request.headers.get('x-real-ip') || ''
    const userAgent = request.headers.get('user-agent') || ''
    const device = /mobile|android|iphone/i.test(userAgent) ? 'Mobile' : /ipad|tablet/i.test(userAgent) ? 'Tablet' : 'Desktop'
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { error } = await supabase.rpc('lornet_track_visit', {
      p_project_id: projectId,
      p_project_title: title,
      p_event_type: eventType,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_device: device,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
