import { createContext, useContext } from "react";

// State the shell (sidebar + top bar) shares with the page rendered inside it.
export interface ShellContextValue {
  query: string;
  setQuery: (query: string) => void;
  showToast: (message: string) => void;
  openImport: () => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useShell must be used inside the app shell");
  return shell;
}
