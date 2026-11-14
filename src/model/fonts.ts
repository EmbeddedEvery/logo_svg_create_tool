import { parse, type Font } from 'opentype.js'

export interface FontFace {
  family: string
  weight: number
  style: 'normal' | 'italic'
  file: string
}

/**
 * Bundled open-source faces (SIL OFL). Licenses live in public/fonts/licenses/.
 * Keeping the fonts in-repo is what makes outline conversion deterministic:
 * the same binary is used for screen rendering and for glyph extraction.
 */
export const FONT_FACES: FontFace[] = [
  { family: 'Poppins', weight: 400, style: 'normal', file: 'Poppins-Regular.ttf' },
  { family: 'Poppins', weight: 600, style: 'normal', file: 'Poppins-SemiBold.ttf' },
  { family: 'Poppins', weight: 700, style: 'normal', file: 'Poppins-Bold.ttf' },
  { family: 'Barlow', weight: 400, style: 'normal', file: 'Barlow-Regular.ttf' },
  { family: 'Barlow', weight: 700, style: 'normal', file: 'Barlow-Bold.ttf' },
  { family: 'Anton', weight: 400, style: 'normal', file: 'Anton-Regular.ttf' },
  { family: 'Archivo Black', weight: 400, style: 'normal', file: 'ArchivoBlack-Regular.ttf' },
  { family: 'Bebas Neue', weight: 400, style: 'normal', file: 'BebasNeue-Regular.ttf' },
  { family: 'DM Serif Display', weight: 400, style: 'normal', file: 'DMSerifDisplay-Regular.ttf' },
  { family: 'Lobster', weight: 400, style: 'normal', file: 'Lobster-Regular.ttf' },
  { family: 'Righteous', weight: 400, style: 'normal', file: 'Righteous-Regular.ttf' },
]

export const FONT_FAMILIES: { name: string; weights: number[] }[] = FONT_FACES.reduce(
  (acc, f) => {
    const hit = acc.find((a) => a.name === f.family)
    if (hit) {
      if (!hit.weights.includes(f.weight)) hit.weights.push(f.weight)
    } else {
      acc.push({ name: f.family, weights: [f.weight] })
    }
    return acc
  },
  [] as { name: string; weights: number[] }[],
)

export const DEFAULT_FAMILY = 'Poppins'

export function weightsOf(family: string): number[] {
  return FONT_FAMILIES.find((f) => f.name === family)?.weights ?? [400]
}

export function nearestWeight(family: string, weight: number): number {
  return weightsOf(family).reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  )
}

export function pickFace(
  family: string,
  weight: number,
  style: 'normal' | 'italic' = 'normal',
): FontFace | null {
  const inFamily = FONT_FACES.filter((f) => f.family === family)
  if (!inFamily.length) return null
  const candidates = inFamily.filter((f) => f.style === style)
  const pool = candidates.length ? candidates : inFamily
  return pool.reduce((best, f) =>
    Math.abs(f.weight - weight) < Math.abs(best.weight - weight) ? f : best,
  )
}

export function fontUrl(file: string): string {
  return `${import.meta.env.BASE_URL}fonts/${file}`
}

let injected = false

/** Registers every bundled face. The browser only downloads the ones actually used. */
export function injectFontFaces(): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  const css = FONT_FACES.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};` +
      `font-display:block;src:url("${fontUrl(f.file)}") format("truetype");}`,
  ).join('\n')
  const style = document.createElement('style')
  style.setAttribute('data-logo-studio-fonts', '')
  style.textContent = css
  document.head.appendChild(style)
}

const fontCache = new Map<string, Promise<Font>>()

export function loadFont(face: FontFace): Promise<Font> {
  const cached = fontCache.get(face.file)
  if (cached) return cached
  const p = fetch(fontUrl(face.file))
    .then((r) => {
      if (!r.ok) throw new Error(`字体加载失败：${face.file}`)
      return r.arrayBuffer()
    })
    .then((buf) => parse(buf))
  fontCache.set(face.file, p)
  return p
}
