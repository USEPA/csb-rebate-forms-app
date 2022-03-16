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

type FormSchema = object;

type FormSubmission = {
  uei: string;
  name: string;
};

type State = {
  formSchema:
    | { status: "idle"; data: {} }
    | { status: "fetching"; data: {} }
    | { status: "success"; data: FormSchema }
    | { status: "failure"; data: {} };
  formSubmissions:
    | { status: "idle"; data: [] }
    | { status: "fetching"; data: [] }
    | { status: "success"; data: FormSubmission[] }
    | { status: "failure"; data: [] };
};

type Action =
  | { type: "FETCH_FORM_SCHEMA_REQUEST" }
  | {
      type: "FETCH_FORM_SCHEMA_SUCCESS";
      payload: { formSchema: FormSchema };
    }
  | { type: "FETCH_FORM_SCHEMA_FAILURE" }
  | { type: "FETCH_FORM_SUBMISSIONS_REQUEST" }
  | {
      type: "FETCH_FORM_SUBMISSIONS_SUCCESS";
      payload: { formSubmissions: FormSubmission[] };
    }
  | { type: "FETCH_FORM_SUBMISSIONS_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_FORM_SCHEMA_REQUEST": {
      return {
        ...state,
        formSchema: { status: "fetching", data: {} },
      };
    }

    case "FETCH_FORM_SCHEMA_SUCCESS": {
      const { formSchema } = action.payload;
      return {
        ...state,
        formSchema: { status: "success", data: formSchema },
      };
    }

    case "FETCH_FORM_SCHEMA_FAILURE": {
      return {
        ...state,
        formSchema: { status: "failure", data: {} },
      };
    }

    case "FETCH_FORM_SUBMISSIONS_REQUEST": {
      return {
        ...state,
        formSchema: { status: "fetching", data: [] },
      };
    }

    case "FETCH_FORM_SUBMISSIONS_SUCCESS": {
      const { formSubmissions } = action.payload;
      return {
        ...state,
        formSubmissions: { status: "success", data: formSubmissions },
      };
    }

    case "FETCH_FORM_SUBMISSIONS_FAILURE": {
      return {
        ...state,
        formSchema: { status: "failure", data: [] },
      };
    }

    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

export function FormioProvider({ children }: Props) {
  const initialState: State = {
    formSchema: { status: "idle", data: {} },
    formSubmissions: { status: "idle", data: [] },
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
    throw new Error("useFormioState must be called within a FormioProvider");
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
    throw new Error("useFormioDispatch must be used within a FormioProvider");
  }
  return context;
}
