import { createContext, useContext, useEffect } from 'react'

export const MetaContext = createContext({ setSubtitle: () => {}, setTitle: () => {}, setActions: () => {} })

/** Lets a page set the muted line under the top-bar title (cleared when the page unmounts). */
export function usePageSubtitle(text) {
  const { setSubtitle } = useContext(MetaContext)
  useEffect(() => {
    setSubtitle(text || '')
    return () => setSubtitle('')
  }, [text, setSubtitle])
}

/** Overrides the route's default top-bar title (e.g. "Edit session"). */
export function usePageTitle(text) {
  const { setTitle } = useContext(MetaContext)
  useEffect(() => {
    setTitle(text || '')
    return () => setTitle('')
  }, [text, setTitle])
}

/**
 * Page-action slot: puts `node` (buttons) into the top bar, left of the coach input. The node is refreshed
 * whenever `deps` change and removed when the page unmounts.
 */
export function usePageActions(node, deps) {
  const { setActions } = useContext(MetaContext)
  useEffect(() => {
    setActions(node)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => () => setActions(null), [setActions])
}
