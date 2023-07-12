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

export type RebateYear = "2022" | "2023";

type State = {
  rebateYear: RebateYear;
};

type Action = {
  type: "SET_REBATE_YEAR";
  payload: { rebateYear: RebateYear };
};

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_REBATE_YEAR": {
      const { rebateYear } = action.payload;

      return {
        ...state,
        rebateYear,
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function YearProvider({ children }: Props) {
  const initialState: State = {
    rebateYear: "2022",
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
 * Returns state stored in `YearProvider` context component.
 */
export function useYearState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error("useYearState must be called within an YearProvider");
  }
  return context;
}

/**
 * Custom hook that returns `dispatch` method for dispatching actions to update
 * state stored in `DialogProvider` context component.
 */
function useYearDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useYearDispatch must be used within a YearProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Custom hook that returns a function to dispatch an action to set the rebate
 * year.
 */
export function useYearActions() {
  const dispatch = useYearDispatch();

  return {
    setRebateYear(rebateYear: RebateYear) {
      dispatch({
        type: "SET_REBATE_YEAR",
        payload: { rebateYear },
      });
    },
  };
}
