import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, CheckCheck, PartyPopper } from 'lucide-react'
import { addDays, startOfDay, startOfWeek } from 'date-fns'
import { deadlineStatus, localDate } from '@shared/todo'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { useCategoryMap, useOpenTodos } from '../../lib/todos'
import { WEEK } from '../../lib/dates'
import { TodoItem } from '../todos/TodoItem'

/** Overdue + due within 2 days. */
export function FocusTodos(): React.JSX.Element {
  const todos = useOpenTodos()
  const setPage = useStore((s) => s.setPage)
  const setTodoView = useStore((s) => s.setTodoView)
  const soon = localDate(addDays(new Date(), 2))
  const focus = useMemo(
    () =>
      todos.filter((t) => {
        const st = deadlineStatus(t)
        if (st === 'overdue' || st === 'soft-missed' || st === 'today') return true
        return (t.hardDeadline && t.hardDeadline <= soon) || (t.softDeadline && t.softDeadline <= soon)
      }),
    [todos, soon]
  )
  const overdue = focus.filter((t) => deadlineStatus(t) === 'overdue').length

  return (
    <section className="card widget focus-card">
      <div className="widget-head">
        <div>
          <h3>Fokus</h3>
          <p>Überfällig und in den nächsten 2 Tagen fällig</p>
        </div>
        {overdue > 0 && (
          <span className="status-pill crit">
            <AlertTriangle size={12} /> {overdue} überfällig
          </span>
        )}
      </div>
      {focus.length === 0 ? (
        <div className="empty-mini with-icon">
          <PartyPopper size={16} /> Nichts Dringendes. Gute Zeit, um vorzuarbeiten.
        </div>
      ) : (
        <div className="todo-list">
          {focus.slice(0, 7).map((t) => (
            <TodoItem key={t.id} todo={t} showList />
          ))}
        </div>
      )}
      <button
        className="link-btn"
        onClick={() => {
          setTodoView('open')
          setPage('todos')
        }}
      >
        Alle ToDos <ArrowRight size={14} />
      </button>
    </section>
  )
}

/** Open ToDos per category: horizontal bars, labels left, counts at the bar end. */
export function CategoryBars(): React.JSX.Element {
  const todos = useOpenTodos()
  const cats = useCategoryMap()
  const setPage = useStore((s) => s.setPage)
  const setTodoCategory = useStore((s) => s.setTodoCategory)
  const setTodoView = useStore((s) => s.setTodoView)

  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of todos) {
      const k = t.categoryId && cats.has(t.categoryId) ? t.categoryId : '_none'
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([id, n]) => {
        const c = cats.get(id)
        return { id, n, name: c?.name ?? 'Ohne Kategorie', color: c ? calVar(c.color) : 'var(--text-3)' }
      })
      .sort((a, b) => b.n - a.n)
  }, [todos, cats])
  const max = Math.max(1, ...rows.map((r) => r.n))

  return (
    <section className="card widget">
      <div className="widget-head">
        <div>
          <h3>Kategorien</h3>
          <p>Offene ToDos je Kategorie</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="empty-mini">Keine offenen ToDos.</p>
      ) : (
        <div className="catbars">
          {rows.map((r) => (
            <button
              key={r.id}
              className="catbar"
              onClick={() => {
                if (r.id === '_none') return
                setTodoView('open')
                setTodoCategory(r.id)
                setPage('todos')
              }}
              title={`${r.name}: ${r.n} offen`}
            >
              <span className="catbar-label">
                <i style={{ background: r.color }} />
                {r.name}
              </span>
              <span className="catbar-track">
                <span className="catbar-fill" style={{ width: `${(r.n / max) * 100}%`, background: r.color }} />
                <span className="catbar-value">{r.n}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/** Stat tiles: open, overdue, done this week (+ 7-day spark columns). */
export function TodoStats(): React.JSX.Element {
  const all = useStore((s) => s.data!.todos)
  const stats = useMemo(() => {
    const open = all.filter((t) => !t.done)
    const overdue = open.filter((t) => deadlineStatus(t) === 'overdue').length
    const weekStart = startOfWeek(new Date(), WEEK).getTime()
    const doneWeek = all.filter((t) => t.done && t.doneAt && new Date(t.doneAt).getTime() >= weekStart).length
    const today = startOfDay(new Date())
    const spark = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6)
      const k = localDate(d)
      return all.filter((t) => t.done && t.doneAt && localDate(new Date(t.doneAt)) === k).length
    })
    return { open: open.length, overdue, doneWeek, spark }
  }, [all])
  const sparkMax = Math.max(1, ...stats.spark)

  return (
    <div className="stat-row">
      <div className="stat card">
        <span className="stat-label">Offen</span>
        <strong>{stats.open}</strong>
      </div>
      <div className={`stat card ${stats.overdue ? 'is-crit' : ''}`}>
        <span className="stat-label">
          {stats.overdue > 0 && <AlertTriangle size={12} />} Überfällig
        </span>
        <strong>{stats.overdue}</strong>
      </div>
      <div className="stat card">
        <span className="stat-label">
          <CheckCheck size={12} /> Erledigt diese Woche
        </span>
        <div className="stat-spark-row">
          <strong>{stats.doneWeek}</strong>
          <span className="spark" aria-label="Erledigt pro Tag, letzte 7 Tage">
            {stats.spark.map((n, i) => (
              <i key={i} className={i === 6 ? 'cur' : ''} style={{ height: `${Math.max(8, (n / sparkMax) * 100)}%` }} title={`${n}`} />
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
