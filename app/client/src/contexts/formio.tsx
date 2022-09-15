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

export type FormioApplicationSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
    // fields injected upon new draft Application submission creation:
    last_updated_by: string;
    hidden_current_user_email: string;
    hidden_current_user_title: string;
    hidden_current_user_name: string;
    bap_hidden_entity_combo_key: string;
    sam_hidden_applicant_email: string;
    sam_hidden_applicant_title: string;
    sam_hidden_applicant_name: string;
    sam_hidden_applicant_efti: string;
    sam_hidden_applicant_uei: string;
    sam_hidden_applicant_organization_name: string;
    sam_hidden_applicant_street_address_1: string;
    sam_hidden_applicant_street_address_2: string;
    sam_hidden_applicant_city: string;
    sam_hidden_applicant_state: string;
    sam_hidden_applicant_zip_code: string;
    // fields set by form definition (among others):
    applicantUEI: string;
    applicantEfti: string;
    applicantEfti_display: string;
    applicantOrganizationName: string;
    schoolDistrictName: string;
  };
};

type FormioPaymentRequestSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
    // fields injected upon new draft Payment Request submission creation:
    last_updated_by: string;
    hidden_current_user_email: string;
    hidden_current_user_title: string;
    hidden_current_user_name: string;
    bap_hidden_entity_combo_key: string;
    hidden_bap_rebate_id: string;
  };
};

type State = {
  applicationSubmissions:
    | { status: "idle"; data: [] }
    | { status: "pending"; data: [] }
    | { status: "success"; data: FormioApplicationSubmission[] }
    | { status: "failure"; data: [] };
  paymentRequestSubmissions:
    | { status: "idle"; data: [] }
    | { status: "pending"; data: [] }
    | { status: "success"; data: FormioPaymentRequestSubmission[] }
    | { status: "failure"; data: [] };
};

type Action =
  | { type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_REQUEST" }
  | {
      type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_SUCCESS";
      payload: {
        applicationSubmissions: FormioApplicationSubmission[];
      };
    }
  | { type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_FAILURE" }
  | { type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_REQUEST" }
  | { type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_REQUEST" }
  | {
      type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_SUCCESS";
      payload: {
        paymentRequestSubmissions: FormioPaymentRequestSubmission[];
      };
    }
  | { type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_FORMIO_APPLICATION_SUBMISSIONS_REQUEST": {
      return {
        ...state,
        applicationSubmissions: {
          status: "pending",
          data: [],
        },
      };
    }

    case "FETCH_FORMIO_APPLICATION_SUBMISSIONS_SUCCESS": {
      const { applicationSubmissions } = action.payload;
      return {
        ...state,
        applicationSubmissions: {
          status: "success",
          data: applicationSubmissions,
        },
      };
    }

    case "FETCH_FORMIO_APPLICATION_SUBMISSIONS_FAILURE": {
      return {
        ...state,
        applicationSubmissions: {
          status: "failure",
          data: [],
        },
      };
    }

    case "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_REQUEST": {
      return {
        ...state,
        paymentRequestSubmissions: {
          status: "pending",
          data: [],
        },
      };
    }

    case "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_SUCCESS": {
      const { paymentRequestSubmissions } = action.payload;
      return {
        ...state,
        paymentRequestSubmissions: {
          status: "success",
          data: paymentRequestSubmissions,
        },
      };
    }

    case "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_FAILURE": {
      return {
        ...state,
        paymentRequestSubmissions: {
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

export function FormioProvider({ children }: Props) {
  const initialState: State = {
    applicationSubmissions: {
      status: "idle",
      data: [],
    },
    paymentRequestSubmissions: {
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
 * Returns state stored in `FormioProvider` context component.
 */
export function useFormioState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useFormioState must be called within a FormioProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `FormioProvider` context component.
 */
export function useFormioDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useFormioDispatch must be used within a FormioProvider`;
    throw new Error(message);
  }
  return context;
}
