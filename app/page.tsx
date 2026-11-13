import { PublicHub } from '@/components/public-hub'
import { getProjects } from '@/lib/projects'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export default async function Page() {
  const projects = await getProjects()
  let isSignedIn = false
  let isAdmin = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isSignedIn = Boolean(user)
    if (user) {
      const { data: allowed, error } = await supabase.rpc('lornet_is_admin')
      isAdmin = Boolean(allowed && !error)
    }
  } catch {
    isSignedIn = false
    isAdmin = false
  }
  return <PublicHub initialProjects={projects} initialIsSignedIn={isSignedIn} initialIsAdmin={isAdmin} />
}
