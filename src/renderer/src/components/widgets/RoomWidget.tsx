import { useStore } from '../../store'
import { RoomScene } from '../character/room/RoomScene'
import { useClockPhase, useHidden } from '../character/room/RoomView'
import { useIdleActor } from '../character/room/useIdleActor'

/** the character's room to look at; a click opens it on the character page */
export function RoomWidget(): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const setPage = useStore((s) => s.setPage)
  const hidden = useHidden()
  const phase = useClockPhase(hidden)
  const { actor } = useIdleActor(ch, !hidden)
  return (
    <section className="card widget room-card">
      <div className="widget-head">
        <div>
          <h3>{ch.name ? `Zimmer von ${ch.name}` : 'Dein Zimmer'}</h3>
          <p>{ch.room.items.length} Dinge im Zimmer</p>
        </div>
      </div>
      <button className="room-card-view" onClick={() => setPage('character')} title="Zum Zimmer">
        <RoomScene items={ch.room.items} wall={ch.room.wall} floor={ch.room.floor} look={ch.look} outfit={ch.outfit} phase={phase} paused={hidden} actor={actor} />
      </button>
    </section>
  )
}
