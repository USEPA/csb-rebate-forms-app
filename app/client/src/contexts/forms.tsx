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

/**
 * Minimum fields required to display the user's forms on their dashboard, and
 * have the metadata needed to make an API call to the forms.gov web service to
 * retreive the form's JSON schema in order to display and edit the form.
 */
type RebateFormSubmission = {
  // NOTE: more fields are in a form.io submission,
  // but we're only concerned with the fields below
  _id: string;
  state: "submitted" | "draft";
  modified: string;
  data: {
    applicantUEI: string;
    applicantEfti: string;
    applicantOrganizationName: string;
    schoolDistrictName: string;
    last_updated_by: string;
    // (other fields...)
  };
  // (other fields...)
};

type State = {
  rebateFormSubmissions:
    | { status: "idle"; data: [] }
    | { status: "pending"; data: [] }
    | { status: "success"; data: RebateFormSubmission[] }
    | { status: "failure"; data: [] };
};

type Action =
  | { type: "FETCH_REBATE_FORM_SUBMISSIONS_REQUEST" }
  | {
      type: "FETCH_REBATE_FORM_SUBMISSIONS_SUCCESS";
      payload: {
        rebateFormSubmissions: RebateFormSubmission[];
      };
    }
  | { type: "FETCH_REBATE_FORM_SUBMISSIONS_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_REBATE_FORM_SUBMISSIONS_REQUEST": {
      return {
        ...state,
        rebateFormSubmissions: {
          status: "pending",
          data: [],
        },
      };
    }

    case "FETCH_REBATE_FORM_SUBMISSIONS_SUCCESS": {
      const { rebateFormSubmissions } = action.payload;
      return {
        ...state,
        rebateFormSubmissions: {
          status: "success",
          data: rebateFormSubmissions,
        },
      };
    }

    case "FETCH_REBATE_FORM_SUBMISSIONS_FAILURE": {
      return {
        ...state,
        rebateFormSubmissions: {
          status: "failure",
          data: [],
        },
      };
    }

    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

export function FormsProvider({ children }: Props) {
  const initialState: State = {
    rebateFormSubmissions: {
      status: "idle",
      data: [],
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
 * Returns state stored in `FormsProvider` context component.
 */
export function useFormsState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error("useFormsState must be called within a FormsProvider");
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `FormsProvider` context component.
 */
export function useFormsDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    throw new Error("useFormsDispatch must be used within a FormsProvider");
  }
  return context;
}
