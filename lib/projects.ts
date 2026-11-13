import { createClient } from '@/lib/supabase/server'

export type Project = {
  id: string
  title: string
  slug: string
  description: string
  url: string
  category: string
  status: 'Live' | 'Beta' | 'Popular'
  visible: boolean
  launches: number
}

export const demoProjects: Project[] = [
  { id: 'demo-1', title: 'Northstar Studio', slug: 'northstar-studio', description: 'A digital home for thoughtful brands and the people behind them.', url: 'https://northstar.studio', category: 'Studio', status: 'Popular', visible: true, launches: 0 },
  { id: 'demo-2', title: 'Fieldnotes', slug: 'fieldnotes', description: 'A living archive of ideas, places, and creative practice.', url: 'https://fieldnotes.world', category: 'Culture', status: 'Live', visible: true, launches: 0 },
  { id: 'demo-3', title: 'Common Ground', slug: 'common-ground', description: 'Tools and stories for communities building a better future.', url: 'https://common-ground.community', category: 'Community', status: 'Live', visible: true, launches: 0 },
  { id: 'demo-4', title: 'Form & Function', slug: 'form-function', description: 'An independent journal on objects made to last.', url: 'https://formandfunction.design', category: 'Editorial', status: 'Beta', visible: true, launches: 0 },
  { id: 'demo-5', title: 'Open Atlas', slug: 'open-atlas', description: 'A collaborative map of the places that bring us together.', url: 'https://openatlas.org', category: 'Open data', status: 'Popular', visible: true, launches: 0 },
  { id: 'demo-6', title: 'Good Measure', slug: 'good-measure', description: 'Small, useful tools for making everyday work feel lighter.', url: 'https://goodmeasure.tools', category: 'Tools', status: 'Live', visible: true, launches: 0 },
]

export async function getProjects(): Promise<Project[]> {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) || !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)) return demoProjects
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('projects').select('id,title,slug,description,url,category,status,visible,launches').eq('visible', true).order('created_at')
    if (error) return demoProjects
    return (data || []) as Project[]
  } catch {
    return demoProjects
  }
}
