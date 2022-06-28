const {
  NODE_ENV,
  REACT_APP_SERVER_BASE_PATH,
  REACT_APP_CLOUD_SPACE,
  REACT_APP_FORMIO_BASE_URL,
  REACT_APP_FORMIO_PROJECT_URL,
} = process.env;

if (!REACT_APP_FORMIO_BASE_URL) {
  throw new Error(
    "Required REACT_APP_FORMIO_BASE_URL environment variable not found."
  );
}

if (!REACT_APP_FORMIO_PROJECT_URL) {
  throw new Error(
    "Required REACT_APP_FORMIO_PROJECT_URL environment variable not found."
  );
}

// allows the app to be accessed from a sub directory of a server (e.g. /csb)
export const serverBasePath =
  NODE_ENV === "development" ? "" : REACT_APP_SERVER_BASE_PATH || "";

// NOTE: This app is configured to use [Create React App's proxy setup]
// (https://create-react-app.dev/docs/proxying-api-requests-in-development/)
//
// For local development, the React app development server runs on port 3000,
// and the Express app server runs on port 3001, so we've added a proxy field to
// the client app's package.json file to proxy unknown requests from the React
// app to the Express app (for local dev only – only works with `npm start`).
//
// When deployed to Cloud.gov, the React app is built and served as static files
// from the Express app, so it's one app running from a single port so no proxy
// is needed for production.
export const serverUrl = window.location.origin + serverBasePath;

// NOTE: This local development setup unfortunately doesn't proxy GET requests
// from links though because they set an "Accept" request header to "text/html",
// so we need to use a different environment variable for when the serverUrl is
// used in the href of anchor tags (e.g. login and logout links).
export const serverUrlForLinks =
  NODE_ENV === "development" ? "http://localhost:3001" : serverUrl;

export const cloudSpace =
  NODE_ENV === "development" ? "dev" : REACT_APP_CLOUD_SPACE || "";

export const formioBaseUrl = REACT_APP_FORMIO_BASE_URL;

export const formioProjectUrl = REACT_APP_FORMIO_PROJECT_URL;

export const messages = {
  genericError: "Something went wrong.",
  authError: "Authentication error. Please log in again or contact support.",
  samlError: "Error logging in. Please try again or contact support.",
  samFetchError: "Error retrieving SAM.gov data. Please contact support.",
  samNoResults:
    "No SAM.gov records match your email. Only Government and Electronic Business SAM.gov Points of Contacts (and alternates) may edit and submit Clean School Bus Rebate Forms.",
  rebateSubmissionsError: "Error loading rebate form submissions.",
  newRebateApplication:
    "Please select the “New Application” button above to create your first rebate application.",
  helpdeskRebateFormError:
    "Error loading rebate form submission. Please confirm the form ID is correct and search again.",
  timeout:
    "For security reasons, you have been logged out due to 15 minutes of inactivity.",
  logout: "You have successfully logged out.",
};

/**
 * Returns a promise containing JSON fetched from a provided web service URL
 * or handles any other OK response returned from the server
 */
export async function fetchData(url: string, data?: object) {
  const options = !data
    ? {
        method: "GET",
        credentials: "include" as const,
      }
    : {
        method: "POST",
        credentials: "include" as const,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      };

  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(res.statusText);
    const contentType = res.headers.get("content-type");
    return contentType?.includes("application/json")
      ? await res.json()
      : Promise.resolve();
  } catch (error) {
    return await Promise.reject(error);
  }
}
