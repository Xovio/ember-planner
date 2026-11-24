import { useStore } from '../store'
import { getPage, usePages } from './registry'

/** renders the registered page for the current `page`; unknown ids (e.g. a removed plugin) fall back to Planen */
export function ActivePage(): React.JSX.Element | null {
  const page = useStore((s) => s.page)
  usePages() // re-render when pages are added or removed
  const def = getPage(page) ?? getPage('plan')
  if (!def) return null
  const Comp = def.component
  return <Comp key={def.id} />
}
