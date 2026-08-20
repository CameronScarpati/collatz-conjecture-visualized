import { BlockMath, InlineMath } from 'react-katex'

/* Thin wrappers so the rest of the UI never imports the KaTeX bindings
   directly. JSX attribute strings pass TeX backslashes through raw. */

interface MathProps {
  tex: string
}

export function MathBlock({ tex }: MathProps) {
  return <BlockMath math={tex} />
}

export function MathInline({ tex }: MathProps) {
  return <InlineMath math={tex} />
}
