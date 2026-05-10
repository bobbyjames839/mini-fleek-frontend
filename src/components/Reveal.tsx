import type { ReactNode } from 'react'
import { useReveal } from '../lib/useReveal'

interface RevealProps {
  children: ReactNode
  className?: string
  delayMs?: number
  as?: 'div' | 'section' | 'article'
}

// Wrap a section to fade-and-rise it into view when scrolled into the viewport.
export function Reveal({ children, className = '', delayMs = 0, as = 'div' }: RevealProps) {
  const ref = useReveal<HTMLDivElement>()
  const Tag = as as 'div'
  return (
    <Tag
      ref={ref}
      className={`fleek-reveal ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
