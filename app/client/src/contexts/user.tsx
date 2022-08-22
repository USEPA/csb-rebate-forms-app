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

type CsbData = {
  enrollmentClosed: boolean;
};

type EpaUserData = {
  mail: string;
  memberof: string;
  exp: number;
};

export type SamEntityData = {
  ENTITY_COMBO_KEY__c: string;
  UNIQUE_ENTITY_ID__c: string;
  ENTITY_EFT_INDICATOR__c: string;
  CAGE_CODE__c: string;
  ENTITY_STATUS__c: "Active" | string;
  LEGAL_BUSINESS_NAME__c: string;
  PHYSICAL_ADDRESS_LINE_1__c: string;
  PHYSICAL_ADDRESS_LINE_2__c: string | null;
  PHYSICAL_ADDRESS_CITY__c: string;
  PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c: string;
  PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c: string;
  PHYSICAL_ADDRESS_ZIP_CODE_4__c: string;
  // contacts
  ELEC_BUS_POC_EMAIL__c: string | null;
  ELEC_BUS_POC_NAME__c: string | null;
  ELEC_BUS_POC_TITLE__c: string | null;
  //
  ALT_ELEC_BUS_POC_EMAIL__c: string | null;
  ALT_ELEC_BUS_POC_NAME__c: string | null;
  ALT_ELEC_BUS_POC_TITLE__c: string | null;
  //
  GOVT_BUS_POC_EMAIL__c: string | null;
  GOVT_BUS_POC_NAME__c: string | null;
  GOVT_BUS_POC_TITLE__c: string | null;
  //
  ALT_GOVT_BUS_POC_EMAIL__c: string | null;
  ALT_GOVT_BUS_POC_NAME__c: string | null;
  ALT_GOVT_BUS_POC_TITLE__c: string | null;
  //
  attributes: { type: string; url: string };
};

type BapSubmissionData = {
  CSB_Form_ID__c: string; // MongoDB ObjectId string
  CSB_Modified_Full_String__c: string; // ISO 8601 date string
  UEI_EFTI_Combo_Key__c: string;
  Parent_Rebate_ID__c: string; // CSB Rebate ID
  Parent_CSB_Rebate__r: {
    CSB_Rebate_Status__c: "Draft" | "Submitted" | "Edits Requested";
    attributes: { type: string; url: string };
  };
  attributes: { type: string; url: string };
};

type State = {
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  csbData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: CsbData }
    | { status: "failure"; data: {} };
  epaUserData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | { status: "success"; data: EpaUserData }
    | { status: "failure"; data: {} };
  bapUserData:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | {
        status: "success";
        data:
          | {
              samResults: false;
              samEntities: [];
              rebateSubmissions: [];
            }
          | {
              samResults: true;
              samEntities: SamEntityData[];
              rebateSubmissions: BapSubmissionData[];
            };
      }
    | { status: "failure"; data: {} };
};

type Action =
  | { type: "USER_SIGN_IN" }
  | { type: "USER_SIGN_OUT" }
  | { type: "FETCH_CSB_DATA_REQUEST" }
  | {
      type: "FETCH_CSB_DATA_SUCCESS";
      payload: { csbData: CsbData };
    }
  | { type: "FETCH_CSB_DATA_FAILURE" }
  | { type: "FETCH_EPA_USER_DATA_REQUEST" }
  | {
      type: "FETCH_EPA_USER_DATA_SUCCESS";
      payload: { epaUserData: EpaUserData };
    }
  | { type: "FETCH_EPA_USER_DATA_FAILURE" }
  | { type: "FETCH_BAP_USER_DATA_REQUEST" }
  | {
      type: "FETCH_BAP_USER_DATA_SUCCESS";
      payload: {
        bapUserData:
          | {
              samResults: false;
              samEntities: [];
              rebateSubmissions: [];
            }
          | {
              samResults: true;
              samEntities: SamEntityData[];
              rebateSubmissions: BapSubmissionData[];
            };
      };
    }
  | { type: "FETCH_BAP_USER_DATA_FAILURE" };

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
        csbData: {
          status: "idle",
          data: {},
        },
        epaUserData: {
          status: "idle",
          data: {},
        },
        bapUserData: {
          status: "idle",
          data: {},
        },
      };
    }

    case "FETCH_CSB_DATA_REQUEST": {
      return {
        ...state,
        csbData: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_CSB_DATA_SUCCESS": {
      const { csbData } = action.payload;
      return {
        ...state,
        csbData: {
          status: "success",
          data: csbData,
        },
      };
    }

    case "FETCH_CSB_DATA_FAILURE": {
      return {
        ...state,
        csbData: {
          status: "failure",
          data: {},
        },
      };
    }

    case "FETCH_EPA_USER_DATA_REQUEST": {
      return {
        ...state,
        epaUserData: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_EPA_USER_DATA_SUCCESS": {
      const { epaUserData } = action.payload;
      return {
        ...state,
        epaUserData: {
          status: "success",
          data: epaUserData,
        },
      };
    }

    case "FETCH_EPA_USER_DATA_FAILURE": {
      return {
        ...state,
        epaUserData: {
          status: "failure",
          data: {},
        },
      };
    }

    case "FETCH_BAP_USER_DATA_REQUEST": {
      return {
        ...state,
        bapUserData: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_BAP_USER_DATA_SUCCESS": {
      const { bapUserData } = action.payload;
      return {
        ...state,
        bapUserData: {
          status: "success",
          data: bapUserData,
        },
      };
    }

    case "FETCH_BAP_USER_DATA_FAILURE": {
      return {
        ...state,
        bapUserData: {
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
    csbData: {
      status: "idle",
      data: {},
    },
    epaUserData: {
      status: "idle",
      data: {},
    },
    bapUserData: {
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
