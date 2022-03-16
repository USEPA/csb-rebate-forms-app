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

type SAMData = {
  uei: string;
};

type State = {
  isAuthenticated: boolean;
  epaUserData:
    | { status: "idle"; fields: {} }
    | { status: "fetching"; fields: {} }
    | { status: "success"; fields: EPAData }
    | { status: "failure"; fields: {} };
  samUserData:
    | { status: "idle"; fields: [] }
    | { status: "fetching"; fields: [] }
    | { status: "success"; fields: SAMData[] }
    | { status: "failure"; fields: [] };
};

type Action =
  | { type: "SIGN_IN" }
  | { type: "SIGN_OUT" }
  | { type: "FETCH_EPA_USER_DATA_REQUEST" }
  | {
      type: "FETCH_EPA_USER_DATA_SUCCESS";
      payload: { epaUserData: EPAData };
    }
  | { type: "FETCH_EPA_USER_DATA_FAILURE" }
  | { type: "FETCH_SAM_USER_DATA_REQUEST" }
  | {
      type: "FETCH_SAM_USER_DATA_SUCCESS";
      payload: { samUserData: SAMData[] };
    }
  | { type: "FETCH_SAM_USER_DATA_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SIGN_IN": {
      return {
        ...state,
        isAuthenticated: true,
      };
    }

    case "SIGN_OUT": {
      return {
        ...state,
        isAuthenticated: false,
        epaUserData: { status: "idle", fields: {} },
        samUserData: { status: "idle", fields: [] },
      };
    }

    case "FETCH_EPA_USER_DATA_REQUEST": {
      return {
        ...state,
        epaUserData: { status: "fetching", fields: {} },
      };
    }

    case "FETCH_EPA_USER_DATA_SUCCESS": {
      const { epaUserData } = action.payload;
      return {
        ...state,
        epaUserData: { status: "success", fields: epaUserData },
      };
    }

    case "FETCH_EPA_USER_DATA_FAILURE": {
      return {
        ...state,
        epaUserData: { status: "failure", fields: {} },
      };
    }

    case "FETCH_SAM_USER_DATA_REQUEST": {
      return {
        ...state,
        samUserData: { status: "fetching", fields: [] },
      };
    }

    case "FETCH_SAM_USER_DATA_SUCCESS": {
      const { samUserData } = action.payload;
      return {
        ...state,
        samUserData: { status: "success", fields: samUserData },
      };
    }

    case "FETCH_SAM_USER_DATA_FAILURE": {
      return {
        ...state,
        samUserData: { status: "failure", fields: [] },
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
    epaUserData: { status: "idle", fields: {} },
    samUserData: { status: "idle", fields: [] },
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
