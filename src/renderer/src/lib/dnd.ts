/**
 * HTML5 drag & drop hides the payload during dragover, so the dragged ToDo id
 * is mirrored here to size the drop preview by its time estimate.
 */
export const todoDrag: { id: string | null } = { id: null }

export const TODO_MIME = 'application/x-todo'
