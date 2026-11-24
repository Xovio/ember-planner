import { useEffect, useState } from 'react'
import { Archive, CalendarDays, Download, FileJson, FileText, FolderOpen, History, Upload } from 'lucide-react'
import { parseDataJson, parseTasksMarkdown, toDataJson, toICS, toTasksMarkdown } from '@shared/transfer'
import { localDate } from '@shared/todo'
import { useStore } from '../store'
import { api, type BackupInfo } from '../lib/api'
import { fmt } from '../lib/dates'

const JSON_FILTER = [{ name: 'Ember-Planner-Sicherung', extensions: ['json'] }]
const MD_FILTER = [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]

/** Options → Daten: automatic backups, export and import. Everything restores with Strg+Z. */
export function DataSection(): React.JSX.Element {
  const toast = useStore((s) => s.pushToast)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const desktop = api.kind === 'electron'

  const reload = (): void => void api.listBackups().then(setBackups)
  useEffect(reload, [])

  // slim toasts show one line
  const info = (title: string, body?: string): void => toast({ kind: 'info', title: body ? `${title} – ${body}` : title })
  const fail = (err: unknown): void => info('Das hat nicht geklappt', err instanceof Error ? err.message : String(err))

  const exportFile = async (name: string, content: string, filters: typeof JSON_FILTER, what: string): Promise<void> => {
    try {
      const path = await api.saveFile(name, content, filters)
      if (path) info(`${what} exportiert`)
    } catch (err) {
      fail(err)
    }
  }

  const today = localDate(new Date())
  const data = (): NonNullable<ReturnType<typeof useStore.getState>['data']> => useStore.getState().data!

  const restore = async (b: BackupInfo): Promise<void> => {
    try {
      const next = parseDataJson(await api.readBackup(b.file))
      useStore.getState().replaceData(next, `Sicherung vom ${fmt(new Date(b.at), 'd. MMM, HH:mm')} wiederhergestellt`)
    } catch (err) {
      fail(err)
    }
  }

  const importJson = async (): Promise<void> => {
    try {
      const file = await api.openFile(JSON_FILTER)
      if (!file) return
      useStore.getState().replaceData(parseDataJson(file.content), `„${file.name}“ importiert`)
    } catch (err) {
      fail(err)
    }
  }

  const importMarkdown = async (): Promise<void> => {
    try {
      const file = await api.openFile(MD_FILTER)
      if (!file) return
      const todos = parseTasksMarkdown(file.content, data().categories)
      if (!todos.length) return info('Keine Aufgaben gefunden', 'Erwartet werden Zeilen wie „- [ ] Aufgabe 📅 2026-12-01“')
      useStore.getState().importTodos(todos, `${todos.length} ToDos aus „${file.name}“ importiert`)
    } catch (err) {
      fail(err)
    }
  }

  return (
    <section className="settings-section">
      <h2>Daten</h2>

      <div className="settings-row">
        <div className="settings-label">
          <span>Automatische Sicherung</span>
          <small>
            {desktop
              ? 'Einmal täglich eine Kopie aller Daten; die letzten 14 Sicherungen bleiben erhalten'
              : 'Nur in der Desktop-App'}
          </small>
        </div>
        {desktop && (
          <div className="settings-control">
            <button
              className="btn btn-ghost sm"
              onClick={() =>
                void api.createBackup().then(() => {
                  reload()
                  info('Sicherung erstellt')
                })
              }
            >
              <Archive size={14} /> Jetzt sichern
            </button>
            <button className="btn btn-ghost sm" onClick={() => void api.openBackupFolder()}>
              <FolderOpen size={14} /> Ordner
            </button>
          </div>
        )}
      </div>

      {desktop && backups.length > 0 && (
        <div className="backup-list">
          {backups.slice(0, 7).map((b) => (
            <div className="backup-row" key={b.file}>
              <History size={14} />
              <span>
                {fmt(new Date(b.at), 'EEEE, d. MMM yyyy · HH:mm')}
                {!b.auto && <em> · manuell</em>}
              </span>
              <small>{Math.max(1, Math.round(b.size / 1024))} KB</small>
              <button className="btn btn-ghost sm" onClick={() => void restore(b)}>
                Wiederherstellen
              </button>
            </div>
          ))}
          <p className="data-note">Wiederherstellen ersetzt alle Daten – mit Strg+Z geht es zurück.</p>
        </div>
      )}

      <div className="settings-row">
        <div className="settings-label">
          <span>Exportieren</span>
          <small>Alles als JSON, Termine als Kalenderdatei (.ics), ToDos als Markdown im Obsidian-Tasks-Format</small>
        </div>
        <div className="settings-control wrap">
          <button
            className="btn btn-ghost sm"
            onClick={() => void exportFile(`ember-planner-${today}.json`, toDataJson(data()), JSON_FILTER, 'Alle Daten')}
          >
            <FileJson size={14} /> JSON
          </button>
          <button
            className="btn btn-ghost sm"
            onClick={() =>
              void exportFile(`ember-planner-${today}.ics`, toICS(data()), [{ name: 'iCalendar', extensions: ['ics'] }], 'Termine')
            }
          >
            <CalendarDays size={14} /> ICS
          </button>
          <button
            className="btn btn-ghost sm"
            onClick={() => void exportFile(`ember-todos-${today}.md`, toTasksMarkdown(data()), MD_FILTER, 'ToDos')}
          >
            <FileText size={14} /> Markdown
          </button>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-label">
          <span>Importieren</span>
          <small>JSON ersetzt alle Daten · Markdown fügt Aufgaben im Tasks-Format zum Eingang hinzu · beides rückgängig machbar</small>
        </div>
        <div className="settings-control wrap">
          <button className="btn btn-ghost sm" onClick={() => void importJson()}>
            <Upload size={14} /> JSON
          </button>
          <button className="btn btn-ghost sm" onClick={() => void importMarkdown()}>
            <Download size={14} /> Markdown
          </button>
        </div>
      </div>
    </section>
  )
}
