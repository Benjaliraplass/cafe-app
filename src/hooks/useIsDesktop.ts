import { useEffect, useState } from 'react'

/** Escritorio = pantalla ancha con mouse. Un iPad (puntero táctil) o un teléfono en horizontal no cuentan. */
const QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}
