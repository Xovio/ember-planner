import { useEffect } from 'react'
import { create } from 'zustand'
import { absolutePath, type NoteEntry, type NoteLink, type ObsidianVault } from '@shared/notes'
import { api } from './api'
import { useStore } from '../store'

interface NotesState {
  entries: NoteEntry[]
  /** 'off' = no vault switched on (or browser build) */
  status: 'off' | 'loading' | 'ready'
}

/** the Obsidian note index, kept current by the main process */
export const useNotes = create<NotesState>(() => ({ entries: [], status: 'off' }))

const enabledRefs = (vaults: ObsidianVault[]): { name: string; path: string }[] =>
  vaults.filter((v) => v.enabled).map(({ name, path }) => ({ name, path }))

/** App-level: (re)indexes whenever the chosen vaults change */
export function useNoteIndexSync(): void {
  const vaults = useStore((s) => s.data?.settings.obsidianVaults)
  const key = JSON.stringify(enabledRefs(vaults ?? []))

  useEffect(() => api.obsidian?.onChanged((entries) => useNotes.setState({ entries, status: 'ready' })), [])

  useEffect(() => {
    const refs = JSON.parse(key) as { name: string; path: string }[]
    if (!api.obsidian || !refs.length) {
      useNotes.setState({ entries: [], status: 'off' })
      if (api.obsidian) void api.obsidian.index([])
      return
    }
    let live = true
    useNotes.setState({ status: 'loading' })
    void api.obsidian.index(refs).then((entries) => live && useNotes.setState({ entries, status: 'ready' }))
    return () => {
      live = false
    }
  }, [key])
}

/** opens a linked note in Obsidian; tells the user when that is not possible */
export async function openNote(link: Pick<NoteLink, 'vault' | 'path' | 'title'>): Promise<void> {
  const st = useStore.getState()
  const vaults = enabledRefs(st.data?.settings.obsidianVaults ?? [])
  const abs = absolutePath(link, vaults)
  const ok = abs && api.obsidian ? await api.obsidian.open(abs) : false
  if (!ok)
    st.pushToast({
      kind: 'info',
      title: `„${link.title}“ lässt sich nicht öffnen`,
      body: api.obsidian ? `Der Vault „${link.vault}“ ist in den Optionen nicht eingeschaltet.` : 'Nur in der Desktop-App.'
    })
}
