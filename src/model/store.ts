import { create } from 'zustand'
import { produce } from 'immer'
import type { ArtboardShape, EllipseNode, LNode, RectNode, Scene, TextNode } from './types'

export type Tool = 'select' | 'rect' | 'ellipse' | 'path' | 'text'

export const uid = () => Math.random().toString(36).slice(2, 10)

const COMMON = {
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  locked: false,
  fillOpacity: 1,
  stroke: 'none',
  strokeWidth: 0,
  strokeOpacity: 1,
}

export function newRect(p: Partial<RectNode>): RectNode {
  return {
    ...COMMON,
    id: uid(),
    type: 'rect',
    name: '矩形',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    radius: 0,
    fill: '#111111',
    ...p,
  }
}

export function newEllipse(p: Partial<EllipseNode>): EllipseNode {
  return {
    ...COMMON,
    id: uid(),
    type: 'ellipse',
    name: '椭圆',
    x: 0,
    y: 0,
    rx: 100,
    ry: 100,
    fill: '#111111',
    ...p,
  }
}

export function newText(p: Partial<TextNode>): TextNode {
  return {
    ...COMMON,
    id: uid(),
    type: 'text',
    name: '文字',
    x: 0,
    y: 0,
    text: '文字',
    fontFamily: 'Poppins',
    fontSize: 72,
    fontWeight: 600,
    fontStyle: 'normal',
    letterSpacing: 0,
    align: 'left',
    fill: '#111111',
    ...p,
  }
}

const initialScene: Scene = {
  width: 800,
  height: 800,
  background: '#ffffff',
  shape: 'rect',
  radius: 96,
  nodes: [
    newEllipse({ id: 'demo-ring', name: '圆环', x: 280, y: 180, rx: 120, ry: 120 }),
    newText({
      id: 'demo-word',
      name: '字标',
      x: 232,
      y: 430,
      text: 'ACME',
      fontFamily: 'Anton',
      fontSize: 118,
      fontWeight: 400,
      letterSpacing: 4,
    }),
  ],
}

const HISTORY_LIMIT = 80

export interface EditorState {
  scene: Scene
  past: Scene[]
  future: Scene[]
  selection: string[]
  tool: Tool
  zoom: number
  pan: { x: number; y: number }
  fileName: string

  setTool: (t: Tool) => void
  setZoom: (z: number) => void
  setPan: (p: { x: number; y: number }) => void
  setFileName: (n: string) => void
  snap: () => void
  apply: (fn: (d: Scene) => void) => void
  select: (ids: string[]) => void
  add: (n: LNode) => void
  remove: (ids: string[]) => void
  duplicate: () => void
  update: (id: string, patch: Record<string, any>) => void
  updateSelected: (patch: Record<string, any>) => void
  replace: (id: string, node: LNode) => void
  reorder: (id: string, delta: number) => void
  undo: () => void
  redo: () => void
  setCanvas: (p: {
    width?: number
    height?: number
    background?: string | null
    shape?: ArtboardShape
    radius?: number
  }) => void
}

export const useEditor = create<EditorState>((set, get) => ({
  scene: initialScene,
  past: [],
  future: [],
  selection: [],
  tool: 'select',
  zoom: 1,
  pan: { x: 0, y: 0 },
  fileName: 'logo',

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setFileName: (fileName) => set({ fileName }),

  snap: () =>
    set((s) => ({
      past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
      future: [],
    })),

  apply: (fn) =>
    set((s) => ({ scene: produce(s.scene, (d) => { fn(d) }) })),

  select: (selection) => set({ selection }),

  add: (n) =>
    set((s) => ({
      past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
      future: [],
      scene: { ...s.scene, nodes: [...s.scene.nodes, n] },
    })),

  remove: (ids) =>
    set((s) => {
      if (!ids.length) return s
      return {
        past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
        future: [],
        scene: { ...s.scene, nodes: s.scene.nodes.filter((n) => !ids.includes(n.id)) },
        selection: s.selection.filter((id) => !ids.includes(id)),
      }
    }),

  duplicate: () => {
    const { scene, selection } = get()
    const picked = scene.nodes.filter((n) => selection.includes(n.id))
    if (!picked.length) return
    const copies = picked.map((n) => ({
      ...structuredClone(n),
      id: uid(),
      x: n.x + 24,
      y: n.y + 24,
      name: `${n.name} 副本`,
    })) as LNode[]
    set((s) => ({
      past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
      future: [],
      scene: { ...s.scene, nodes: [...s.scene.nodes, ...copies] },
      selection: copies.map((c) => c.id),
    }))
  },

  update: (id, patch) =>
    set((s) => ({
      scene: produce(s.scene, (d) => {
        const n = d.nodes.find((x) => x.id === id)
        if (n) Object.assign(n, patch)
      }),
    })),

  updateSelected: (patch) =>
    set((s) => ({
      scene: produce(s.scene, (d) => {
        for (const n of d.nodes) {
          if (s.selection.includes(n.id)) Object.assign(n, patch)
        }
      }),
    })),

  replace: (id, node) =>
    set((s) => ({
      past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
      future: [],
      scene: { ...s.scene, nodes: s.scene.nodes.map((n) => (n.id === id ? node : n)) },
      selection: [node.id],
    })),

  reorder: (id, delta) =>
    set((s) => {
      const idx = s.scene.nodes.findIndex((n) => n.id === id)
      const to = idx + delta
      if (idx < 0 || to < 0 || to >= s.scene.nodes.length) return s
      const nodes = [...s.scene.nodes]
      const [it] = nodes.splice(idx, 1)
      nodes.splice(to, 0, it)
      return {
        past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
        future: [],
        scene: { ...s.scene, nodes },
      }
    }),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s
      const prev = s.past[s.past.length - 1]
      return {
        scene: prev,
        past: s.past.slice(0, -1),
        future: [s.scene, ...s.future].slice(0, HISTORY_LIMIT),
        selection: s.selection.filter((id) => prev.nodes.some((n) => n.id === id)),
      }
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s
      const next = s.future[0]
      return {
        scene: next,
        past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        selection: s.selection.filter((id) => next.nodes.some((n) => n.id === id)),
      }
    }),

  setCanvas: (p) =>
    set((s) => ({
      past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
      future: [],
      scene: {
        ...s.scene,
        width: p.width ?? s.scene.width,
        height: p.height ?? s.scene.height,
        background: p.background !== undefined ? p.background : s.scene.background,
        shape: p.shape ?? s.scene.shape,
        radius: p.radius ?? s.scene.radius,
      },
    })),
}))
