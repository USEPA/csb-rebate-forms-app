const { NODE_ENV, REACT_APP_SERVER_BASE_PATH } = process.env;

export const serverBasePath =
  NODE_ENV === "development" ? "" : REACT_APP_SERVER_BASE_PATH || "";

export const serverUrl =
  NODE_ENV === "development"
    ? "http://localhost:3001"
    : window.location.origin + serverBasePath;

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
