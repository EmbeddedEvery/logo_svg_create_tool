export type NodeType = 'rect' | 'ellipse' | 'path' | 'text'

export interface BaseNode {
  id: string
  type: NodeType
  name: string
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number
  visible: boolean
  locked: boolean
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  strokeOpacity: number
}

export interface RectNode extends BaseNode {
  type: 'rect'
  width: number
  height: number
  radius: number
}

export interface EllipseNode extends BaseNode {
  type: 'ellipse'
  rx: number
  ry: number
}

export interface PathNode extends BaseNode {
  type: 'path'
  d: string
}

export interface TextNode extends BaseNode {
  type: 'text'
  text: string
  /** Family name from the bundled font library (see model/fonts.ts). */
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  letterSpacing: number
  align: 'left' | 'center' | 'right'
}

export type LNode = RectNode | EllipseNode | PathNode | TextNode

export type ArtboardShape = 'rect' | 'round' | 'ellipse'

export interface Scene {
  width: number
  height: number
  background: string | null
  shape: ArtboardShape
  /** Corner radius used when shape is 'round'. */
  radius: number
  nodes: LNode[]
}

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}
