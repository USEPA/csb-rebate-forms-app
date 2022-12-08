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
  submissionPeriodOpen: {
    application: boolean;
    paymentRequest: boolean;
    closeOut: boolean;
  };
};

type State = {
  csbData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: CsbData }
    | { status: "failure"; data: {} };
};

type Action =
  | { type: "FETCH_CSB_DATA_REQUEST" }
  | {
      type: "FETCH_CSB_DATA_SUCCESS";
      payload: { csbData: CsbData };
    }
  | { type: "FETCH_CSB_DATA_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
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

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function CsbProvider({ children }: Props) {
  const initialState: State = {
    csbData: {
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
 * Returns state stored in `CsbProvider` context component.
 */
export function useCsbState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useCsbState must be called within a CsbProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `CsbProvider` context component.
 */
export function useCsbDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useCsbDispatch must be used within a CsbProvider`;
    throw new Error(message);
  }
  return context;
}
