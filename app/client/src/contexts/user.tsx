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
  uid: string;
};

type State = {
  isAuthenticated: boolean;
  epaData: EPAData;
  samData: SAMData[];
};

type Action =
  | { type: "SIGN_IN" }
  | { type: "SIGN_OUT" }
  | {
      type: "SET_USER_DATA";
      payload: { epaData: EPAData };
    }
  | {
      type: "SET_SAM_DATA";
      payload: { samData: SAMData[] };
    };

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
        epaData: {
          firstName: "",
          lastName: "",
          email: "",
        },
        samData: [],
      };
    }

    case "SET_USER_DATA": {
      const { epaData } = action.payload;
      return {
        ...state,
        epaData,
      };
    }

    case "SET_SAM_DATA": {
      const { samData } = action.payload;
      return {
        ...state,
        samData,
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
    epaData: {
      firstName: "",
      lastName: "",
      email: "",
    },
    samData: [],
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
