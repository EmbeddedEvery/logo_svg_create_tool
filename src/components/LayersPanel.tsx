import { useEditor } from '../model/store'
import { Icon } from './Icons'

const LABEL: Record<string, string> = {
  rect: '矩形',
  ellipse: '椭圆',
  path: '路径',
  text: '文字',
}

export function LayersPanel() {
  const scene = useEditor((s) => s.scene)
  const selection = useEditor((s) => s.selection)
  const select = useEditor((s) => s.select)
  const update = useEditor((s) => s.update)
  const remove = useEditor((s) => s.remove)
  const reorder = useEditor((s) => s.reorder)

  const nodes = [...scene.nodes].reverse()

  return (
    <div className="panel layers">
      <div className="section-title">
        图层
        <span className="count">{scene.nodes.length}</span>
      </div>
      <div className="layer-list">
        {nodes.length === 0 && <div className="hint">还没有对象</div>}
        {nodes.map((n) => {
          const active = selection.includes(n.id)
          const label = n.name || LABEL[n.type] || n.type
          return (
            <div
              key={n.id}
              className={`layer ${active ? 'active' : ''} ${n.visible ? '' : 'hidden'}`}
              onClick={(e) => {
                if (e.shiftKey) {
                  select(
                    active ? selection.filter((x) => x !== n.id) : [...selection, n.id],
                  )
                } else {
                  select([n.id])
                }
              }}
            >
              <button
                className="icon-btn"
                title={n.visible ? '隐藏' : '显示'}
                onClick={(e) => {
                  e.stopPropagation()
                  update(n.id, { visible: !n.visible })
                }}
              >
                <Icon name={n.visible ? 'eye' : 'eyeOff'} size={14} />
              </button>
              <span className="layer-type">{label === LABEL[n.type] ? '' : LABEL[n.type] ?? n.type}</span>
              <span className="layer-name">{label}</span>
              {n.locked && <Icon name="lock" size={13} />}
              <div className="layer-actions">
                <button
                  className="icon-btn"
                  title="上移"
                  onClick={(e) => {
                    e.stopPropagation()
                    reorder(n.id, 1)
                  }}
                >
                  <Icon name="up" size={13} />
                </button>
                <button
                  className="icon-btn"
                  title="下移"
                  onClick={(e) => {
                    e.stopPropagation()
                    reorder(n.id, -1)
                  }}
                >
                  <Icon name="down" size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="layer-footer">
        <button
          className="mini"
          disabled={!selection.length}
          onClick={() => remove(selection)}
        >
          <Icon name="trash" size={13} /> 删除
        </button>
      </div>
    </div>
  )
}
