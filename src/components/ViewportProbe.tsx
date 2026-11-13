// Solo en desarrollo (/preview?...&vp): mide el viewport real para depurar barras fijas en Safari iOS.
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const VIEWS = ['inicio', 'explore', 'home', 'detail', 'edit', 'scan', 'recipes', 'profile', 'featured', 'coffee', 'empty', 'metrics', 'login', 'join', 'onboarding', 'unlock']

export function ViewportProbe() {
  const probe = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState('')
  const [sp, setSp] = useSearchParams()
  useEffect(() => {
    const read = () => {
      const p = probe.current
      if (!p) return
      const h = (u: string) => {
        p.style.height = u
        return Math.round(p.getBoundingClientRect().height)
      }
      p.style.paddingBottom = 'env(safe-area-inset-bottom)'
      const sab = parseFloat(getComputedStyle(p).paddingBottom)
      p.style.paddingBottom = '0'
      const vv = window.visualViewport
      setInfo(
        [
          `inner ${window.innerHeight} client ${document.documentElement.clientHeight}`,
          `vv ${vv ? Math.round(vv.height) : '-'} off ${vv ? Math.round(vv.offsetTop) : '-'}`,
          `vh ${h('100vh')} dvh ${h('100dvh')} svh ${h('100svh')} lvh ${h('100lvh')}`,
          `sab ${sab} scrollY ${Math.round(window.scrollY)} screen ${screen.height}`,
        ].join('\n'),
      )
    }
    read()
    window.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    window.visualViewport?.addEventListener('resize', read)
    return () => {
      window.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
      window.visualViewport?.removeEventListener('resize', read)
    }
  }, [])
  return (
    <>
      <div ref={probe} aria-hidden className="pointer-events-none invisible fixed top-0 left-0 w-px" />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] border-2 border-dashed border-blue-500" />
      <select
        aria-label="Vista"
        value={sp.get('v') ?? 'home'}
        onChange={(e) => setSp({ v: e.target.value, vp: '' })}
        className="fixed top-2 right-2 z-[101] rounded bg-black/80 px-2 py-1 text-[12px] text-white"
      >
        {VIEWS.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <pre className="pointer-events-none fixed top-14 left-2 z-[100] rounded bg-black/80 p-2 text-[11px] leading-tight text-white">{info}</pre>
    </>
  )
}
