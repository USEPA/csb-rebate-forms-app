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

type CsbData = {
  enrollmentClosed: boolean;
};

type EpaUserData = {
  mail: string;
  memberof: string;
  exp: number;
};

type State = {
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  csbData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: CsbData }
    | { status: "failure"; data: {} };
  epaUserData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: EpaUserData }
    | { status: "failure"; data: {} };
};

type Action =
  | { type: "USER_SIGN_IN" }
  | { type: "USER_SIGN_OUT" }
  | { type: "FETCH_CSB_DATA_REQUEST" }
  | {
      type: "FETCH_CSB_DATA_SUCCESS";
      payload: { csbData: CsbData };
    }
  | { type: "FETCH_CSB_DATA_FAILURE" }
  | { type: "FETCH_EPA_USER_DATA_REQUEST" }
  | {
      type: "FETCH_EPA_USER_DATA_SUCCESS";
      payload: { epaUserData: EpaUserData };
    }
  | { type: "FETCH_EPA_USER_DATA_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "USER_SIGN_IN": {
      return {
        ...state,
        isAuthenticating: false,
        isAuthenticated: true,
      };
    }

    case "USER_SIGN_OUT": {
      return {
        ...state,
        isAuthenticating: false,
        isAuthenticated: false,
        csbData: {
          status: "idle",
          data: {},
        },
        epaUserData: {
          status: "idle",
          data: {},
        },
      };
    }

    case "FETCH_CSB_DATA_REQUEST": {
      return {
        ...state,
        csbData: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_CSB_DATA_SUCCESS": {
      const { csbData } = action.payload;
      return {
        ...state,
        csbData: {
          status: "success",
          data: csbData,
        },
      };
    }

    case "FETCH_CSB_DATA_FAILURE": {
      return {
        ...state,
        csbData: {
          status: "failure",
          data: {},
        },
      };
    }

    case "FETCH_EPA_USER_DATA_REQUEST": {
      return {
        ...state,
        epaUserData: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_EPA_USER_DATA_SUCCESS": {
      const { epaUserData } = action.payload;
      return {
        ...state,
        epaUserData: {
          status: "success",
          data: epaUserData,
        },
      };
    }

    case "FETCH_EPA_USER_DATA_FAILURE": {
      return {
        ...state,
        epaUserData: {
          status: "failure",
          data: {},
        },
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function UserProvider({ children }: Props) {
  const initialState: State = {
    isAuthenticating: true,
    isAuthenticated: false,
    csbData: {
      status: "idle",
      data: {},
    },
    epaUserData: {
      status: "idle",
      data: {},
    },
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
    const message = `useUserState must be called within a UserProvider`;
    throw new Error(message);
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
    const message = `useUserDispatch must be used within a UserProvider`;
    throw new Error(message);
  }
  return context;
}
