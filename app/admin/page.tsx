import { notFound } from 'next/navigation'
import { AdminPortal } from '@/components/admin-portal'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: allowed, error } = await supabase.rpc('lornet_is_admin')
  if (error || !allowed) notFound()
  return <AdminPortal />
}
