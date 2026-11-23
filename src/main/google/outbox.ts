import type { EventDiff } from '@shared/patch'
import type { AppData, CalendarEvent } from '@shared/types'

/**
 * One event with local changes Google doesn't know yet.
 * `base` is the version Google last had (null = never uploaded), so an upload can PATCH only
 * the fields that changed and tell inserts, moves and deletes apart. Several edits of the same
 * event collapse into one entry.
 */
export interface OutboxEntry {
  localId: string
  base: CalendarEvent | null
  deleted: boolean
  attempts?: number
  lastError?: string
}

export class Outbox {
  private entries = new Map<string, OutboxEntry>()

  constructor(initial: OutboxEntry[] = []) {
    for (const e of initial) this.entries.set(e.localId, e)
  }

  get size(): number {
    return this.entries.size
  }

  list(): OutboxEntry[] {
    return [...this.entries.values()]
  }

  get(localId: string): OutboxEntry | undefined {
    return this.entries.get(localId)
  }

  pendingIds(): Set<string> {
    return new Set(this.entries.keys())
  }

  remove(localId: string): void {
    this.entries.delete(localId)
  }

  clear(): void {
    this.entries.clear()
  }

  /**
   * Records a save from the UI.
   * `synced(calendarId)`: the calendar is a writable Google calendar.
   * Returns true when the outbox changed.
   */
  record(diff: EventDiff, data: AppData, synced: (calendarId: string) => boolean): boolean {
    const calendarExists = new Set(data.calendars.map((c) => c.id))
    let changed = false
    const touch = (id: string, base: CalendarEvent | null): void => {
      const e = this.entries.get(id)
      if (e) {
        // undo of a delete: the event is back, compare against the old base again
        e.deleted = false
      } else {
        this.entries.set(id, { localId: id, base, deleted: false })
      }
      changed = true
    }

    for (const ev of diff.added) {
      if (synced(ev.calendarId) || this.entries.has(ev.id)) touch(ev.id, null)
    }
    for (const { before, after } of diff.changed) {
      if (synced(before.calendarId) || synced(after.calendarId) || this.entries.has(after.id)) {
        touch(after.id, wasUploaded(before) ? before : null)
      }
    }
    for (const ev of diff.removed) {
      // the whole calendar was removed locally (switched off or deleted here): nothing to delete at Google
      if (!calendarExists.has(ev.calendarId)) {
        if (this.entries.delete(ev.id)) changed = true
        continue
      }
      const e = this.entries.get(ev.id)
      if (e) {
        if (e.base) e.deleted = true
        else this.entries.delete(ev.id) // created and removed before it ever reached Google
        changed = true
      } else if (synced(ev.calendarId) && wasUploaded(ev)) {
        this.entries.set(ev.id, { localId: ev.id, base: ev, deleted: true })
        changed = true
      }
    }
    return changed
  }
}

const wasUploaded = (ev: CalendarEvent): boolean => ev.external?.provider === 'google' && !!ev.external.id
