import { useMemo, useState } from 'react'
import { addDays, startOfDay } from 'date-fns'
import { CalendarPlus, Check, LayoutGrid, RotateCcw } from 'lucide-react'
import { expandAll } from '@shared/recurrence'
import { useStore, useVisibleEvents } from '../store'
import { fmt, greeting } from '../lib/dates'
import { useNow } from '../components/calendar/TimeGrid'
import { bookedMinutes, fmtHours } from '../components/widgets/metrics'
import { Dashboard } from '../components/widgets/Dashboard'
import { EMPTY_LAYOUT } from '../plugins/layout'

export function TodayPage(): React.JSX.Element {
  const events = useVisibleEvents()
  const openAdd = useStore((s) => s.openAdd)
  const updateSettings = useStore((s) => s.updateSettings)
  const now = useNow()
  const [editing, setEditing] = useState(false)

  const { count, booked } = useMemo(() => {
    const d0 = startOfDay(now)
    const today = expandAll(events, d0, addDays(d0, 1))
    return { count: today.length, booked: bookedMinutes(d0, today) }
  }, [events, now])

  return (
    <div className="today-page">
      <header className="today-hero">
        <div>
          <p className="kicker">{fmt(now, 'EEEE, d. MMMM yyyy')}</p>
          <h1>{greeting(now)}</h1>
          <p className="hero-sub">
            {count === 0
              ? 'Heute ist nichts eingetragen.'
              : `${count} ${count === 1 ? 'Termin' : 'Termine'} heute · ${fmtHours(booked)} verplant`}
          </p>
        </div>
        <div className="today-hero-actions">
          {editing ? (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => updateSettings({ overviewLayout: { ...EMPTY_LAYOUT } })}
                title="Reihenfolge, Größen und ausgeblendete Widgets zurücksetzen"
              >
                <RotateCcw size={15} /> Standard
              </button>
              <button className="btn btn-primary" onClick={() => setEditing(false)}>
                <Check size={16} /> Fertig
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setEditing(true)}
                title="Widgets verschieben, ein- und ausblenden"
              >
                <LayoutGrid size={15} /> Anordnen
              </button>
              <button className="btn btn-primary" onClick={() => openAdd()}>
                <CalendarPlus size={16} /> Neu <kbd>N</kbd>
              </button>
            </>
          )}
        </div>
      </header>

      <Dashboard editing={editing} />
    </div>
  )
}
