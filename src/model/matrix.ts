export interface Vec {
  x: number
  y: number
}

export interface Mat {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export const IDENT: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

export function mul(m: Mat, n: Mat): Mat {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  }
}

export function point(m: Mat, p: Vec): Vec {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }
}

export function invert(m: Mat): Mat {
  const det = m.a * m.d - m.b * m.c
  const inv = det === 0 ? 0 : 1 / det
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    e: (m.c * m.f - m.d * m.e) * inv,
    f: (m.b * m.e - m.a * m.f) * inv,
  }
}

/** Local -> world matrix for a node: translate ∘ rotate ∘ scale */
export function nodeMatrix(n: {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}): Mat {
  const r = (n.rotation * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return {
    a: cos * n.scaleX,
    b: sin * n.scaleX,
    c: -sin * n.scaleY,
    d: cos * n.scaleY,
    e: n.x,
    f: n.y,
  }
}

/** Linear part only (rotation ∘ scale), no translation. */
export function linear(rotDeg: number, sx: number, sy: number, v: Vec): Vec {
  const r = (rotDeg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return { x: cos * sx * v.x - sin * sy * v.y, y: sin * sx * v.x + cos * sy * v.y }
}

export function corners(b: { x: number; y: number; w: number; h: number }): Vec[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ]
}
