import { useState } from 'react'
import { useEditor } from '../model/store'
import { copySvgToClipboard, exportPng, exportSvg } from '../model/export'
import { outlineScene } from '../model/outline'
import { Icon } from './Icons'

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const scene = useEditor((s) => s.scene)
  const fileName = useEditor((s) => s.fileName)
  const [format, setFormat] = useState<'svg' | 'png'>('svg')
  const [scale, setScale] = useState(2)
  const [transparent, setTransparent] = useState(false)
  const [outlineText, setOutlineText] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const hasText = scene.nodes.some((n) => n.type === 'text')

  const prepare = async () => {
    if (!outlineText || !hasText) return { scene, missing: [] as string[] }
    const res = await outlineScene(scene)
    return { scene: res.scene, missing: res.missing }
  }

  const run = async () => {
    setBusy(true)
    setNote('')
    try {
      const { scene: target, missing } = await prepare()
      if (format === 'svg') exportSvg(target, fileName, transparent)
      else await exportPng(target, fileName, transparent, scale)
      setNote(
        missing.length
          ? `已开始下载；这些文字无法转曲：${missing.join('、')}`
          : '已开始下载',
      )
    } catch (err) {
      setNote(err instanceof Error ? err.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>导出</h2>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="segmented">
          <button className={format === 'svg' ? 'on' : ''} onClick={() => setFormat('svg')}>
            SVG
          </button>
          <button className={format === 'png' ? 'on' : ''} onClick={() => setFormat('png')}>
            PNG
          </button>
        </div>

        <div className="modal-body">
          <div className="kv">
            <span>画布</span>
            <b>
              {scene.width} × {scene.height}
            </b>
          </div>
          {format === 'png' && (
            <>
              <div className="kv">
                <span>倍率</span>
                <div className="segmented small">
                  {[1, 2, 3, 4].map((s) => (
                    <button
                      key={s}
                      className={scale === s ? 'on' : ''}
                      onClick={() => setScale(s)}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
              <div className="kv">
                <span>输出尺寸</span>
                <b>
                  {scene.width * scale} × {scene.height * scale}
                </b>
              </div>
            </>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={outlineText}
              disabled={!hasText}
              onChange={(e) => setOutlineText(e.target.checked)}
            />
            文字转为轮廓（推荐）
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            透明背景
          </label>

          <p className="modal-note">
            {format === 'svg'
              ? 'SVG 是矢量标准格式，可无损缩放。转曲后不依赖对方是否安装字体。'
              : 'PNG 为位图。勾选转曲可保证栅格化时字形与画布完全一致。'}
          </p>
          {note && <p className="modal-note ok">{note}</p>}
        </div>

        <div className="modal-foot">
          {format === 'svg' && (
            <button
              className="ghost"
              onClick={async () => {
                const { scene: target } = await prepare()
                await copySvgToClipboard(target, transparent)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? '已复制' : '复制 SVG'}
            </button>
          )}
          <button className="primary" onClick={run} disabled={busy}>
            {busy ? '导出中…' : '下载'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TopBar() {
  const fileName = useEditor((s) => s.fileName)
  const setFileName = useEditor((s) => s.setFileName)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const [exporting, setExporting] = useState(false)

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo-mark" />
        Logo Studio
      </div>

      <input
        className="file-name"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        spellCheck={false}
      />

      <div className="topbar-actions">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title="撤销">
          <Icon name="undo" size={16} />
        </button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title="重做">
          <Icon name="redo" size={16} />
        </button>
        <button className="primary" onClick={() => setExporting(true)}>
          <Icon name="download" size={15} />
          导出
        </button>
      </div>

      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </header>
  )
}
