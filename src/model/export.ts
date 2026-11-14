import { serializeScene } from './svg'
import type { Scene } from './types'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function exportSvg(scene: Scene, name: string, transparent: boolean) {
  const svg = serializeScene(scene, { transparent })
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`)
}

export async function exportPng(
  scene: Scene,
  name: string,
  transparent: boolean,
  scale: number,
) {
  const svg = serializeScene(scene, { transparent })
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('无法渲染 SVG 到画布'))
      img.src = url
    })
    const w = Math.max(1, Math.round(scene.width * scale))
    const h = Math.max(1, Math.round(scene.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持 canvas 2d')
    ctx.drawImage(img, 0, 0, w, h)
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!out) throw new Error('PNG 编码失败')
    download(out, `${name}@${scale}x.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function copySvgToClipboard(scene: Scene, transparent: boolean) {
  const svg = serializeScene(scene, { transparent })
  return navigator.clipboard.writeText(svg)
}
