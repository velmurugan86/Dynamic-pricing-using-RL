import React from 'react'

/**
 * Simple, minimal product icons for the hero section.
 * Clean silhouettes, thick ink outlines, one accent color each.
 * Pure SVG — no photos, no clutter.
 */

const INK = '#0B0C0A'
const GREEN = '#2FE070'
const GREEN_DEEP = '#17C75F'
const YELLOW = '#F6E94E'
const CREAM = '#F5F6F1'
const CORAL = '#FF6B57'
const SKY = '#5CC8FF'

function Icon({ children }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-auto" aria-hidden="true">
      <g stroke={INK} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" fill="none">
        {children}
      </g>
    </svg>
  )
}

export function TeeIcon() {
  return (
    <Icon>
      <path
        d="M32 24 L16 34 L24 48 L31 44 L31 78 Q50 84 69 78 L69 44 L76 48 L84 34 L68 24 Q60 32 50 32 Q40 32 32 24 Z"
        fill={YELLOW}
      />
    </Icon>
  )
}

export function SneakerIcon() {
  return (
    <Icon>
      <path d="M16 60 Q18 44 29 39 Q38 50 58 55 Q74 59 86 60 Z" fill={CREAM} />
      <path d="M33 47 L42 51" strokeWidth="4" />
      <rect x="12" y="59" width="76" height="15" rx="7" fill={YELLOW} />
    </Icon>
  )
}

export function BackpackIcon() {
  return (
    <Icon>
      <path d="M40 28 Q50 18 60 28" strokeWidth="4.5" />
      <rect x="29" y="28" width="42" height="52" rx="11" fill={GREEN_DEEP} />
      <path d="M29 46 Q50 56 71 46" strokeWidth="4.5" />
      <path d="M40 62 L60 62" strokeWidth="4.5" />
    </Icon>
  )
}

export function HeadphonesIcon() {
  return (
    <Icon>
      <path d="M25 58 Q25 24 50 24 Q75 24 75 58" />
      <rect x="17" y="54" width="15" height="24" rx="7" fill={CORAL} />
      <rect x="68" y="54" width="15" height="24" rx="7" fill={CORAL} />
    </Icon>
  )
}

export function GamepadIcon() {
  return (
    <Icon>
      <rect x="14" y="36" width="72" height="30" rx="15" fill={SKY} />
      <path d="M34 44 L34 58 M27 51 L41 51" strokeWidth="4.5" />
      <circle cx="64" cy="48" r="3" fill={CORAL} strokeWidth="4" />
      <circle cx="73" cy="55" r="3" fill={YELLOW} strokeWidth="4" />
    </Icon>
  )
}

export function EarbudsIcon() {
  return (
    <Icon>
      <circle cx="41" cy="28" r="8" fill={CREAM} />
      <path d="M41 36 L41 46" strokeWidth="4.5" />
      <circle cx="63" cy="24" r="8" fill={CREAM} />
      <path d="M63 32 L63 42" strokeWidth="4.5" />
      <rect x="26" y="48" width="48" height="30" rx="10" fill={YELLOW} />
      <path d="M28 58 L72 58" strokeWidth="4" />
    </Icon>
  )
}

export function KeyboardIcon() {
  return (
    <Icon>
      <rect x="10" y="34" width="80" height="34" rx="8" fill={CREAM} />
      <path d="M22 46 L34 46 M42 46 L54 46 M62 46 L78 46" strokeWidth="4.5" />
      <path d="M22 58 L52 58 M60 58 L78 58" strokeWidth="4.5" />
    </Icon>
  )
}

export function WatchIcon() {
  return (
    <Icon>
      <rect x="42" y="14" width="16" height="22" rx="4" fill={GREEN} />
      <rect x="42" y="64" width="16" height="22" rx="4" fill={GREEN} />
      <circle cx="50" cy="50" r="17" fill={CREAM} />
      <path d="M50 50 L50 41 M50 50 L57 54" strokeWidth="4" />
    </Icon>
  )
}
