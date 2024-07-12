/* eslint-disable react-refresh/only-export-components */

import {
  type Dispatch,
  type ReactNode,
  createContext,
  useContext,
  useReducer,
} from "react";
// ---
import { type RebateYear } from "@/types";

type Props = {
  children: ReactNode;
};

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

export function RebateYearProvider({ children }: Props) {
  const initialState: State = {
    rebateYear: "2023",
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
 * Returns state stored in `RebateYearProvider` context component.
 */
export function useRebateYearState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useRebateYearState must be called within an RebateYearProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Custom hook that returns `dispatch` method for dispatching actions to update
 * state stored in `RebateYearProvider` context component.
 */
function useRebateYearDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useRebateYearDispatch must be used within a RebateYearProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Custom hook that returns a function to dispatch an action to set the rebate
 * year.
 */
export function useRebateYearActions() {
  const dispatch = useRebateYearDispatch();

  return {
    setRebateYear(rebateYear: RebateYear) {
      dispatch({
        type: "SET_REBATE_YEAR",
        payload: { rebateYear },
      });
    },
  };
}
