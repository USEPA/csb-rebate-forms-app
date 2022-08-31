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

type ApplicationFormSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
    applicantUEI: string;
    applicantEfti: string;
    applicantEfti_display: string;
    applicantOrganizationName: string;
    schoolDistrictName: string;
    last_updated_by: string;
  };
};

type PaymentFormSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
  };
};

type State = {
  applicationFormSubmissions:
    | { status: "idle"; data: [] }
    | { status: "pending"; data: [] }
    | { status: "success"; data: ApplicationFormSubmission[] }
    | { status: "failure"; data: [] };
  paymentFormSubmissions:
    | { status: "idle"; data: [] }
    | { status: "pending"; data: [] }
    | { status: "success"; data: PaymentFormSubmission[] }
    | { status: "failure"; data: [] };
};

type Action =
  | { type: "FETCH_APPLICATION_FORM_SUBMISSIONS_REQUEST" }
  | {
      type: "FETCH_APPLICATION_FORM_SUBMISSIONS_SUCCESS";
      payload: {
        applicationFormSubmissions: ApplicationFormSubmission[];
      };
    }
  | { type: "FETCH_APPLICATION_FORM_SUBMISSIONS_FAILURE" }
  | { type: "FETCH_PAYMENT_FORM_SUBMISSIONS_REQUEST" }
  | { type: "FETCH_PAYMENT_FORM_SUBMISSIONS_REQUEST" }
  | {
      type: "FETCH_PAYMENT_FORM_SUBMISSIONS_SUCCESS";
      payload: {
        paymentFormSubmissions: PaymentFormSubmission[];
      };
    }
  | { type: "FETCH_PAYMENT_FORM_SUBMISSIONS_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_APPLICATION_FORM_SUBMISSIONS_REQUEST": {
      return {
        ...state,
        applicationFormSubmissions: {
          status: "pending",
          data: [],
        },
      };
    }

    case "FETCH_APPLICATION_FORM_SUBMISSIONS_SUCCESS": {
      const { applicationFormSubmissions } = action.payload;
      return {
        ...state,
        applicationFormSubmissions: {
          status: "success",
          data: applicationFormSubmissions,
        },
      };
    }

    case "FETCH_APPLICATION_FORM_SUBMISSIONS_FAILURE": {
      return {
        ...state,
        applicationFormSubmissions: {
          status: "failure",
          data: [],
        },
      };
    }

    case "FETCH_PAYMENT_FORM_SUBMISSIONS_REQUEST": {
      return {
        ...state,
        paymentFormSubmissions: {
          status: "pending",
          data: [],
        },
      };
    }

    case "FETCH_PAYMENT_FORM_SUBMISSIONS_SUCCESS": {
      const { paymentFormSubmissions } = action.payload;
      return {
        ...state,
        paymentFormSubmissions: {
          status: "success",
          data: paymentFormSubmissions,
        },
      };
    }

    case "FETCH_PAYMENT_FORM_SUBMISSIONS_FAILURE": {
      return {
        ...state,
        paymentFormSubmissions: {
          status: "failure",
          data: [],
        },
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function FormsProvider({ children }: Props) {
  const initialState: State = {
    applicationFormSubmissions: {
      status: "idle",
      data: [],
    },
    paymentFormSubmissions: {
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
    const message = `useFormsState must be called within a FormsProvider`;
    throw new Error(message);
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
    const message = `useFormsDispatch must be used within a FormsProvider`;
    throw new Error(message);
  }
  return context;
}
