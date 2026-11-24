import { CalendarDays, CheckSquare, LayoutDashboard, Lightbulb, Settings } from 'lucide-react'
import { useStore } from '../store'
import { registerPage, registerWidget } from './registry'
import { CalendarPage } from '../pages/CalendarPage'
import { TodayPage } from '../pages/TodayPage'
import { TodosPage } from '../pages/TodosPage'
import { IdeasPage } from '../pages/IdeasPage'
import { SettingsPage } from '../pages/SettingsPage'
import { RightPanel } from '../components/RightPanel'
import { AgendaWidget, NextUpWidget } from '../components/widgets/TodayWidgets'
import { CategoryBars, FocusTodos, TodoStats } from '../components/widgets/TodoWidgets'
import { WeekLoad } from '../components/widgets/WeekLoad'
import { DeadlineRadar } from '../components/widgets/DeadlineRadar'
import { YearHeatmap } from '../components/widgets/YearHeatmap'
import { PREP_WIDGET_ID } from '@shared/apptime'
import { LAUNCHER_WIDGET_ID } from '@shared/launcher'
import { PrepTracker, PrepTrackerSettings } from '../components/widgets/PrepTracker'
import { Launcher, LauncherSettings } from '../components/widgets/Launcher'
import { GoalsWidget, PointsWidget } from '../components/widgets/GoalWidgets'
import { SESSION_WIDGET_ID, SessionCountdown, SessionCountdownSettings } from '../components/widgets/SessionCountdown'

/** the overview, with the details column when an event or ToDo is selected */
function OverviewPage(): React.JSX.Element {
  const selection = useStore((s) => s.selection)
  return (
    <div className="with-details">
      <TodayPage />
      {selection && <RightPanel tabs={false} />}
    </div>
  )
}

/* ── pages: the nav rail, the page switch and "Gehe zu" in the palette read these ── */
const core = { source: 'core' as const }
registerPage({ ...core, id: 'plan', label: 'Planen', icon: CalendarDays, hint: 'T', order: 10, component: CalendarPage })
registerPage({ ...core, id: 'todos', label: 'ToDos', icon: CheckSquare, order: 20, component: TodosPage })
registerPage({ ...core, id: 'overview', label: 'Übersicht', icon: LayoutDashboard, order: 30, component: OverviewPage })
registerPage({ ...core, id: 'ideas', label: 'Ideen', icon: Lightbulb, order: 40, component: IdeasPage })
registerPage({ ...core, id: 'settings', label: 'Optionen', icon: Settings, order: 1000, position: 'bottom', component: SettingsPage })

/* ── overview widgets, in their default order ── */
registerWidget({ ...core, id: 'todo-stats', title: 'ToDo-Zahlen', description: 'Offen, überfällig, diese Woche erledigt', size: 'full', order: 10, component: TodoStats })
registerWidget({ ...core, id: 'goals', title: 'Wochenziele', description: 'Fortschritt der Wochenziele, Nachfrage bei verpassten Terminen', size: 'half', order: 12, component: GoalsWidget })
registerWidget({ ...core, id: 'points', title: 'Punkte & Level', description: 'Punkte für Erledigtes, Wochenverlauf und Level', size: 'half', order: 14, component: PointsWidget })
registerWidget({ ...core, id: 'agenda', title: 'Tagesplan', description: 'Die Termine von heute', size: 'half', tall: true, order: 20, component: AgendaWidget })
registerWidget({ ...core, id: 'next-up', title: 'Als Nächstes', description: 'Countdown zum nächsten Termin', size: 'half', order: 30, component: NextUpWidget })
registerWidget({ ...core, id: 'week-load', title: 'Wochenauslastung', description: 'Verplante Stunden pro Tag', size: 'half', order: 40, component: WeekLoad })
registerWidget({ ...core, id: SESSION_WIDGET_ID, title: 'Nächste Session', description: 'Countdown zur nächsten D&D-Session mit offenen Vorbereitungs-ToDos', size: 'half', order: 45, component: SessionCountdown, settings: SessionCountdownSettings })
registerWidget({ ...core, id: PREP_WIDGET_ID, title: 'Prep-Zeit', description: 'Wie lange Obsidian, OneNote und Foundry offen waren – pro App und insgesamt', size: 'half', order: 46, component: PrepTracker, settings: PrepTrackerSettings })
registerWidget({ ...core, id: LAUNCHER_WIDGET_ID, title: 'Starter', description: 'Programme, Spiele und Szenen mit einem Klick öffnen', size: 'half', order: 47, component: Launcher, settings: LauncherSettings })
registerWidget({ ...core, id: 'focus-todos', title: 'Fokus', description: 'Überfällige und bald fällige ToDos', size: 'half', order: 50, component: FocusTodos })
registerWidget({ ...core, id: 'categories', title: 'Kategorien', description: 'Offene ToDos je Kategorie', size: 'half', order: 60, component: CategoryBars })
registerWidget({ ...core, id: 'deadline-radar', title: 'Deadline-Radar', description: 'Deadlines der nächsten 14 Tage', size: 'full', order: 70, component: DeadlineRadar })
registerWidget({ ...core, id: 'year-heatmap', title: 'Aktivität', description: 'Termine oder erledigte ToDos der letzten 12 Monate', size: 'full', order: 80, component: YearHeatmap })
