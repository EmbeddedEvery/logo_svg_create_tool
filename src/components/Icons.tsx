import type { JSX } from 'react'

const PATHS: Record<string, JSX.Element> = {
  select: (
    <path d="M5 3.5l12.5 7.6-5.6 1.4-2.8 5.6L5 3.5z" fill="currentColor" stroke="none" />
  ),
  rect: <rect x="4" y="5.5" width="16" height="13" rx="2" />,
  ellipse: <circle cx="12" cy="12" r="7.5" />,
  path: <path d="M3.5 17.5C7 7 14.5 20 20.5 6.5" />,
  text: (
    <>
      <path d="M5 6.5V4.5h14v2" />
      <path d="M12 4.5v15" />
      <path d="M9 19.5h6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h9.5a6 6 0 010 12H10" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9h-9.5a6 6 0 000 12H14" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v12" />
      <path d="M7.5 11l4.5 4.5 4.5-4.5" />
      <path d="M4 20.5h16" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.4 6.1A10.4 10.4 0 0112 6c6 0 9.5 6 9.5 6a17.7 17.7 0 01-3.2 3.9" />
      <path d="M6.4 6.8A17 17 0 002.5 12s3.5 6.5 9.5 6.5a9.9 9.9 0 004.3-1" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 017.5-2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.9 13h9.2l.9-13" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 5.5H6a1.5 1.5 0 00-1.5 1.5v9" />
    </>
  ),
  up: <path d="M6 14l6-6 6 6" />,
  down: <path d="M6 10l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="M4.5 17l5-5 3.5 3.5 3-3 4 4.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? null}
    </svg>
  )
}
