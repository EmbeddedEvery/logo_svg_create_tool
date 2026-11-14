import type { Font } from 'opentype.js'
import { loadFont, pickFace } from './fonts'
import type { LNode, PathNode, Scene, TextNode } from './types'

/**
 * Converts a text node into a single path in the node's own local coordinate
 * space, so the resulting PathNode keeps the original transform verbatim.
 */
export function textToPathData(node: TextNode, font: Font): string {
  const scale = node.fontSize / font.unitsPerEm
  const lines = node.text.split('\n')
  const lineHeight = node.fontSize * 1.18
  const parts: string[] = []

  for (let li = 0; li < lines.length; li++) {
    const glyphs = font.stringToGlyphs(lines[li])
    if (!glyphs.length) continue

    // Distance from glyph i-1's origin to glyph i's origin.
    const stepTo = (i: number) =>
      (glyphs[i - 1].advanceWidth ?? 0) * scale +
      node.letterSpacing +
      font.getKerningValue(glyphs[i - 1], glyphs[i]) * scale

    let cursor = 0
    for (let i = 1; i < glyphs.length; i++) cursor += stepTo(i)
    const width = cursor + (glyphs[glyphs.length - 1].advanceWidth ?? 0) * scale

    let pen = node.align === 'center' ? -width / 2 : node.align === 'right' ? -width : 0
    const baseline = node.fontSize * 0.8 + li * lineHeight

    for (let i = 0; i < glyphs.length; i++) {
      if (i > 0) pen += stepTo(i)
      const d = glyphs[i].getPath(pen, baseline, node.fontSize, undefined, font).toPathData(2)
      if (d) parts.push(d)
    }
  }

  return parts.join(' ')
}

export async function outlineTextNode(node: TextNode): Promise<PathNode> {
  const face = pickFace(node.fontFamily, node.fontWeight, node.fontStyle)
  if (!face) throw new Error(`没有可用字体文件：${node.fontFamily}`)
  const font = await loadFont(face)
  const d = textToPathData(node, font)
  if (!d) throw new Error('文字为空，无法转曲')

  const path: PathNode = {
    id: node.id,
    type: 'path',
    name: node.name.endsWith('轮廓') ? node.name : `${node.name} 轮廓`,
    x: node.x,
    y: node.y,
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY,
    opacity: node.opacity,
    visible: node.visible,
    locked: node.locked,
    fill: node.fill,
    fillOpacity: node.fillOpacity,
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
    strokeOpacity: node.strokeOpacity,
    d,
  }
  return path
}

export interface OutlineResult {
  scene: Scene
  missing: string[]
}

/** Non-destructive: returns a copy of the scene with every text node outlined. */
export async function outlineScene(scene: Scene): Promise<OutlineResult> {
  const missing: string[] = []
  const nodes: LNode[] = []

  for (const n of scene.nodes) {
    if (n.type !== 'text') {
      nodes.push(n)
      continue
    }
    try {
      nodes.push(await outlineTextNode(n))
    } catch {
      missing.push(`${n.name}（${n.fontFamily}）`)
      nodes.push(n)
    }
  }

  return { scene: { ...scene, nodes }, missing }
}
