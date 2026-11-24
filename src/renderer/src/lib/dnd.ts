/**
 * HTML5 drag & drop hides the payload during dragover, so the dragged ToDo id
 * is mirrored here to size the drop preview by its time estimate.
 */
export const todoDrag: { id: string | null } = { id: null }

export const TODO_MIME = 'application/x-todo'

/** a weekly-goal block from the goal bar; the goal id is mirrored for the drop preview */
export const GOAL_MIME = 'application/x-goal'
export const goalDrag: { id: string | null } = { id: null }
