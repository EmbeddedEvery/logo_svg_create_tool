import { useEffect, useState } from 'react'

const round = (v: number) => Math.round(v * 100) / 100

export function NumField({
  label,
  value,
  onChange,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  suffix?: string
}) {
  const [draft, setDraft] = useState(String(round(value)))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(round(value)))
  }, [value, focused])

  return (
    <label className="num-field">
      <span className="num-label">{label}</span>
      <input
        type="number"
        value={draft}
        step={step}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          const v = parseFloat(draft)
          if (!Number.isNaN(v)) onChange(v)
          else setDraft(String(round(value)))
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const none = !value || value === 'none'
  return (
    <div className="color-field">
      <span className="field-label">{label}</span>
      <div className="color-row">
        <label className="swatch" style={{ background: none ? 'transparent' : value }}>
          <input
            type="color"
            value={none ? '#111111' : value}
            onChange={(e) => onChange(e.target.value)}
          />
          {none && <span className="swatch-none" />}
        </label>
        <input
          className="hex"
          value={none ? 'none' : value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
        <button
          className={`mini ${none ? 'on' : ''}`}
          onClick={() => onChange(none ? '#111111' : 'none')}
          title={none ? '启用颜色' : '设为无色'}
        >
          无
        </button>
      </div>
    </div>
  )
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="slider-field">
      <span className="field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="slider-value">{Math.round(value * 100)}</span>
    </label>
  )
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="row">{children}</div>
}

export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="section">
      <div className="section-title">{title}</div>
      {children}
    </div>
  )
}
