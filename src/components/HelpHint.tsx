import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface HelpHintProps {
  label: string
  text: string
}

export function HelpHint({ label, text }: HelpHintProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const tooltipRef = useRef<HTMLSpanElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const screenPadding = 8
    const gap = 8

    let left = triggerRect.left + triggerRect.width / 2
    left = Math.max(screenPadding + tooltipRect.width / 2, left)
    left = Math.min(window.innerWidth - screenPadding - tooltipRect.width / 2, left)

    let top = triggerRect.top - tooltipRect.height - gap
    if (top < screenPadding) top = screenPadding

    setPosition({ left, top })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const frame = window.requestAnimationFrame(updatePosition)

    const handleReposition = () => updatePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, updatePosition])

  return (
    <span
      className="help-hint"
      aria-label={label}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={() => setIsOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        className="help-trigger"
        aria-label={label}
      >
        ?
      </button>
      {typeof document !== 'undefined'
        ? createPortal(
            <span
              ref={tooltipRef}
              role="tooltip"
              className={`help-tooltip ${isOpen ? 'open' : ''}`}
              style={{ left: `${position.left}px`, top: `${position.top}px` }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}