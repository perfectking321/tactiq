import { createContext, useContext } from 'react'

export const CoachContext = createContext({ openCoach: () => {}, closeCoach: () => {}, toggleCoach: () => {}, open: false })

/** openCoach(prefillText?) opens the docked AI coach (the text is only prefilled, never sent). */
export const useCoach = () => useContext(CoachContext)

/** Full copilot state (messages, draft...) for the panel itself. */
export const CoachStateContext = createContext(null)
export const useCoachState = () => useContext(CoachStateContext)

