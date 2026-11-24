import { useSyncExternalStore, type ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { WidgetSize } from '@shared/types'

/**
 * Stage 1 of the plugin concept (docs/PLUGINS.md): the app's own pages and overview widgets
 * register here, and the nav rail, page switch, command palette and overview read from here.
 * External plugins will later register through the same calls (via a message bridge).
 */

/** who contributed an entry: 'core' for the app itself, otherwise a plugin id */
export type Source = 'core' | (string & {})

export interface PageDef {
  id: string
  label: string
  icon: LucideIcon
  /** keyboard hint shown in the tooltip */
  hint?: string
  /** sort key; core pages use steps of 10 */
  order: number
  /** 'bottom' sits below the search button, like Optionen */
  position?: 'top' | 'bottom'
  component: ComponentType
  source?: Source
}

export interface WidgetDef {
  id: string
  title: string
  /** one line for the "show again" tray */
  description?: string
  size: WidgetSize
  /** spans two rows, so two half-size widgets fit beside it */
  tall?: boolean
  /** starts hidden until the user shows it */
  defaultHidden?: boolean
  order: number
  component: ComponentType
  source?: Source
}

type Listener = () => void

function createRegistry<T extends { id: string; order: number }>(kind: string) {
  const items = new Map<string, T>()
  const listeners = new Set<Listener>()
  let snapshot: T[] = []

  const emit = (): void => {
    snapshot = [...items.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    listeners.forEach((l) => l())
  }

  return {
    /** add an entry; returns a function that removes it again */
    register(def: T): () => void {
      if (items.has(def.id)) console.warn(`[registry] ${kind} "${def.id}" was registered twice, the last one wins`)
      items.set(def.id, def)
      emit()
      return () => {
        if (items.get(def.id) !== def) return
        items.delete(def.id)
        emit()
      }
    },
    list: (): T[] => snapshot,
    get: (id: string): T | undefined => items.get(id),
    subscribe(l: Listener): () => void {
      listeners.add(l)
      return () => listeners.delete(l)
    }
  }
}

const pages = createRegistry<PageDef>('page')
const widgets = createRegistry<WidgetDef>('widget')

export const registerPage = pages.register
export const registerWidget = widgets.register
export const listPages = pages.list
export const listWidgets = widgets.list
export const getPage = pages.get
export const getWidget = widgets.get

export const usePages = (): PageDef[] => useSyncExternalStore(pages.subscribe, pages.list)
export const useWidgets = (): WidgetDef[] => useSyncExternalStore(widgets.subscribe, widgets.list)
