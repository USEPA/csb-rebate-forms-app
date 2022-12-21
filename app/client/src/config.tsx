const {
  NODE_ENV,
  REACT_APP_SERVER_BASE_PATH,
  REACT_APP_CLOUD_SPACE,
  REACT_APP_FORMIO_BASE_URL,
  REACT_APP_FORMIO_PROJECT_NAME,
} = process.env;

if (!REACT_APP_FORMIO_BASE_URL) {
  const message = `Required REACT_APP_FORMIO_BASE_URL environment variable not found.`;
  throw new Error(message);
}

if (!REACT_APP_FORMIO_PROJECT_NAME) {
  const message = `Required REACT_APP_FORMIO_PROJECT_NAME environment variable not found.`;
  throw new Error(message);
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

// NOTE: Create React App's local development proxy setup doesn't proxy requests
// that set an "Accept" request header to "text/html", so in those cases we need
// to explicitly use the server app's URL/port (localhost:3001)
export const serverUrlForHrefs =
  NODE_ENV === "development" ? "http://localhost:3001" : serverUrl;

export const cloudSpace =
  NODE_ENV === "development" ? "dev" : REACT_APP_CLOUD_SPACE || "";

export const formioBaseUrl = REACT_APP_FORMIO_BASE_URL;

const formioProjectName = REACT_APP_FORMIO_PROJECT_NAME;

export const formioProjectUrl = `${formioBaseUrl}/${formioProjectName}`;

export const messages = {
  genericError: "Something went wrong.",
  authError: "Authentication error. Please log in again or contact support.",
  samlError: "Error logging in. Please try again or contact support.",
  bapSamFetchError: "Error loading SAM.gov data. Please contact support.",
  bapNoSamResults:
    "No SAM.gov records match your email. Only Government and Electronic Business SAM.gov Points of Contacts (and alternates) may edit and submit Clean School Bus Rebate Forms.",
  formSubmissionsError: "Error loading form submissions.",
  newApplication:
    "Please select the “New Application” button above to create your first rebate application.",
  helpdeskSubmissionSearchError:
    "Error loading form submission. Please confirm the form type and ID is correct and search again.",
  timeout:
    "For security reasons, you have been logged out due to 15 minutes of inactivity.",
  logout: "You have successfully logged out.",
  applicationFormClosed:
    "The CSB Application form enrollment period is closed.",
  paymentRequestFormClosed:
    "The CSB Payment Request form enrollment period is closed.",
  closeOutFormClosed: "The CSB Close-Out form enrollment period is closed.",
};

async function fetchData(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(response.statusText);
    const contentType = response.headers.get("content-type");
    return contentType?.includes("application/json")
      ? await response.json()
      : Promise.resolve();
  } catch (error) {
    return await Promise.reject(error);
  }
}

/**
 * Fetches data and returns a promise containing JSON fetched from a provided
 * web service URL or handles any other OK response returned from the server
 */
export function getData(url: string) {
  return fetchData(url, {
    method: "GET",
    credentials: "include" as const,
  });
}

/**
 * Posts JSON data and returns a promise containing JSON fetched from a provided
 * web service URL or handles any other OK response returned from the server
 */
export function postData(url: string, data: object) {
  return fetchData(url, {
    method: "POST",
    credentials: "include" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
