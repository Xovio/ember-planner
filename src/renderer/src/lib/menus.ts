import { addDays, nextMonday, nextSaturday } from 'date-fns'
import type { Priority } from '@shared/types'
import { localDate } from '@shared/todo'
import { isEventLocked, roundUp, useStore, type MenuItem } from '../store'
import { api } from './api'
import { calVar } from './theme'
import { PRIORITY_LABEL } from './todos'

/** quick "Wunschtag" presets (soft deadline) */
export function dayPresets(): { label: string; date: string; hint: string }[] {
  const t = new Date()
  return [
    { label: 'Heute', date: localDate(t), hint: 'H' },
    { label: 'Morgen', date: localDate(addDays(t, 1)), hint: 'M' },
    { label: 'Wochenende', date: localDate(t.getDay() === 6 ? t : nextSaturday(t)), hint: '' },
    { label: 'Nächste Woche', date: localDate(nextMonday(t)), hint: 'W' }
  ]
}

/** Context menu for one or more ToDos (the same actions as the hover buttons and the bulk bar). */
export function todoMenu(ids: string[]): MenuItem[] {
  const st = useStore.getState()
  const data = st.data!
  const todos = data.todos.filter((t) => ids.includes(t.id))
  if (todos.length === 0) return []
  const one = todos.length === 1 ? todos[0] : null
  const allDone = todos.every((t) => t.done)
  const n = todos.length > 1 ? `${todos.length} ToDos` : 'ToDo'

  const items: MenuItem[] = [
    { label: allDone ? 'Wieder öffnen' : 'Erledigt', hint: 'Leertaste', action: () => st.toggleTodos(ids, !allDone) },
    ...(one ? [{ label: 'Bearbeiten', hint: 'Enter', action: () => st.selectTodo(one.id) }] : []),
    { separator: true },
    {
      label: 'Wunschtag (weich)',
      items: [
        ...dayPresets().map((p) => ({
          label: p.label,
          action: () => st.updateTodos(ids, { softDeadline: p.date }, `${n}: Wunschtag ${p.label.toLowerCase()}`)
        })),
        { separator: true },
        { label: 'Entfernen', action: () => st.updateTodos(ids, { softDeadline: undefined }, `${n}: Wunschtag entfernt`) }
      ]
    },
    {
      label: 'Harte Deadline',
      items: [
        ...dayPresets().map((p) => ({
          label: p.label,
          action: () => st.updateTodos(ids, { hardDeadline: p.date }, `${n}: Deadline ${p.label.toLowerCase()}`)
        })),
        { separator: true },
        { label: 'Entfernen', action: () => st.updateTodos(ids, { hardDeadline: undefined }, `${n}: Deadline entfernt`) }
      ]
    },
    ...(one && !one.done
      ? [
          {
            label: 'Jetzt einplanen',
            hint: 'nächste halbe Stunde',
            action: () => {
              const s = roundUp(new Date())
              st.scheduleTodo(one.id, s, new Date(s.getTime() + (one.estimateMin ?? data.settings.defaultDurationMin) * 60000))
            }
          }
        ]
      : []),
    { separator: true },
    {
      label: 'Priorität',
      items: PRIORITY_LABEL.map((l, p) => ({
        label: l,
        checked: !!one && one.priority === p,
        hint: p ? String(p) : '0',
        action: () => st.updateTodos(ids, { priority: p as Priority }, `${n}: Priorität ${l.toLowerCase()}`)
      }))
    },
    {
      label: 'Kategorie',
      items: [
        ...data.categories.map((c) => ({
          label: c.name,
          swatch: calVar(c.color),
          checked: !!one && one.categoryId === c.id,
          action: () => st.updateTodos(ids, { categoryId: c.id }, `${n}: Kategorie ${c.name}`)
        })),
        { separator: true },
        { label: 'Keine', action: () => st.updateTodos(ids, { categoryId: undefined }, `${n}: Kategorie entfernt`) }
      ]
    },
    {
      label: 'In Liste verschieben',
      items: data.lists.map((l) => ({
        label: l.name,
        swatch: calVar(l.color),
        checked: !!one && one.listId === l.id,
        action: () => st.updateTodos(ids, { listId: l.id }, `${n} nach „${l.name}“ verschoben`)
      }))
    },
    { separator: true },
    { label: 'In den Papierkorb', hint: 'Entf', danger: true, action: () => st.deleteTodos(ids) }
  ]
  return items
}

export function eventMenu(eventId: string, occurrenceStart?: string): MenuItem[] {
  const st = useStore.getState()
  const data = st.data!
  const ev = data.events.find((e) => e.id === eventId)
  if (!ev) return []
  const todo = ev.todoId ? data.todos.find((t) => t.id === ev.todoId) : undefined
  const items: MenuItem[] = [
    { label: 'Bearbeiten', hint: 'Doppelklick', action: () => st.selectEvent(eventId, occurrenceStart) },
    ...(ev.recurrence && occurrenceStart
      ? [
          { label: 'Nur diesen Termin bearbeiten', action: () => st.editOccurrence(eventId, occurrenceStart, 'one') },
          {
            label: 'Diesen und folgende bearbeiten',
            action: () => st.editOccurrence(eventId, occurrenceStart, 'following')
          }
        ]
      : []),
    ...(ev.seriesId && data.events.some((e) => e.id === ev.seriesId)
      ? [{ label: 'Zur Serie', action: () => st.selectEvent(ev.seriesId!) }]
      : []),
    { label: 'Duplizieren', action: () => st.duplicateEvent(eventId) },
    { label: 'Als Vorlage speichern', action: () => st.saveAsTemplate(eventId) },
    ...(!ev.discord &&
    api.discord &&
    !isEventLocked(data, ev) &&
    data.calendars.some((c) => c.external?.provider === 'discord') &&
    new Date(occurrenceStart ?? ev.start).getTime() > Date.now()
      ? [{ label: 'In Discord ankündigen …', action: () => st.openAnnounce(eventId, occurrenceStart) }]
      : []),
    ...(todo ? [{ label: todo.done ? 'ToDo wieder öffnen' : 'ToDo abhaken', action: () => st.toggleTodo(todo.id) }] : []),
    {
      label: 'Kalender',
      items: data.calendars.map((c) => ({
        label: c.name,
        swatch: calVar(c.color),
        checked: c.id === ev.calendarId,
        action: () => st.updateEvent(eventId, { calendarId: c.id })
      }))
    },
    { separator: true }
  ]
  if (ev.recurrence && occurrenceStart) {
    items.push(
      { label: 'Nur diesen Termin löschen', danger: true, action: () => st.deleteEvent(eventId, 'one', occurrenceStart) },
      {
        label: 'Diesen und folgende löschen',
        danger: true,
        action: () => st.deleteEvent(eventId, 'following', occurrenceStart)
      },
      { label: 'Ganze Serie löschen', danger: true, action: () => st.deleteEvent(eventId, 'all') }
    )
  } else {
    items.push({ label: 'Löschen', hint: 'Entf', danger: true, action: () => st.deleteEvent(eventId, 'all') })
  }
  return items
}
