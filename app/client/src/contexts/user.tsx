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

export type EPAUserData = {
  givenname: string;
  mail: string;
  memberof: string;
  uid: string;
};

export type SAMUserData = {
  ALT_ELEC_BUS_POC_EMAIL__c: string | null;
  ALT_ELEC_BUS_POC_NAME__c: string | null;
  ALT_GOVT_BUS_POC_EMAIL__c: string | null;
  ALT_GOVT_BUS_POC_NAME__c: string | null;
  CAGE_CODE__c: string;
  ELEC_BUS_POC_EMAIL__c: string | null;
  ELEC_BUS_POC_NAME__c: string | null;
  ENTITY_COMBO_KEY__c: string;
  ENTITY_EFT_INDICATOR__c: string;
  ENTITY_STATUS__c: string;
  GOVT_BUS_POC_EMAIL__c: string;
  GOVT_BUS_POC_NAME__c: string;
  Name: string;
  PHYSICAL_ADDRESS_CITY__c: string;
  PHYSICAL_ADDRESS_LINE_1__c: string;
  PHYSICAL_ADDRESS_LINE_2__c: string | null;
  PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c: string;
  PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c: string;
  PHYSICAL_ADDRESS_ZIP_CODE_4__c: string;
  UNIQUE_ENTITY_ID__c: string;
  attributes: { type: string; url: string };
};

type UserData = {
  epaUserData: EPAUserData;
  samUserData: SAMUserData[];
};

type State = {
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  userData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: UserData }
    | { status: "failure"; data: {} };
};

type Action =
  | { type: "USER_SIGN_IN" }
  | { type: "USER_SIGN_OUT" }
  | { type: "FETCH_USER_DATA_REQUEST" }
  | {
      type: "FETCH_USER_DATA_SUCCESS";
      payload: {
        epaUserData: EPAUserData;
        samUserData: SAMUserData[];
      };
    }
  | { type: "FETCH_USER_DATA_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "USER_SIGN_IN": {
      return {
        ...state,
        isAuthenticating: false,
        isAuthenticated: true,
      };
    }

    case "USER_SIGN_OUT": {
      return {
        ...state,
        isAuthenticating: false,
        isAuthenticated: false,
        userData: {
          status: "idle",
          data: {},
        },
      };
    }

    case "FETCH_USER_DATA_REQUEST": {
      return {
        ...state,
        userData: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_USER_DATA_SUCCESS": {
      const { epaUserData, samUserData } = action.payload;
      return {
        ...state,
        userData: {
          status: "success",
          data: { epaUserData, samUserData },
        },
      };
    }

    case "FETCH_USER_DATA_FAILURE": {
      return {
        ...state,
        userData: {
          status: "failure",
          data: {},
        },
      };
    }

    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

export function UserProvider({ children }: Props) {
  const initialState: State = {
    isAuthenticating: true,
    isAuthenticated: false,
    userData: {
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
 * Returns state stored in `UserProvider` context component.
 */
export function useUserState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error("useUserState must be called within a UserProvider");
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `UserProvider` context component.
 */
export function useUserDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    throw new Error("useUserDispatch must be used within a UserProvider");
  }
  return context;
}
