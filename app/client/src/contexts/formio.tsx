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
  uid: string;
};

type State = {
  formSchema: FormSchema;
  formSubmissions: FormSubmission[];
};

type Action =
  | {
      type: "GET_FORM_SCHEMA";
      payload: { formSchema: FormSchema };
    }
  | {
      type: "GET_FORM_SUBMISSIONS";
      payload: { formSubmissions: FormSubmission[] };
    };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "GET_FORM_SCHEMA": {
      const { formSchema } = action.payload;
      return {
        ...state,
        formSchema,
      };
    }

    case "GET_FORM_SUBMISSIONS": {
      const { formSubmissions } = action.payload;
      return {
        ...state,
        formSubmissions,
      };
    }

    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

export function FormioProvider({ children }: Props) {
  const initialState: State = {
    formSchema: {},
    formSubmissions: [],
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
