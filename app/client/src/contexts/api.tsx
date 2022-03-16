import { ReactNode, createContext, useContext } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  apiUrl: string;
};

const StateContext = createContext<State | undefined>(undefined);

export function ApiProvider({ children }: Props) {
  if (!process.env.REACT_APP_API_URL) throw new Error("API URL required!");

  const state: State = {
    apiUrl: process.env.REACT_APP_API_URL,
  };

  return (
    <StateContext.Provider value={state}>{children}</StateContext.Provider>
  );
}

/**
 * Returns state stored in `ApiProvider` context component.
 */
export function useApiState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error("useApiState must be called within an ApiProvider");
  }
  return context;
}

/**
 * Returns a promise containing JSON fetched from a provided web service URL
 * or handles any other OK response returned from the server
 */
export async function fetchData(url: string, data?: object) {
  const options = !data
    ? { method: "GET" }
    : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      };

  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(res.statusText);
    const contentType = res.headers.get("content-type");
    return contentType?.includes("application/json")
      ? await res.json()
      : Promise.resolve();
  } catch (error) {
    return await Promise.reject(error);
  }
}
