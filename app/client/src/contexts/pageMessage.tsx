import {
  Dispatch,
  ReactNode,
  createContext,
  useContext,
  useReducer,
} from "react";

type Props = {
  children: ReactNode;
};

type State = {
  displayed: boolean;
  type: "info" | "success" | "warning" | "error";
  text: string;
};

type Action =
  | {
      type: "DISPLAY_MESSAGE";
      payload: { type: "info" | "success" | "warning" | "error"; text: string };
    }
  | { type: "RESET_MESSAGE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

const initialState: State = {
  displayed: false,
  type: "info",
  text: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "DISPLAY_MESSAGE": {
      const { type, text } = action.payload;
      return {
        displayed: true,
        type,
        text,
      };
    }

    case "RESET_MESSAGE": {
      return {
        displayed: false,
        type: "info",
        text: "",
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function PageMessageProvider({ children }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

/**
 * Returns state stored in `PageMessageProvider` context component.
 */
export function usePageMessageState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `usePageMessageState must be called within a PageMessageProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `PageMessageProvider` context component.
 */
export function usePageMessageDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `usePageMessageDispatch must be used within a PageMessageProvider`;
    throw new Error(message);
  }
  return context;
}
