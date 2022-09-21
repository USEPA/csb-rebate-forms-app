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

export type FormioSubmissionData = {
  [field: string]: unknown;
  hidden_current_user_email?: string;
  hidden_current_user_title?: string;
  hidden_current_user_name?: string;
  bap_hidden_entity_combo_key?: string;
};

type FormioSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  data: FormioSubmissionData;
  state: "submitted" | "draft";
};

type NoFormioData = { userAccess: false; formSchema: null; submission: null };

export type FormioFetchedResponse =
  | NoFormioData
  | {
      userAccess: true;
      formSchema: { url: string; json: object };
      submission: FormioSubmission;
    };

type State = {
  message: {
    displayed: boolean;
    type: "info" | "success" | "warning" | "error";
    text: string;
  };
  formio:
    | { status: "idle"; data: NoFormioData }
    | { status: "pending"; data: NoFormioData }
    | { status: "success"; data: FormioFetchedResponse }
    | { status: "failure"; data: NoFormioData };
};

type Action =
  | { type: "RESET_STATE" }
  | {
      type: "DISPLAY_MESSAGE";
      payload: { type: "info" | "success" | "warning" | "error"; text: string };
    }
  | { type: "RESET_MESSAGE" }
  | { type: "FETCH_FORMIO_DATA_REQUEST" }
  | {
      type: "FETCH_FORMIO_DATA_SUCCESS";
      payload: { data: FormioFetchedResponse };
    }
  | { type: "FETCH_FORMIO_DATA_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

const initialState: State = {
  message: {
    displayed: false,
    type: "info",
    text: "",
  },
  formio: {
    status: "idle",
    data: {
      userAccess: false,
      formSchema: null,
      submission: null,
    },
  },
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RESET_STATE": {
      return initialState;
    }

    case "DISPLAY_MESSAGE": {
      const { type, text } = action.payload;
      return {
        ...state,
        message: {
          displayed: true,
          type,
          text,
        },
      };
    }

    case "RESET_MESSAGE": {
      return {
        ...state,
        message: {
          displayed: false,
          type: "info",
          text: "",
        },
      };
    }

    case "FETCH_FORMIO_DATA_REQUEST": {
      return {
        ...state,
        formio: {
          status: "pending",
          data: {
            userAccess: false,
            formSchema: null,
            submission: null,
          },
        },
      };
    }

    case "FETCH_FORMIO_DATA_SUCCESS": {
      const { data } = action.payload;
      return {
        ...state,
        formio: {
          status: "success",
          data,
        },
      };
    }

    case "FETCH_FORMIO_DATA_FAILURE": {
      return {
        ...state,
        formio: {
          status: "failure",
          data: {
            userAccess: false,
            formSchema: null,
            submission: null,
          },
        },
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function PageProvider({ children }: Props) {
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
 * Returns state stored in `PageProvider` context component.
 */
export function usePageState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `usePageState must be called within a PageProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `PageProvider` context component.
 */
export function usePageDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `usePageDispatch must be used within a PageProvider`;
    throw new Error(message);
  }
  return context;
}
