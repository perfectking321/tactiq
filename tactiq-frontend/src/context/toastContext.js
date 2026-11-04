import { createContext, useContext } from 'react'

export const ToastContext = createContext({ toast: () => {} })

/** toast('Session saved') shows a small bottom-right message for ~2.5 s. */
export const useToast = () => useContext(ToastContext).toast
