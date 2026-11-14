import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { injectFontFaces } from './model/fonts'
import './styles.css'

injectFontFaces()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
