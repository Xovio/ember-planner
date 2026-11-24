import { describe, expect, it } from 'vitest'
import { boardFileName, boardOutline, boardToCanvas, boardToMarkdown, borderPoint, contentOf, frameOf, freeSpot, noteHeight } from './board'
import type { Board, BoardNote, Todo } from './types'

const note = (id: string, x: number, y: number, text: string, extra: Partial<BoardNote> = {}): BoardNote => ({
  id,
  x,
  y,
  w: 200,
  text,
  color: 'yellow',
  votes: 0,
  ...extra
})

const board = (p: Partial<Board>): Board => ({
  id: 'b',
  title: 'Arc 3',
  notes: [],
  frames: [],
  edges: [],
  createdAt: '2026-11-23T10:00:00.000Z',
  updatedAt: '2026-11-23T10:00:00.000Z',
  ...p
})

const frames = [
  { id: 'f1', x: 0, y: 0, w: 500, h: 300, title: 'Orte', color: 'aqua' as const },
  { id: 'f2', x: 600, y: 0, w: 500, h: 300, title: 'NPCs', color: 'violet' as const }
]

describe('geometry', () => {
  it('grows notes with their text', () => {
    expect(noteHeight({ text: 'kurz', w: 200 })).toBe(76)
    expect(noteHeight({ text: 'a\nb\nc\nd', w: 200 })).toBeGreaterThan(76)
  })

  it('finds the innermost frame by the top center of a note', () => {
    const inner = { id: 'in', x: 20, y: 20, w: 300, h: 200, title: '', color: 'red' as const }
    expect(frameOf(note('n', 40, 40, 'x'), [...frames, inner])?.id).toBe('in')
    expect(frameOf(note('n', 400, 40, 'x'), [...frames, inner])?.id).toBe('f1')
    expect(frameOf(note('n', 1200, 40, 'x'), frames)).toBeUndefined()
  })

  it('moves notes and nested frames along with a frame', () => {
    const inner = { id: 'in', x: 20, y: 20, w: 300, h: 200, title: '', color: 'red' as const }
    const c = contentOf(frames[0], { notes: [note('a', 40, 40, 'x'), note('b', 700, 40, 'y')], frames: [...frames, inner] })
    expect(c).toEqual({ notes: ['a'], frames: ['in'] })
  })

  it('places new notes below existing ones instead of on top', () => {
    expect(freeSpot([note('a', 0, 0, 'x')], 10, 10)).toEqual({ x: 10, y: 92 })
    expect(freeSpot([note('a', 0, 0, 'x')], 300, 10)).toEqual({ x: 300, y: 10 })
  })

  it('starts arrows on the border of a note', () => {
    expect(borderPoint({ x: 0, y: 0, w: 200, h: 100 }, 500, 50)).toEqual({ x: 200, y: 50 })
    expect(borderPoint({ x: 0, y: 0, w: 200, h: 100 }, 100, -400)).toEqual({ x: 100, y: 0 })
  })
})

describe('boardOutline', () => {
  it('groups by frame, nests by arrows and sorts by votes', () => {
    const b = board({
      frames,
      notes: [
        note('a', 20, 40, 'Leuchtturm'),
        note('b', 20, 150, 'Zollstation', { votes: 2 }),
        note('c', 260, 40, 'Ebbe'),
        note('d', 620, 40, 'Maren'),
        note('e', 1300, 40, 'lose Idee'),
        note('f', 1300, 200, '   ')
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'c' },
        { id: 'e2', from: 'c', to: 'a' }, // cycle is ignored
        { id: 'e3', from: 'a', to: 'd' } // across frames: no nesting
      ]
    })
    const o = boardOutline(b)
    expect(o.groups.map((g) => g.frame?.title ?? null)).toEqual(['Orte', 'NPCs', null])
    const orte = o.groups[0].items
    expect(orte.map((i) => i.note.text)).toEqual(['Zollstation', 'Leuchtturm'])
    expect(orte[1].children.map((i) => i.note.text)).toEqual(['Ebbe'])
    expect(o.groups[2].items.map((i) => i.note.text)).toEqual(['lose Idee']) // empty note skipped
  })

  it('keeps next steps apart', () => {
    const o = boardOutline(board({ notes: [note('a', 0, 0, 'Idee'), note('b', 0, 100, 'Karte zeichnen', { action: true })] }))
    expect(o.groups[0].items.map((i) => i.note.id)).toEqual(['a'])
    expect(o.actions.map((n) => n.id)).toEqual(['b'])
  })
})

describe('boardToMarkdown', () => {
  const b = board({
    frames,
    notes: [
      note('a', 20, 40, 'Leuchtturm\nmit Glocken', { votes: 1 }),
      note('c', 260, 40, 'Ebbe'),
      note('d', 620, 40, 'Maren', { votes: 3 }),
      note('x', 1300, 40, 'Karte zeichnen', { action: true }),
      note('y', 1300, 200, 'Sound suchen', { action: true, todoId: 't1' })
    ],
    edges: [{ id: 'e1', from: 'a', to: 'c' }]
  })
  const todo: Todo = {
    id: 't1',
    title: 'Sound suchen',
    listId: 'inbox',
    priority: 0,
    subtasks: [],
    done: true,
    softDeadline: '2026-11-28',
    createdAt: '',
    updatedAt: ''
  }

  it('writes frontmatter, sections, nesting, votes and Tasks lines', () => {
    expect(boardToMarkdown(b, { todos: [todo] })).toBe(
      [
        '---',
        'title: "Arc 3"',
        'date: 2026-11-23',
        'tags:',
        '  - brainstorm',
        '---',
        '',
        '# Arc 3',
        '',
        '## Orte',
        '',
        '- Leuchtturm (1 Punkt)',
        '  mit Glocken',
        '  - Ebbe',
        '',
        '## NPCs',
        '',
        '- Maren (3 Punkte)',
        '',
        '## Nächste Schritte',
        '',
        '- [ ] Karte zeichnen',
        '- [x] Sound suchen ⏳ 2026-11-28',
        ''
      ].join('\n')
    )
  })

  it('puts the conclusion first and folds the ideas into a callout', () => {
    const md = boardToMarkdown({ ...b, summary: 'Die Stadt ist der Kern des Arcs.' }, { canvasFile: 'Arc 3.canvas' })
    expect(md).toContain('## Fazit\n\nDie Stadt ist der Kern des Arcs.\n\n> [!note]- Alle Ideen\n> ### Orte\n>\n> - Leuchtturm (1 Punkt)')
    expect(md).toContain('> - Maren (3 Punkte)\n\n## Nächste Schritte')
    expect(md.trimEnd().endsWith('![[Arc 3.canvas]]')).toBe(true)
  })

  it('names loose ideas only when there are frames too', () => {
    expect(boardToMarkdown(board({ notes: [note('a', 0, 0, 'Solo')] }))).toContain('# Arc 3\n\n- Solo\n')
  })

  it('makes safe file names', () => {
    expect(boardFileName('Arc 3: Die "versunkene" Stadt?')).toBe('Arc 3 Die versunkene Stadt')
    expect(boardFileName('  ')).toBe('Brainstorm')
  })
})

describe('boardToCanvas', () => {
  it('writes JSON Canvas groups, text nodes and arrows', () => {
    const c = JSON.parse(
      boardToCanvas(
        board({
          frames: [frames[0]],
          notes: [note('a', 20.4, 40, 'Leuchtturm', { votes: 2, color: 'blue' }), note('b', 300, 40, 'Karte', { action: true })],
          edges: [
            { id: 'e1', from: 'a', to: 'b' },
            { id: 'e2', from: 'a', to: 'gone' }
          ]
        })
      )
    )
    expect(c.nodes[0]).toEqual({ id: 'f1', type: 'group', x: 0, y: 0, width: 500, height: 300, label: 'Orte', color: '5' })
    expect(c.nodes[1]).toMatchObject({ id: 'a', type: 'text', x: 20, width: 200, height: 76, text: 'Leuchtturm\n\n●●', color: '#3987e5' })
    expect(c.nodes[2].text).toBe('- [ ] Karte')
    expect(c.edges).toEqual([{ id: 'e1', fromNode: 'a', toNode: 'b', toEnd: 'arrow' }])
  })
})
