const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const data = await response.json();

      message = data.detail ?? data.message ?? message;
    } catch {
      //
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getWorkspaces() {
  return request("/workspaces");
}

export { API_BASE_URL, WS_BASE_URL };
