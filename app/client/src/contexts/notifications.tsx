import type { Dispatch, ReactNode } from "react";
import { createContext, useContext, useReducer } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  displayed: boolean;
  id: number;
  type: "info" | "success" | "warning" | "error";
  body: ReactNode;
};

type Action =
  | {
      type: "DISPLAY_NOTIFICATION";
      payload: {
        id: number;
        type: "info" | "success" | "warning" | "error";
        body: ReactNode;
      };
    }
  | {
      type: "DISMISS_NOTIFICATION";
      payload: {
        id: number;
      };
    };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

const initialState: State = {
  displayed: false,
  id: 0,
  type: "info",
  body: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "DISPLAY_NOTIFICATION": {
      const { id, type, body } = action.payload;
      return {
        displayed: true,
        id,
        type,
        body,
      };
    }

    case "DISMISS_NOTIFICATION": {
      const { id } = action.payload;

      /**
       * NOTE: id is passed in action's payload, as we sometimes dispatch this
       * action in a setTimeout... so we only want to dismiss the notification
       * if the id passed matches the stored id in state, or if the id passed
       * is zero (used to manually dismiss notifications)
       */

      if (id === 0 || id === state.id) {
        return {
          displayed: false,
          id: 0,
          type: state.type,
          body: state.body,
        };
      }

      return state;
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
 * Custom hook that returns state stored in `NotificationsProvider` context
 * component.
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
 * Custom hook that returns `dispatch` method for dispatching actions to update
 * state stored in `NotificationsProvider` context component.
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
 * Custom hook that returns functions to dispatch actions to display each
 * notification type (info, success, warning, or error), and dismiss a currently
 * displayed notification.
 */
export function useNotificationsActions() {
  const dispatch = useNotificationsDispatch();

  return {
    displayInfoNotification(options: { id: number; body: ReactNode }) {
      dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: {
          type: "info" as const,
          id: options.id,
          body: options.body,
        },
      });
    },
    displaySuccessNotification(options: { id: number; body: ReactNode }) {
      dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: {
          type: "success" as const,
          id: options.id,
          body: options.body,
        },
      });
    },
    displayWarningNotification(options: { id: number; body: ReactNode }) {
      dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: {
          type: "warning" as const,
          id: options.id,
          body: options.body,
        },
      });
    },
    displayErrorNotification(options: { id: number; body: ReactNode }) {
      dispatch({
        type: "DISPLAY_NOTIFICATION",
        payload: {
          type: "error" as const,
          id: options.id,
          body: options.body,
        },
      });
    },
    dismissNotification(options: { id: number }) {
      dispatch({
        type: "DISMISS_NOTIFICATION",
        payload: {
          id: options.id,
        },
      });
    },
  };
}
