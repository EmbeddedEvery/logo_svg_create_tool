import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useEditor } from '../model/store'
import { newEllipse, newRect, newText, uid } from '../model/store'
import { nodesToSvg, num } from '../model/svg'
import type { BBox, LNode, PathNode, Scene } from '../model/types'
import { corners, invert, linear, nodeMatrix, point, type Vec } from '../model/matrix'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 40
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

const HANDLES = [
  { k: 'nw', fx: 0, fy: 0 },
  { k: 'n', fx: 0.5, fy: 0 },
  { k: 'ne', fx: 1, fy: 0 },
  { k: 'e', fx: 1, fy: 0.5 },
  { k: 'se', fx: 1, fy: 1 },
  { k: 's', fx: 0.5, fy: 1 },
  { k: 'sw', fx: 0, fy: 1 },
  { k: 'w', fx: 0, fy: 0.5 },
] as const

function anchorFor(handle: string, b: BBox): Vec {
  const l = b.x
  const t = b.y
  const r = b.x + b.w
  const bt = b.y + b.h
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  switch (handle) {
    case 'nw': return { x: r, y: bt }
    case 'n': return { x: cx, y: bt }
    case 'ne': return { x: l, y: bt }
    case 'e': return { x: l, y: cy }
    case 'se': return { x: l, y: t }
    case 's': return { x: cx, y: t }
    case 'sw': return { x: r, y: t }
    case 'w': return { x: r, y: cy }
    default: return { x: cx, y: cy }
  }
}

interface Anchor {
  p: Vec
  hIn: Vec
  hOut: Vec
}

function buildD(anchors: Anchor[], closed: boolean): string {
  if (anchors.length < 2) return ''
  const f = (v: number) => num(v)
  let d = `M ${f(anchors[0].p.x)} ${f(anchors[0].p.y)}`
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    d += ` C ${f(a.hOut.x)} ${f(a.hOut.y)}, ${f(b.hIn.x)} ${f(b.hIn.y)}, ${f(b.p.x)} ${f(b.p.y)}`
  }
  if (closed) {
    const a = anchors[anchors.length - 1]
    const b = anchors[0]
    d += ` C ${f(a.hOut.x)} ${f(a.hOut.y)}, ${f(b.hIn.x)} ${f(b.hIn.y)}, ${f(b.p.x)} ${f(b.p.y)} Z`
  }
  return d
}

function ArtboardShape({ scene, fill }: { scene: Scene; fill?: string }) {
  if (scene.shape === 'ellipse') {
    return (
      <ellipse
        cx={scene.width / 2}
        cy={scene.height / 2}
        rx={scene.width / 2}
        ry={scene.height / 2}
        fill={fill}
      />
    )
  }
  const r =
    scene.shape === 'round'
      ? Math.min(scene.radius, Math.min(scene.width, scene.height) / 2)
      : 0
  return (
    <rect
      x={0}
      y={0}
      width={scene.width}
      height={scene.height}
      rx={r || undefined}
      fill={fill}
    />
  )
}

const SNAP_PX = 6

interface WorldBox {
  x: number
  y: number
  w: number
  h: number
}

interface Guide {
  axis: 'x' | 'y'
  pos: number
}

function unionBox(boxes: WorldBox[]): WorldBox | null {
  if (!boxes.length) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const b of boxes) {
    x1 = Math.min(x1, b.x)
    y1 = Math.min(y1, b.y)
    x2 = Math.max(x2, b.x + b.w)
    y2 = Math.max(y2, b.y + b.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

function bestSnap(
  edges: number[],
  targets: number[],
  threshold: number,
): { delta: number; target: number } | null {
  let best: { delta: number; target: number } | null = null
  let bestAbs = threshold
  for (const e of edges) {
    for (const t of targets) {
      const d = t - e
      const a = Math.abs(d)
      if (a <= bestAbs) {
        bestAbs = a
        best = { delta: d, target: t }
      }
    }
  }
  return best
}

function track(
  onMove: (ev: PointerEvent) => void,
  onUp?: (ev: PointerEvent) => void,
) {
  const move = (ev: PointerEvent) => onMove(ev)
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    onUp?.(ev)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

export function Canvas() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const bboxRef = useRef<BBox | null>(null)
  const spaceRef = useRef(false)
  const didFit = useRef(false)

  const [vp, setVp] = useState({ w: 1000, h: 700 })
  const [bbox, setBbox] = useState<BBox | null>(null)
  const [preview, setPreview] = useState<LNode | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [pen, setPen] = useState<{ anchors: Anchor[]; cursor: Vec } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])

  const scene = useEditor((s) => s.scene)
  const selection = useEditor((s) => s.selection)
  const tool = useEditor((s) => s.tool)
  const zoom = useEditor((s) => s.zoom)
  const pan = useEditor((s) => s.pan)

  /* ---------- viewport ---------- */

  const fitView = (dims: { w: number; h: number } = vp) => {
    const s = useEditor.getState()
    if (!dims.w || !dims.h) return
    const pad = 120
    const z = clamp(
      Math.min((dims.w - pad) / s.scene.width, (dims.h - pad) / s.scene.height),
      MIN_ZOOM,
      MAX_ZOOM,
    )
    useEditor.setState({
      zoom: z,
      pan: {
        x: -(dims.w - s.scene.width * z) / (2 * z),
        y: -(dims.h - s.scene.height * z) / (2 * z),
      },
    })
  }

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      setVp({ w, h })
      if (!didFit.current && w > 0 && h > 0) {
        didFit.current = true
        fitView({ w, h })
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- selection bbox (measured from the live DOM) ---------- */

  useLayoutEffect(() => {
    if (selection.length !== 1) {
      bboxRef.current = null
      setBbox(null)
      return
    }
    const el = svgRef.current?.querySelector(`[data-id="${selection[0]}"] > *`) as
      | SVGGraphicsElement
      | null
    if (!el || typeof el.getBBox !== 'function') {
      bboxRef.current = null
      setBbox(null)
      return
    }
    try {
      const b = el.getBBox()
      const next = { x: b.x, y: b.y, w: b.width, h: b.height }
      bboxRef.current = next
      setBbox(next)
    } catch {
      bboxRef.current = null
      setBbox(null)
    }
  }, [scene, selection])

  /* ---------- coordinate helpers ---------- */

  const toWorld = (clientX: number, clientY: number): Vec => {
    const el = svgRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    const s = useEditor.getState()
    return {
      x: s.pan.x + (clientX - r.left) / s.zoom,
      y: s.pan.y + (clientY - r.top) / s.zoom,
    }
  }

  /* ---------- alignment ---------- */

  const worldBoxOf = (n: LNode): WorldBox | null => {
    const child = svgRef.current?.querySelector(`[data-id="${n.id}"] > *`) as
      | SVGGraphicsElement
      | null
    if (!child || typeof child.getBBox !== 'function') return null
    try {
      const b = child.getBBox()
      const m = nodeMatrix(n)
      const pts = corners({ x: b.x, y: b.y, w: b.width, h: b.height }).map((p) =>
        point(m, p),
      )
      const x1 = Math.min(...pts.map((p) => p.x))
      const y1 = Math.min(...pts.map((p) => p.y))
      const x2 = Math.max(...pts.map((p) => p.x))
      const y2 = Math.max(...pts.map((p) => p.y))
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
    } catch {
      return null
    }
  }

  /** Edges and centers of every other object plus the artboard, per axis. */
  const snapValues = (exclude: string[]) => {
    const s = useEditor.getState()
    const xs = [0, s.scene.width / 2, s.scene.width]
    const ys = [0, s.scene.height / 2, s.scene.height]
    for (const n of s.scene.nodes) {
      if (!n.visible || exclude.includes(n.id)) continue
      const b = worldBoxOf(n)
      if (!b) continue
      xs.push(b.x, b.x + b.w / 2, b.x + b.w)
      ys.push(b.y, b.y + b.h / 2, b.y + b.h)
    }
    return { xs, ys }
  }

  const showGuides = (gx: number | null, gy: number | null) => {
    setGuides(
      gx === null && gy === null
        ? []
        : [
            ...(gx !== null ? [{ axis: 'x' as const, pos: gx }] : []),
            ...(gy !== null ? [{ axis: 'y' as const, pos: gy }] : []),
          ],
    )
  }

  /* ---------- interactions ---------- */

  const startPan = (e: { clientX: number; clientY: number }) => {
    const s = useEditor.getState()
    const start = { x: e.clientX, y: e.clientY }
    const startPan = { ...s.pan }
    track((ev) => {
      useEditor.setState({
        pan: {
          x: startPan.x - (ev.clientX - start.x) / useEditor.getState().zoom,
          y: startPan.y - (ev.clientY - start.y) / useEditor.getState().zoom,
        },
      })
    })
  }

  const startDrag = (e: React.PointerEvent, ids: string[]) => {
    const s = useEditor.getState()
    const start = toWorld(e.clientX, e.clientY)
    const items = ids
      .map((id) => {
        const n = s.scene.nodes.find((x) => x.id === id)
        return n ? { id, x: n.x, y: n.y, locked: n.locked } : null
      })
      .filter(Boolean) as { id: string; x: number; y: number; locked: boolean }[]

    const moving = unionBox(
      ids
        .map((id) => s.scene.nodes.find((n) => n.id === id))
        .filter((n): n is LNode => !!n)
        .map((n) => worldBoxOf(n))
        .filter((b): b is WorldBox => !!b),
    )
    const targets = snapValues(ids)
    const threshold = SNAP_PX / s.zoom
    let snapped = false

    track(
      (ev) => {
        const p = toWorld(ev.clientX, ev.clientY)
        let dx = p.x - start.x
        let dy = p.y - start.y
        const z = useEditor.getState().zoom
        if (!snapped) {
          if (Math.hypot(dx, dy) * z < 2) return
          snapped = true
          useEditor.getState().snap()
        }
        if (ev.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }

        let guideX: number | null = null
        let guideY: number | null = null
        if (moving && !ev.altKey) {
          const bx = moving.x + dx
          const by = moving.y + dy
          const sx = bestSnap([bx, bx + moving.w / 2, bx + moving.w], targets.xs, threshold)
          if (sx) {
            dx += sx.delta
            guideX = sx.target
          }
          const sy = bestSnap([by, by + moving.h / 2, by + moving.h], targets.ys, threshold)
          if (sy) {
            dy += sy.delta
            guideY = sy.target
          }
        }
        showGuides(guideX, guideY)

        useEditor.getState().apply((d) => {
          for (const it of items) {
            if (it.locked) continue
            const n = d.nodes.find((x) => x.id === it.id)
            if (n) {
              n.x = it.x + dx
              n.y = it.y + dy
            }
          }
        })
      },
      () => setGuides([]),
    )
  }

  const startResize = (e: React.PointerEvent, handle: string) => {
    const s = useEditor.getState()
    const id = s.selection[0]
    const node = s.scene.nodes.find((n) => n.id === id)
    const b = bboxRef.current
    if (!node || !b || node.locked) return
    const start = { ...node }
    const M = nodeMatrix(start)
    const Minv = invert(M)
    const A = anchorFor(handle, b)
    const Pw = point(M, A)
    const targets = snapValues([id])
    const threshold = SNAP_PX / useEditor.getState().zoom
    const snapX = handle.includes('e') || handle.includes('w')
    const snapY = handle.includes('n') || handle.includes('s')
    let snapped = false

    track(
      (ev) => {
        let p = toWorld(ev.clientX, ev.clientY)
        let guideX: number | null = null
        let guideY: number | null = null
        // Snapping the pointer only makes sense for unrotated boxes.
        if (!ev.altKey && start.rotation === 0) {
          if (snapX) {
            const sx = bestSnap([p.x], targets.xs, threshold)
            if (sx) {
              p = { x: p.x + sx.delta, y: p.y }
              guideX = sx.target
            }
          }
          if (snapY) {
            const sy = bestSnap([p.y], targets.ys, threshold)
            if (sy) {
              p = { x: p.x, y: p.y + sy.delta }
              guideY = sy.target
            }
          }
        }
        showGuides(guideX, guideY)

        const q = point(Minv, p)
        let bw = b.w
        let bh = b.h
        if (handle.includes('e')) bw = Math.max(1, q.x - b.x)
        if (handle.includes('w')) bw = Math.max(1, b.x + b.w - q.x)
        if (handle.includes('s')) bh = Math.max(1, q.y - b.y)
        if (handle.includes('n')) bh = Math.max(1, b.y + b.h - q.y)

        let sx = handle.includes('e') || handle.includes('w') ? bw / b.w : start.scaleX
        let sy = handle.includes('n') || handle.includes('s') ? bh / b.h : start.scaleY

        if (ev.shiftKey && b.w > 0 && b.h > 0) {
          const ratio = Math.max(sx, sy)
          sx = ratio
          sy = ratio
        }

        if (!snapped) {
          snapped = true
          useEditor.getState().snap()
        }
        const off = linear(start.rotation, sx, sy, A)
        useEditor.getState().apply((d) => {
          const n = d.nodes.find((x) => x.id === id)
          if (!n) return
          n.scaleX = sx
          n.scaleY = sy
          n.x = Pw.x - off.x
          n.y = Pw.y - off.y
        })
      },
      () => setGuides([]),
    )
  }

  const startCreate = (e: React.PointerEvent) => {
    const start = toWorld(e.clientX, e.clientY)
    const type = useEditor.getState().tool
    track(
      (ev) => {
        const p = toWorld(ev.clientX, ev.clientY)
        let w = Math.abs(p.x - start.x)
        let h = Math.abs(p.y - start.y)
        if (ev.shiftKey) {
          const m = Math.max(w, h)
          w = m
          h = m
        }
        const x = p.x < start.x ? start.x - w : start.x
        const y = p.y < start.y ? start.y - h : start.y
        setPreview(
          type === 'ellipse'
            ? newEllipse({ x, y, rx: w / 2, ry: h / 2 })
            : newRect({ x, y, width: w, height: h }),
        )
      },
      (ev) => {
        const p = toWorld(ev.clientX, ev.clientY)
        let w = Math.abs(p.x - start.x)
        let h = Math.abs(p.y - start.y)
        if (ev.shiftKey) {
          const m = Math.max(w, h)
          w = m
          h = m
        }
        setPreview(null)
        if (w < 2 || h < 2) return
        const x = p.x < start.x ? start.x - w : start.x
        const y = p.y < start.y ? start.y - h : start.y
        const s = useEditor.getState()
        const node =
          type === 'ellipse'
            ? newEllipse({ x, y, rx: w / 2, ry: h / 2 })
            : newRect({ x, y, width: w, height: h })
        s.add(node)
        s.setTool('select')
        s.select([node.id])
      },
    )
  }

  const startMarquee = (e: React.PointerEvent) => {
    const el = svgRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const ox = e.clientX
    const oy = e.clientY
    track(
      (ev) => {
        setMarquee({
          x: Math.min(ox, ev.clientX) - r.left,
          y: Math.min(oy, ev.clientY) - r.top,
          w: Math.abs(ev.clientX - ox),
          h: Math.abs(ev.clientY - oy),
        })
      },
      (ev) => {
        setMarquee(null)
        const x1 = Math.min(ox, ev.clientX)
        const x2 = Math.max(ox, ev.clientX)
        const y1 = Math.min(oy, ev.clientY)
        const y2 = Math.max(oy, ev.clientY)
        if (x2 - x1 < 3 && y2 - y1 < 3) return
        const s = useEditor.getState()
        const hits = s.scene.nodes
          .filter((n) => {
            if (!n.visible || n.locked) return false
            const g = svgRef.current?.querySelector(`[data-id="${n.id}"] > *`)
            if (!g) return false
            const b = g.getBoundingClientRect()
            return !(b.right < x1 || b.left > x2 || b.bottom < y1 || b.top > y2)
          })
          .map((n) => n.id)
        s.select(hits)
      },
    )
  }

  const commitPath = (anchors: Anchor[], closed: boolean) => {
    const d = buildD(anchors, closed)
    setPen(null)
    if (!d) return
    const node: PathNode = {
      id: uid(),
      type: 'path',
      name: '路径',
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      visible: true,
      locked: false,
      fill: closed ? '#111111' : 'none',
      fillOpacity: 1,
      stroke: closed ? 'none' : '#111111',
      strokeWidth: closed ? 0 : 4,
      strokeOpacity: 1,
      d,
    }
    const s = useEditor.getState()
    s.add(node)
    s.setTool('select')
    s.select([node.id])
  }

  const penDown = (e: React.PointerEvent) => {
    const p = toWorld(e.clientX, e.clientY)
    const z = useEditor.getState().zoom
    const current = pen

    if (current && current.anchors.length > 1) {
      const first = current.anchors[0].p
      if (Math.hypot(p.x - first.x, p.y - first.y) < 10 / z) {
        const anchors = current.anchors.map((a) => ({ ...a }))
        anchors[anchors.length - 1].hOut = { ...first }
        anchors[0].hIn = { ...first }
        commitPath(anchors, true)
        return
      }
    }

    const anchors: Anchor[] = current ? current.anchors.map((a) => ({ ...a })) : []
    const idx = anchors.length
    anchors.push({ p, hIn: { ...p }, hOut: { ...p } })
    setPen({ anchors, cursor: p })

    track((ev) => {
      const q = toWorld(ev.clientX, ev.clientY)
      const dist = Math.hypot(q.x - p.x, q.y - p.y)
      const next = anchors.map((a, i) =>
        i === idx
          ? {
              p: a.p,
              hOut: dist * z < 2 ? { ...a.p } : q,
              hIn: dist * z < 2 ? { ...a.p } : { x: 2 * a.p.x - q.x, y: 2 * a.p.y - q.y },
            }
          : a,
      )
      setPen({ anchors: next, cursor: q })
    })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || spaceRef.current) {
      e.preventDefault()
      startPan(e)
      return
    }
    if (e.button !== 0) return

    const s = useEditor.getState()
    const target = e.target as Element

    if (s.tool === 'path') {
      penDown(e)
      return
    }
    if (s.tool === 'rect' || s.tool === 'ellipse') {
      startCreate(e)
      return
    }
    if (s.tool === 'text') {
      const p = toWorld(e.clientX, e.clientY)
      const node = newText({ x: p.x, y: p.y })
      s.add(node)
      s.setTool('select')
      s.select([node.id])
      setEditing(node.id)
      return
    }

    const handleEl = target.closest('[data-handle]')
    if (handleEl && s.selection.length === 1) {
      startResize(e, handleEl.getAttribute('data-handle')!)
      return
    }

    const id = target.closest('[data-id]')?.getAttribute('data-id') ?? null
    if (id) {
      const node = s.scene.nodes.find((n) => n.id === id)
      if (!node || node.locked) return
      let sel = s.selection
      if (e.shiftKey) {
        sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
      } else if (!sel.includes(id)) {
        sel = [id]
      }
      s.select(sel)
      if (sel.length) startDrag(e, sel)
    } else {
      s.select([])
      startMarquee(e)
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = (e.target as Element).closest('[data-id]')?.getAttribute('data-id')
    if (!id) return
    const node = useEditor.getState().scene.nodes.find((n) => n.id === id)
    if (node?.type === 'text') setEditing(id)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pen) setPen((p) => (p ? { ...p, cursor: toWorld(e.clientX, e.clientY) } : p))
  }

  /* ---------- wheel zoom (non-passive) ---------- */

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useEditor.getState()
      const r = el.getBoundingClientRect()
      const sx = e.clientX - r.left
      const sy = e.clientY - r.top
      if (e.shiftKey || e.metaKey) {
        useEditor.setState({
          pan: { x: s.pan.x + e.deltaX / s.zoom, y: s.pan.y + e.deltaY / s.zoom },
        })
        return
      }
      const factor = Math.exp(-e.deltaY * 0.0015)
      const nz = clamp(s.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const w = { x: s.pan.x + sx / s.zoom, y: s.pan.y + sy / s.zoom }
      useEditor.setState({ zoom: nz, pan: { x: w.x - sx / nz, y: w.y - sy / nz } })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        spaceRef.current = true
        return
      }
      if (isTyping(e.target)) return
      const s = useEditor.getState()
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.duplicate()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        s.select(s.scene.nodes.map((n) => n.id))
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection.length) {
          e.preventDefault()
          s.remove(s.selection)
        }
        return
      }
      if (e.key === 'Escape') {
        s.select([])
        s.setTool('select')
        return
      }
      if (mod) return
      switch (e.key.toLowerCase()) {
        case 'v': s.setTool('select'); break
        case 'r': s.setTool('rect'); break
        case 'o': s.setTool('ellipse'); break
        case 'p': s.setTool('path'); break
        case 't': s.setTool('text'); break
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  /* ---------- pen finish on Enter / Esc ---------- */

  useEffect(() => {
    if (!pen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPen(null)
        useEditor.getState().setTool('select')
      }
      if (e.key === 'Enter') {
        const anchors = pen.anchors.map((a) => ({ ...a }))
        if (anchors.length >= 2) commitPath(anchors, false)
        else setPen(null)
        useEditor.getState().setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pen])

  /* ---------- derived render data ---------- */

  const selNode = selection.length === 1 ? scene.nodes.find((n) => n.id === selection[0]) : null
  const selMatrix = selNode ? nodeMatrix(selNode) : null
  const worldCorners = bbox && selMatrix ? corners(bbox).map((c) => point(selMatrix, c)) : null
  const hs = 9 / zoom

  const editingNode = editing ? scene.nodes.find((n) => n.id === editing) : null

  const cursor =
    spaceRef.current ? 'grab' : tool === 'select' ? 'default' : 'crosshair'

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="canvas"
        viewBox={`${pan.x} ${pan.y} ${Math.max(1, vp.w / zoom)} ${Math.max(1, vp.h / zoom)}`}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onDoubleClick={onDoubleClick}
      >
        <defs>
          <pattern id="checker" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="#ffffff" />
            <rect width="8" height="8" fill="#eeeeee" />
            <rect x="8" y="8" width="8" height="8" fill="#eeeeee" />
          </pattern>
          <clipPath id="artboard-clip">
            <ArtboardShape scene={scene} />
          </clipPath>
          <filter id="artboard-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="16"
              floodColor="#000000"
              floodOpacity="0.5"
            />
          </filter>
        </defs>

        <g filter="url(#artboard-shadow)">
          <g clipPath="url(#artboard-clip)">
            <ArtboardShape scene={scene} fill={scene.background ?? 'url(#checker)'} />
            <g dangerouslySetInnerHTML={{ __html: nodesToSvg(scene.nodes) }} />
          </g>
        </g>

        {/* drawing preview */}
        {preview && (
          <g pointerEvents="none" opacity={0.6}>
            <g dangerouslySetInnerHTML={{ __html: nodesToSvg([preview]) }} />
          </g>
        )}

        {/* selection overlay */}
        {worldCorners && (
          <g pointerEvents="none">
            <polygon
              points={worldCorners.map((c) => `${c.x},${c.y}`).join(' ')}
              fill="none"
              stroke="#4f7cff"
              strokeWidth={1.5 / zoom}
            />
            {HANDLES.map((h) => {
              const lp = {
                x: bbox!.x + bbox!.w * h.fx,
                y: bbox!.y + bbox!.h * h.fy,
              }
              const wp = point(selMatrix!, lp)
              return (
                <rect
                  key={h.k}
                  data-handle={h.k}
                  x={wp.x - hs / 2}
                  y={wp.y - hs / 2}
                  width={hs}
                  height={hs}
                  fill="#ffffff"
                  stroke="#4f7cff"
                  strokeWidth={1.5 / zoom}
                  pointerEvents="all"
                  style={{ cursor: `${h.k}-resize` }}
                />
              )
            })}
          </g>
        )}

        {/* pen draft */}
        {pen && pen.anchors.length > 0 && (
          <g pointerEvents="none">
            <path
              d={buildD(pen.anchors, false)}
              fill="none"
              stroke="#4f7cff"
              strokeWidth={1.5 / zoom}
            />
            {(() => {
              const last = pen.anchors[pen.anchors.length - 1]
              return (
                <line
                  x1={last.p.x}
                  y1={last.p.y}
                  x2={pen.cursor.x}
                  y2={pen.cursor.y}
                  stroke="#4f7cff"
                  strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                  strokeWidth={1 / zoom}
                />
              )
            })()}
            {pen.anchors.map((a, i) => (
              <circle
                key={i}
                cx={a.p.x}
                cy={a.p.y}
                r={3.5 / zoom}
                fill="#ffffff"
                stroke="#4f7cff"
                strokeWidth={1.5 / zoom}
              />
            ))}
          </g>
        )}

        {/* alignment guides */}
        {guides.map((g, i) =>
          g.axis === 'x' ? (
            <line
              key={i}
              x1={g.pos}
              y1={pan.y}
              x2={g.pos}
              y2={pan.y + vp.h / zoom}
              stroke="#ff3b6b"
              strokeWidth={1 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              pointerEvents="none"
            />
          ) : (
            <line
              key={i}
              x1={pan.x}
              y1={g.pos}
              x2={pan.x + vp.w / zoom}
              y2={g.pos}
              stroke="#ff3b6b"
              strokeWidth={1 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              pointerEvents="none"
            />
          ),
        )}

        {/* marquee */}
        {marquee && (
          <rect
            x={marquee.x / zoom + pan.x}
            y={marquee.y / zoom + pan.y}
            width={marquee.w / zoom}
            height={marquee.h / zoom}
            fill="rgba(79,124,255,0.12)"
            stroke="#4f7cff"
            strokeWidth={1 / zoom}
            pointerEvents="none"
          />
        )}
      </svg>

      {editingNode && editingNode.type === 'text' && (
        <textarea
          className="text-editor"
          autoFocus
          value={editingNode.text}
          style={{
            left: (editingNode.x - pan.x) * zoom,
            top: (editingNode.y - pan.y) * zoom,
            fontFamily: editingNode.fontFamily,
            fontSize: editingNode.fontSize * zoom * editingNode.scaleY,
            fontWeight: editingNode.fontWeight,
            fontStyle: editingNode.fontStyle,
            letterSpacing: `${editingNode.letterSpacing * zoom * editingNode.scaleX}px`,
            color: editingNode.fill === 'none' ? '#000' : editingNode.fill,
            lineHeight: 1.18,
            width: Math.max(120, (bbox?.w ?? 120) * zoom * editingNode.scaleX + 48),
          }}
          onChange={(e) => {
            const el = e.currentTarget
            useEditor.getState().update(editingNode.id, { text: el.value })
          }}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
              e.preventDefault()
              setEditing(null)
            }
            e.stopPropagation()
          }}
        />
      )}

      <div className="zoom-badge">
        <button onClick={() => useEditor.setState({ zoom: clamp(zoom / 1.25, MIN_ZOOM, MAX_ZOOM) })}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => useEditor.setState({ zoom: clamp(zoom * 1.25, MIN_ZOOM, MAX_ZOOM) })}>+</button>
        <button onClick={() => fitView()}>适应</button>
      </div>
    </div>
  )
}
