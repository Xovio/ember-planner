import { addDays, startOfWeek } from 'date-fns'
import { createDefaultData, type AppData, type Board, type BoardNote, type CalendarColor, type CalendarEvent, type Todo } from '@shared/types'
import { localDate } from '@shared/todo'

/**
 * Fictional sample data relative to the current week, used by the web build
 * with `?demo` (screenshots, trying the app without touching real data).
 */
export function createDemoData(now = new Date()): AppData {
  const data = createDefaultData()
  const week = startOfWeek(now, { weekStartsOn: 1 })
  const at = (day: number, h: number, m = 0): string => {
    const d = addDays(week, day)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }
  const dayStart = (day: number): string => addDays(week, day).toISOString()
  const date = (day: number): string => localDate(addDays(week, day))
  const ts = now.toISOString()
  let n = 0
  const ev = (calendarId: string, title: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: `demo-ev-${++n}`,
    calendarId,
    title,
    start,
    end,
    allDay: false,
    reminders: [10],
    recurrence: null,
    createdAt: ts,
    updatedAt: ts,
    ...extra
  })
  const todo = (title: string, extra: Partial<Todo> = {}): Todo => ({
    id: `demo-todo-${++n}`,
    title,
    listId: 'inbox',
    priority: 0,
    subtasks: [],
    done: false,
    createdAt: ts,
    updatedAt: ts,
    ...extra
  })

  data.calendars.push({
    id: 'd:900',
    name: 'Die Runde',
    color: 'aqua',
    visible: true,
    readOnly: true,
    defaultReminders: [],
    external: { provider: 'discord', id: '900' }
  })

  data.events = [
    ev('work', 'Stand-up', at(0, 9), at(0, 9, 30), { recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 2, 4] } }),
    ev('personal', 'Zahnarzt', at(0, 11), at(0, 12), { location: 'Praxis am Markt' }),
    ev('dnd', 'Session-Prep: Kapitel 4', at(0, 14), at(0, 16, 30)),
    ev('personal', 'Laufen', at(0, 18), at(0, 19), { recurrence: { freq: 'weekly', interval: 1, byWeekday: [0, 3] } }),
    ev('work', 'Planungsrunde', at(1, 10), at(1, 11, 30)),
    ev('work', 'Code-Review', at(1, 11), at(1, 12)),
    ev('personal', 'Mittag mit Sam', at(1, 12, 30), at(1, 13, 30), { location: 'Nudelbar' }),
    ev('work', 'Fokuszeit: Roadmap', at(2, 13), at(2, 15, 30)),
    ev('personal', 'Einkaufen', at(2, 17), at(2, 18)),
    ev('work', 'Kundentermin', at(3, 10), at(3, 11)),
    ev('dnd', 'Weltenbau: Karte der Küste', at(3, 15), at(3, 17)),
    ev('dnd', 'DnD-Session #12', at(4, 19), at(4, 23), {
      location: 'Discord',
      discord: { guildId: '900', eventId: 'demo-d1', own: true, kind: 'voice', status: 1, userCount: 4 },
      templateId: 'demo-tpl-dnd'
    }),
    // someone else's events on the Discord server
    ev('d:900', 'One-Shot: Die Glocke von Varn', at(5, 15), at(5, 19), {
      location: '🔊 Taverne',
      reminders: [],
      external: { provider: 'discord', id: 'demo-d2', calendarId: '900' },
      discord: { guildId: '900', eventId: 'demo-d2', own: false, status: 1, userCount: 6 }
    }),
    ev('d:900', 'Würfelabend', at(2, 20), at(2, 22), {
      location: '🔊 Taverne',
      reminders: [],
      external: { provider: 'discord', id: 'demo-d3', calendarId: '900' },
      discord: { guildId: '900', eventId: 'demo-d3', own: false, status: 4, userCount: 2 }
    }),
    ev('personal', 'Brunch', at(5, 11), at(5, 13)),
    ev('dnd', 'Lore-Woche: Nordreich', dayStart(2), dayStart(5), { allDay: true, reminders: [] }),
    ev('personal', 'Geburtstag Mia', dayStart(6), dayStart(7), { allDay: true, reminders: [1440], recurrence: { freq: 'yearly', interval: 1 } })
  ]
  // some history for the heatmap
  for (let i = 1; i < 160; i++) {
    if (i % 3 && i % 5) continue
    const s = addDays(week, -i)
    s.setHours(9 + (i % 8), 0, 0, 0)
    data.events.push(ev(['personal', 'dnd', 'work'][i % 3], 'Termin', s.toISOString(), new Date(s.getTime() + 3600000).toISOString()))
  }

  data.todos = [
    todo('Steuererklärung abschicken', { hardDeadline: date(-2), categoryId: 'cat-private', priority: 3 }),
    todo('NPC-Steckbriefe schreiben', {
      softDeadline: date(1),
      hardDeadline: date(4),
      listId: 'campaigns',
      categoryId: 'cat-dnd',
      priority: 2,
      estimateMin: 120,
      subtasks: [
        { id: 's1', title: 'Hafenmeisterin', done: true },
        { id: 's2', title: 'Schmugglerboss', done: false },
        { id: 's3', title: 'Orakel', done: false }
      ]
    }),
    todo('Angebot an Kunden schicken', { hardDeadline: date(0), listId: 'projects', categoryId: 'cat-project', priority: 3 }),
    todo('Karte der Küste zeichnen', { softDeadline: date(-1), hardDeadline: date(9), listId: 'campaigns', categoryId: 'cat-dnd', estimateMin: 180 }),
    todo('Roadmap Q1 entwerfen', { softDeadline: date(7), hardDeadline: date(11), listId: 'projects', categoryId: 'cat-project' }),
    todo('Wohnung aufräumen', { softDeadline: date(5), categoryId: 'cat-home', estimateMin: 60 }),
    todo('Loot-Tabelle bauen', { softDeadline: date(3), hardDeadline: date(8), listId: 'campaigns', categoryId: 'cat-dnd', priority: 2, estimateMin: 90 }),
    todo('Neue Würfel bestellen', { categoryId: 'cat-dnd' }),
    todo('Pflanzen umtopfen', { categoryId: 'cat-home', priority: 1 })
  ]
  for (let i = 1; i < 60; i++) {
    if (i % 2 && i % 7) continue
    const d = addDays(now, -i)
    data.todos.push(todo(`Erledigt ${i}`, { done: true, doneAt: d.toISOString(), categoryId: 'cat-private' }))
  }
  data.todos.push(todo('Rechnung bezahlen', { done: true, doneAt: ts, categoryId: 'cat-private' }))

  // time block for one ToDo
  const block = ev('personal', 'NPC-Steckbriefe schreiben', at(2, 9, 30), at(2, 11, 30), { todoId: data.todos[1].id })
  data.events.push(block)
  data.todos[1].linkedEventId = block.id

  data.boards = [demoBoard(ts)]
  // weekly session: the next one shows as a grey placeholder ("noch planen")
  data.templates = [
    {
      id: 'demo-tpl-dnd',
      name: 'DnD-Session',
      title: 'DnD-Session',
      calendarId: 'dnd',
      allDay: false,
      startTime: '19:00',
      durationMin: 240,
      location: 'Discord',
      reminders: [60],
      rhythm: { weekday: (new Date(at(4, 19)).getDay() + 6) % 7, everyWeeks: 1 },
      discord: { guildId: '900', kind: 'voice' }
    }
  ]
  return data
}

/** brainstorm for the next campaign arc */
function demoBoard(ts: string): Board {
  let n = 0
  const note = (x: number, y: number, text: string, color: CalendarColor, extra: Partial<BoardNote> = {}): BoardNote => ({
    id: `demo-note-${++n}`,
    x,
    y,
    w: 200,
    text,
    color,
    votes: 0,
    ...extra
  })
  const notes = [
    note(40, 60, 'Versunkene Stadt unter dem Leuchtturm', 'aqua', { votes: 3 }),
    note(300, 40, 'Eingang nur bei Ebbe erreichbar', 'aqua'),
    note(300, 150, 'Glocken läuten unter Wasser', 'aqua', { votes: 1 }),
    note(40, 190, 'Alte Zollstation als Schmugglerversteck', 'aqua'),
    note(620, 60, 'Leuchtturmwärterin Maren\nweiß mehr, als sie sagt', 'violet', { votes: 2 }),
    note(880, 60, 'Kapitän Ostrand – will die Stadt plündern', 'violet'),
    note(620, 190, 'Ein Kind, das im Traum die Glocken hört', 'violet', { votes: 2 }),
    note(40, 420, 'Wer hat die Stadt versenkt – und warum?', 'orange'),
    note(300, 420, 'Wie lange halten Wasseratmungs-Tränke?', 'orange'),
    note(620, 420, 'Karte der Küste zeichnen', 'red', { action: true }),
    note(880, 420, 'Glockengeräusch als Soundeffekt suchen', 'red', { action: true })
  ]
  const id = (i: number): string => `demo-note-${i}`
  return {
    id: 'demo-board-1',
    title: 'Arc 3: Die versunkene Stadt',
    notes,
    frames: [
      { id: 'demo-frame-1', x: 10, y: 10, w: 520, h: 300, title: 'Schauplätze', color: 'aqua' },
      { id: 'demo-frame-2', x: 590, y: 10, w: 520, h: 300, title: 'NPCs', color: 'violet' },
      { id: 'demo-frame-3', x: 10, y: 370, w: 520, h: 170, title: 'Offene Fragen', color: 'orange' }
    ],
    edges: [
      { id: 'demo-edge-1', from: id(1), to: id(2) },
      { id: 'demo-edge-2', from: id(1), to: id(3) },
      { id: 'demo-edge-3', from: id(5), to: id(7) },
      { id: 'demo-edge-4', from: id(3), to: id(7) }
    ],
    createdAt: ts,
    updatedAt: ts
  }
}
