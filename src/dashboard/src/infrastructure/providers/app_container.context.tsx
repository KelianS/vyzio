import { createContext, useContext, type ReactNode } from 'react'
import { appContainer, type AppContainer } from './app.container'

const AppContainerContext = createContext<AppContainer>(appContainer)

export function AppContainerProvider({ children }: { children: ReactNode }) {
  return (
    <AppContainerContext.Provider value={appContainer}>{children}</AppContainerContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppContainer(): AppContainer {
  return useContext(AppContainerContext)
}
