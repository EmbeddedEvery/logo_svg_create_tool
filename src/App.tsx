import { Canvas } from './components/Canvas'
import { LayersPanel } from './components/LayersPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Toolbar } from './components/Toolbar'
import { TopBar } from './components/TopBar'

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="body">
        <Toolbar />
        <Canvas />
        <aside className="sidebar">
          <PropertiesPanel />
          <LayersPanel />
        </aside>
      </div>
    </div>
  )
}
