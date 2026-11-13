import { PublicHub } from '@/components/public-hub'
import { getProjects } from '@/lib/projects'

export const revalidate = 0

export default async function Page() {
  const projects = await getProjects()
  return <PublicHub initialProjects={projects} />
}
