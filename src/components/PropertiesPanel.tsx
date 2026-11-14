import { useState } from 'react'
import { FONT_FAMILIES, nearestWeight, weightsOf } from '../model/fonts'
import { outlineTextNode } from '../model/outline'
import { useEditor } from '../model/store'
import { ColorField, NumField, Row, Section, Slider } from './Fields'

export function PropertiesPanel() {
  const scene = useEditor((s) => s.scene)
  const selection = useEditor((s) => s.selection)
  const update = useEditor((s) => s.update)
  const setCanvas = useEditor((s) => s.setCanvas)
  const replace = useEditor((s) => s.replace)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nodes = scene.nodes.filter((n) => selection.includes(n.id))
  const node = nodes.length === 1 ? nodes[0] : null

  const canvasSection = (
    <Section title="画布">
      <Row>
        <NumField
          label="宽"
          value={scene.width}
          onChange={(v) => setCanvas({ width: Math.max(16, Math.round(v)) })}
        />
        <NumField
          label="高"
          value={scene.height}
          onChange={(v) => setCanvas({ height: Math.max(16, Math.round(v)) })}
        />
      </Row>
      <div className="field-label">形状</div>
      <div className="segmented small full">
        <button
          className={scene.shape === 'rect' ? 'on' : ''}
          onClick={() => setCanvas({ shape: 'rect' })}
        >
          矩形
        </button>
        <button
          className={scene.shape === 'round' ? 'on' : ''}
          onClick={() => setCanvas({ shape: 'round' })}
        >
          圆角
        </button>
        <button
          className={scene.shape === 'ellipse' ? 'on' : ''}
          onClick={() => setCanvas({ shape: 'ellipse' })}
        >
          圆形
        </button>
      </div>
      {scene.shape === 'round' && (
        <Row>
          <NumField
            label="圆角"
            value={scene.radius}
            onChange={(v) => setCanvas({ radius: Math.max(0, v) })}
          />
        </Row>
      )}
      <ColorField
        label="背景"
        value={scene.background ?? 'none'}
        onChange={(v) => setCanvas({ background: v })}
      />
    </Section>
  )

  if (!node) {
    return (
      <div className="panel">
        {canvasSection}
        <div className="hint">
          {nodes.length > 1
            ? `已选中 ${nodes.length} 个对象，需逐个编辑`
            : '选择对象后可编辑属性。快捷键 V 选择 / R 矩形 / O 椭圆 / P 钢笔 / T 文字'}
        </div>
      </div>
    )
  }

  const set = (patch: Record<string, any>) => update(node.id, patch)

  return (
    <div className="panel">
      <Section title={node.name}>
        <Row>
          <NumField label="X" value={node.x} onChange={(v) => set({ x: v })} />
          <NumField label="Y" value={node.y} onChange={(v) => set({ y: v })} />
        </Row>
        <Row>
          <NumField
            label="旋转"
            value={node.rotation}
            suffix="°"
            onChange={(v) => set({ rotation: v })}
          />
          <NumField
            label="缩放"
            value={node.scaleX}
            step={0.1}
            suffix="×"
            onChange={(v) => {
              const cur = node.scaleY / node.scaleX || 1
              set({ scaleX: v, scaleY: v * cur })
            }}
          />
        </Row>
        <Slider
          label="不透明度"
          value={node.opacity}
          onChange={(v) => set({ opacity: v })}
        />
      </Section>

      {node.type === 'rect' && (
        <Section title="矩形">
          <Row>
            <NumField
              label="宽"
              value={node.width * node.scaleX}
              onChange={(v) => set({ width: Math.max(1, v / node.scaleX) })}
            />
            <NumField
              label="高"
              value={node.height * node.scaleY}
              onChange={(v) => set({ height: Math.max(1, v / node.scaleY) })}
            />
          </Row>
          <Row>
            <NumField
              label="圆角"
              value={node.radius}
              onChange={(v) => set({ radius: Math.max(0, v) })}
            />
          </Row>
        </Section>
      )}

      {node.type === 'ellipse' && (
        <Section title="椭圆">
          <Row>
            <NumField
              label="半径 X"
              value={node.rx * node.scaleX}
              onChange={(v) => set({ rx: Math.max(1, v / node.scaleX) })}
            />
            <NumField
              label="半径 Y"
              value={node.ry * node.scaleY}
              onChange={(v) => set({ ry: Math.max(1, v / node.scaleY) })}
            />
          </Row>
        </Section>
      )}

      {node.type === 'path' && (
        <Section title="路径">
          <div className="path-info">
            <code>{node.d.length > 90 ? node.d.slice(0, 90) + '…' : node.d}</code>
          </div>
        </Section>
      )}

      {node.type === 'text' && (
        <Section title="文字">
          <textarea
            className="text-input"
            value={node.text}
            rows={2}
            onChange={(e) => set({ text: e.target.value })}
          />
          <select
            className="select"
            value={node.fontFamily}
            onChange={(e) => {
              const family = e.target.value
              set({
                fontFamily: family,
                fontWeight: nearestWeight(family, node.fontWeight),
              })
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
          <Row>
            <NumField
              label="字号"
              value={node.fontSize}
              onChange={(v) => set({ fontSize: Math.max(1, v) })}
            />
            <NumField
              label="字距"
              value={node.letterSpacing}
              onChange={(v) => set({ letterSpacing: v })}
            />
          </Row>
          <Row>
            <label className="num-field">
              <span className="num-label">字重</span>
              <select
                className="select compact"
                value={node.fontWeight}
                onChange={(e) => set({ fontWeight: parseInt(e.target.value, 10) })}
              >
                {weightsOf(node.fontFamily).map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <label className="num-field">
              <span className="num-label">对齐</span>
              <select
                className="select compact"
                value={node.align}
                onChange={(e) => set({ align: e.target.value })}
              >
                <option value="left">左</option>
                <option value="center">中</option>
                <option value="right">右</option>
              </select>
            </label>
          </Row>
          <button
            className="wide primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                replace(node.id, await outlineTextNode(node))
              } catch (err) {
                setError(err instanceof Error ? err.message : '转曲失败')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? '转曲中…' : '转为路径（转曲）'}
          </button>
          {error && <div className="inline-error">{error}</div>}
        </Section>
      )}

      <Section title="填充">
        <ColorField
          label="颜色"
          value={node.fill}
          onChange={(v) => set({ fill: v })}
        />
        <Slider
          label="透明度"
          value={node.fillOpacity}
          onChange={(v) => set({ fillOpacity: v })}
        />
      </Section>

      <Section title="描边">
        <ColorField
          label="颜色"
          value={node.stroke}
          onChange={(v) => set({ stroke: v })}
        />
        <Row>
          <NumField
            label="粗细"
            value={node.strokeWidth}
            onChange={(v) => set({ strokeWidth: Math.max(0, v) })}
          />
        </Row>
        <Slider
          label="透明度"
          value={node.strokeOpacity}
          onChange={(v) => set({ strokeOpacity: v })}
        />
      </Section>

      {canvasSection}
    </div>
  )
}
