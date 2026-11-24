import type { CalendarColor } from '@shared/types'

export interface ThemeInfo {
  id: string
  name: string
  description: string
  dark: boolean
  /** preview swatches for the settings page */
  swatches: string[]
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'ember',
    name: 'Ember',
    description: 'Dunkel, warm, mit Karminrot',
    dark: true,
    swatches: ['#15100e', '#231a17', '#e5484d', '#ff8b83']
  },
  {
    id: 'rose',
    name: 'Rosé',
    description: 'Hell, warmes Off-White, Rot-Akzent',
    dark: false,
    swatches: ['#f6efec', '#ffffff', '#d93a3f', '#b52a30']
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dunkel, kühles Blau',
    dark: true,
    swatches: ['#0d1220', '#1a2133', '#5b8def', '#8fb2ff']
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Dunkel, ruhiges Grün',
    dark: true,
    swatches: ['#0e1511', '#1a251e', '#3fb27f', '#6fd3a0']
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Hell, neutral, blauer Akzent',
    dark: false,
    swatches: ['#f4f4f1', '#ffffff', '#2f6fed', '#2459c9']
  }
]

export function nextThemeId(current: string): string {
  const i = THEMES.findIndex((t) => t.id === current)
  return THEMES[(i + 1) % THEMES.length].id
}

export const COLOR_NAMES: Record<CalendarColor, string> = {
  red: 'Rot',
  blue: 'Blau',
  orange: 'Orange',
  aqua: 'Türkis',
  yellow: 'Bernstein',
  violet: 'Violett',
  magenta: 'Magenta',
  green: 'Grün'
}

export const calVar = (c: CalendarColor): string => `var(--cal-${c})`

export function applyTheme(id: string): { color: string; symbolColor: string } {
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]
  document.documentElement.dataset.theme = theme.id
  const cs = getComputedStyle(document.documentElement)
  return {
    color: cs.getPropertyValue('--bg').trim() || '#15100e',
    symbolColor: cs.getPropertyValue('--text-2').trim() || '#c4b0a8'
  }
}
