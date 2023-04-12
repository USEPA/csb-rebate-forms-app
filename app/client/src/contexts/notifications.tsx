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

type State = {
  displayed: boolean;
  type: "info" | "success" | "warning" | "error";
  body: ReactNode;
};

type Action =
  | {
      type: "DISPLAY_NOTIFICATION";
      payload: {
        type: "info" | "success" | "warning" | "error";
        body: ReactNode;
      };
    }
  | { type: "DISMISS_NOTIFICATION" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

const initialState: State = {
  displayed: false,
  type: "info",
  body: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "DISPLAY_NOTIFICATION": {
      const { type, body } = action.payload;
      return {
        displayed: true,
        type,
        body,
      };
    }

    case "DISMISS_NOTIFICATION": {
      const { type, body } = state;
      return {
        displayed: false,
        type,
        body,
      };
    }

    default: {
      const message = `Unhandled action type: ${action}`;
      throw new Error(message);
    }
  }
}

export function NotificationsProvider({ children }: Props) {
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
 * Returns state stored in `NotificationsProvider` context component.
 */
export function useNotificationsState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useNotificationsState must be called within a NotificationsProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `NotificationsProvider` context component.
 */
function useNotificationsDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useNotificationsDispatch must be used within a NotificationsProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Custom hook that returns functions to display each notification type (info,
 * success, warning, or error), and a function to dismiss a currently displayed
 * notification.
 */
export function useNotificationsActions() {
  const dispatch = useNotificationsDispatch();

  return {
    displayInfoNotification(body: ReactNode) {
      return dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: { type: "info" as const, body },
      });
    },
    displaySuccessNotification(body: ReactNode) {
      return dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: { type: "success" as const, body },
      });
    },
    displayWarningNotification(body: ReactNode) {
      return dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: { type: "warning" as const, body },
      });
    },
    displayErrorNotification(body: ReactNode) {
      return dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: { type: "error" as const, body },
      });
    },
    dismissNotification() {
      return dispatch({
        type: "DISMISS_NOTIFICATION",
      });
    },
  };
}
