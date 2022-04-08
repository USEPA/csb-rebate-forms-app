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
  dialogShown: boolean;
  dismissable: boolean;
  heading: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  confirmedAction: () => void;
};

export type Action =
  | {
      type: "DISPLAY_DIALOG";
      payload: {
        dismissable: boolean;
        heading: string;
        description: string;
        confirmText: string;
        cancelText?: string;
        confirmedAction: () => void;
      };
    }
  | {
      type: "UPDATE_DIALOG_DESCRIPTION";
      payload: {
        description: string;
      };
    }
  | { type: "RESET_DIALOG" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "DISPLAY_DIALOG": {
      const {
        heading,
        description,
        confirmText,
        cancelText,
        dismissable,
        confirmedAction,
      } = action.payload;

      return {
        dialogShown: true,
        dismissable,
        heading,
        description,
        confirmText,
        cancelText,
        confirmedAction,
      };
    }

    case "UPDATE_DIALOG_DESCRIPTION": {
      const { description } = action.payload;
      return {
        ...state,
        description,
      };
    }

    case "RESET_DIALOG": {
      return {
        dialogShown: false,
        dismissable: true,
        heading: "",
        description: "",
        confirmText: "",
        cancelText: "",
        confirmedAction: () => {},
      };
    }

    /* istanbul ignore next: cannot test */
    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

export function DialogProvider({ children }: Props) {
  const initialState: State = {
    dialogShown: false,
    dismissable: true,
    heading: "",
    description: "",
    confirmText: "",
    cancelText: "",
    confirmedAction: () => {},
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
 * Returns state stored in `DialogProvider` context component.
 */
export function useDialogState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    /* istanbul ignore next: cannot test */
    throw new Error("useDialogState must be called within a DialogProvider");
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `DialogProvider` context component.
 */
export function useDialogDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    /* istanbul ignore next: cannot test */
    throw new Error("useDialogDispatch must be used within a DialogProvider");
  }
  return context;
}
