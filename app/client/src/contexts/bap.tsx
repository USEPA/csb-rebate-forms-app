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

export type BapSamEntity = {
  ENTITY_COMBO_KEY__c: string;
  UNIQUE_ENTITY_ID__c: string;
  ENTITY_EFT_INDICATOR__c: string;
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

export type BapFormSubmission = {
  UEI_EFTI_Combo_Key__c: string; // UEI + EFTI combo key
  CSB_Form_ID__c: string; // MongoDB ObjectId string
  CSB_Modified_Full_String__c: string; // ISO 8601 date string
  CSB_Review_Item_ID__c: string; // CSB Rebate ID with form/version ID (9 digits)
  Parent_Rebate_ID__c: string; // CSB Rebate ID (6 digits)
  Record_Type_Name__c:
    | "CSB Funding Request"
    | "CSB Payment Request"
    | "CSB Closeout Request";
  Parent_CSB_Rebate__r: {
    CSB_Funding_Request_Status__c: string;
    CSB_Payment_Request_Status__c: string;
    CSB_Closeout_Request_Status__c: string;
    attributes: { type: string; url: string };
  };
  attributes: { type: string; url: string };
};

type BapFormSubmissions = {
  applications: BapFormSubmission[];
  paymentRequests: BapFormSubmission[];
  closeOuts: BapFormSubmission[];
};

type State = {
  samEntities:
    | { status: "idle"; data: {} }
    | { status: "pending"; data: {} }
    | {
        status: "success";
        data:
          | { results: false; entities: [] }
          | { results: true; entities: BapSamEntity[] };
      }
    | { status: "failure"; data: {} };
  formSubmissions:
    | { status: "idle"; data: [] }
    | { status: "pending"; data: [] }
    | { status: "success"; data: BapFormSubmissions }
    | { status: "failure"; data: [] };
};

type Action =
  | { type: "FETCH_BAP_SAM_DATA_REQUEST" }
  | {
      type: "FETCH_BAP_SAM_DATA_SUCCESS";
      payload: {
        samEntities:
          | { results: false; entities: [] }
          | { results: true; entities: BapSamEntity[] };
      };
    }
  | { type: "FETCH_BAP_SAM_DATA_FAILURE" }
  | { type: "FETCH_BAP_FORM_SUBMISSIONS_REQUEST" }
  | {
      type: "FETCH_BAP_FORM_SUBMISSIONS_SUCCESS";
      payload: { formSubmissions: BapFormSubmissions };
    }
  | { type: "FETCH_BAP_FORM_SUBMISSIONS_FAILURE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_BAP_SAM_DATA_REQUEST": {
      return {
        ...state,
        samEntities: {
          status: "pending",
          data: {},
        },
      };
    }

    case "FETCH_BAP_SAM_DATA_SUCCESS": {
      const { samEntities } = action.payload;
      return {
        ...state,
        samEntities: {
          status: "success",
          data: samEntities,
        },
      };
    }

    case "FETCH_BAP_SAM_DATA_FAILURE": {
      return {
        ...state,
        samEntities: {
          status: "failure",
          data: {},
        },
      };
    }

    case "FETCH_BAP_FORM_SUBMISSIONS_REQUEST": {
      return {
        ...state,
        formSubmissions: {
          status: "pending",
          data: [],
        },
      };
    }

    case "FETCH_BAP_FORM_SUBMISSIONS_SUCCESS": {
      const { formSubmissions } = action.payload;
      return {
        ...state,
        formSubmissions: {
          status: "success",
          data: formSubmissions,
        },
      };
    }

    case "FETCH_BAP_FORM_SUBMISSIONS_FAILURE": {
      return {
        ...state,
        formSubmissions: {
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

export function BapProvider({ children }: Props) {
  const initialState: State = {
    samEntities: { status: "idle", data: {} },
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
 * Returns state stored in `BapProvider` context component.
 */
export function useBapState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    const message = `useBapState must be called within a BapProvider`;
    throw new Error(message);
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `BapProvider` context component.
 */
export function useBapDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    const message = `useBapDispatch must be used within a BapProvider`;
    throw new Error(message);
  }
  return context;
}
