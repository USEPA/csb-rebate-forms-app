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

export type ApplicationFormSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
    // fields injected by wrapper upon new application creation:
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
