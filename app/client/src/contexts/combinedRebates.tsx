import {
  Dispatch,
  ReactNode,
  createContext,
  useContext,
  useReducer,
} from "react";
// ---
import type {
  FormioApplicationSubmission,
  FormioPaymentRequestSubmission,
  FormioCloseOutSubmission,
} from "contexts/formioSubmissions";

type Props = {
  children: ReactNode;
};

export type FormioSubmission =
  | FormioApplicationSubmission
  | FormioPaymentRequestSubmission
  | FormioCloseOutSubmission;

export type BapSubmission = {
  modified: string | null;
  comboKey: string | null;
  rebateId: string | null;
  reviewItemId: string | null;
  status: string | null;
};

export type Rebate = {
  application: {
    formio: FormioApplicationSubmission;
    bap: BapSubmission | null;
  };
  paymentRequest: {
    formio: FormioPaymentRequestSubmission | null;
    bap: BapSubmission | null;
  };
  closeOut: {
    formio: FormioCloseOutSubmission | null;
    bap: BapSubmission | null;
  };
};

type State = {
  rebates: Rebate[];
};

type Action =
  | {
      type: "SET_COMBINED_REBATES";
      payload: { rebates: Rebate[] };
    }
  | { type: "RESET_COMBINED_REBATES" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_COMBINED_REBATES": {
      const { rebates } = action.payload;

      return {
        ...state,
        rebates,
      };
    }

    case "RESET_COMBINED_REBATES": {
      return {
        ...state,
        rebates: [],
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function CombinedRebatesProvider({ children }: Props) {
  const initialState: State = {
    rebates: [],
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
 * Returns state stored in `CombinedRebatesProvider` context component.
 */
export function useCombinedRebatesState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useCombinedRebatesState must be called within a CombinedRebatesProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `CombinedRebatesProvider` context component.
 */
export function useCombinedRebatesDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useCombinedRebatesDispatch must be used within a CombinedRebatesProvider`;
    throw new Error(message);
  }
  return context;
}
