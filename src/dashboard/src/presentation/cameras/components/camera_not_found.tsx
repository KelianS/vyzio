import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Surface = 'page' | 'tab'

// Inside a tab the camera page above already names the page: a sentence, never a second title.
const STATEMENT: Record<Surface, ReactNode> = {
  page: <h1 className="font-serif text-3xl">Caméra introuvable</h1>,
  tab: <p>Cette caméra est introuvable : elle a peut-être été supprimée.</p>,
}

/** The camera no longer exists: a real answer, so the way back rather than a retry (DESIGN SYSTEM § Errors). */
export function CameraNotFound({ within }: { within: Surface }) {
  return (
    <>
      {STATEMENT[within]}
      <Link to="/settings/cameras" className="mt-3 inline-block underline underline-offset-2">
        Revenir à la liste des caméras
      </Link>
    </>
  )
}
