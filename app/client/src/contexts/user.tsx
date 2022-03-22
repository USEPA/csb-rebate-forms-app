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

type EPAData = {
  firstName: string;
  lastName: string;
  email: string;
};

type State = {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  epaUserData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: EPAData }
    | { status: "failure"; data: {} };
};

type Action =
  | { type: "USER_SIGN_IN" }
  | { type: "USER_SIGN_OUT" }
  | { type: "FETCH_EPA_USER_DATA_REQUEST" }
  | {
      type: "FETCH_EPA_USER_DATA_SUCCESS";
      payload: { epaUserData: EPAData };
    }
  | { type: "FETCH_EPA_USER_DATA_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "USER_SIGN_IN": {
      return {
        ...state,
        isAuthenticated: true,
        isAuthenticating: false,
      };
    }

    case "USER_SIGN_OUT": {
      return {
        ...state,
        isAuthenticated: false,
        isAuthenticating: false,
        epaUserData: { status: "idle", data: {} },
      };
    }

    case "FETCH_EPA_USER_DATA_REQUEST": {
      return {
        ...state,
        epaUserData: { status: "pending", data: {} },
      };
    }

    case "FETCH_EPA_USER_DATA_SUCCESS": {
      const { epaUserData } = action.payload;
      return {
        ...state,
        isAuthenticating: false,
        epaUserData: { status: "success", data: epaUserData },
      };
    }

    case "FETCH_EPA_USER_DATA_FAILURE": {
      return {
        ...state,
        epaUserData: { status: "failure", data: {} },
      };
    }

    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

export function UserProvider({ children }: Props) {
  const initialState: State = {
    isAuthenticated: false,
    isAuthenticating: true,
    epaUserData: { status: "idle", data: {} },
  };

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
 * Returns state stored in `UserProvider` context component.
 */
export function useUserState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error("useUserState must be called within a UserProvider");
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `UserProvider` context component.
 */
export function useUserDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    throw new Error("useUserDispatch must be used within a UserProvider");
  }
  return context;
}
