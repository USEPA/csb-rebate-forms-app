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

type Content = {
  siteAlert: string;
  helpdeskIntro: string;
  allRebatesIntro: string;
  allRebatesOutro: string;
  newApplicationDialog: string;
  draftApplicationIntro: string;
  submittedApplicationIntro: string;
};

type State = {
  content:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: Content }
    | { status: "failure"; data: {} };
};

export type Action =
  | { type: "FETCH_CONTENT_REQUEST" }
  | {
      type: "FETCH_CONTENT_SUCCESS";
      payload: Content;
    }
  | { type: "FETCH_CONTENT_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_CONTENT_REQUEST": {
      return {
        ...state,
        content: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_CONTENT_SUCCESS": {
      const {
        siteAlert,
        helpdeskIntro,
        allRebatesIntro,
        allRebatesOutro,
        newApplicationDialog,
        draftApplicationIntro,
        submittedApplicationIntro,
      } = action.payload;

      return {
        ...state,
        content: {
          status: "success",
          data: {
            siteAlert,
            helpdeskIntro,
            allRebatesIntro,
            allRebatesOutro,
            newApplicationDialog,
            draftApplicationIntro,
            submittedApplicationIntro,
          },
        },
      };
    }

    case "FETCH_CONTENT_FAILURE": {
      return {
        ...state,
        content: {
          status: "failure",
          data: {},
        },
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function ContentProvider({ children }: Props) {
  const initialState: State = {
    content: {
      status: "idle",
      data: {},
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
 * Returns state stored in `ContentProvider` context component.
 */
export function useContentState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useContentState must be called within a ContentProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `ContentProvider` context component.
 */
export function useContentDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useContentDispatch must be used within a ContentProvider`;
    throw new Error(message);
  }
  return context;
}
