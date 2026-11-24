import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/themes.css'
import './styles/app.css'
import './styles/todos.css'
import './styles/ux.css'
import './styles/ideas.css'
import './plugins/core'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
