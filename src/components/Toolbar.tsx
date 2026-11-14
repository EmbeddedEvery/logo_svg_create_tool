import { useEditor, type Tool } from '../model/store'
import { Icon } from './Icons'

const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: 'select', label: '选择', key: 'V' },
  { id: 'rect', icon: 'rect', label: '矩形', key: 'R' },
  { id: 'ellipse', icon: 'ellipse', label: '椭圆', key: 'O' },
  { id: 'path', icon: 'path', label: '钢笔', key: 'P' },
  { id: 'text', icon: 'text', label: '文字', key: 'T' },
]

export function Toolbar() {
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)

  return (
    <div className="toolbar">
      <div className="tool-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.key})`}
          >
            <Icon name={t.icon} />
          </button>
        ))}
      </div>

      <div className="tool-group">
        <button className="tool" onClick={undo} disabled={!canUndo} title="撤销 (⌘Z)">
          <Icon name="undo" />
        </button>
        <button className="tool" onClick={redo} disabled={!canRedo} title="重做 (⇧⌘Z)">
          <Icon name="redo" />
        </button>
      </div>
    </div>
  )
}
