import { api } from '../lib/api'
import { Logo } from './Logo'

export function TitleBar(): React.JSX.Element {
  return (
    <header className={`titlebar ${api.kind === 'electron' ? 'has-overlay' : ''}`}>
      <div className="titlebar-brand">
        <Logo size={18} />
        <span>Ember Planner</span>
      </div>
    </header>
  )
}
