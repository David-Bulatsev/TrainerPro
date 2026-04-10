import { createContext, ReactNode } from "react";

const ViewContext = createContext<undefined>(undefined);

type ProviderProps = { children: ReactNode };

export function ViewProvider({ children }: ProviderProps) {
  return <ViewContext.Provider value={undefined}>{children}</ViewContext.Provider>;
}


