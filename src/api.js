const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const DEFAULT_WS_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? DEFAULT_WS_BASE_URL;

async function request(path, options = {}) {
  const { headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const data = await response.json();

      message = data.detail ?? data.message ?? message;
    } catch {}

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function encodeWorkspacePath(workspace, filePath) {
  const encodedWorkspace = encodeURIComponent(workspace);

  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return {
    encodedWorkspace,
    encodedPath,
  };
}

export function getWorkspaces() {
  return request("/workspaces");
}

export function createWorkspace(name) {
  return request("/workspaces", {
    method: "POST",
    body: JSON.stringify({
      name,
    }),
  });
}

export function deleteWorkspace(name) {
  return request(`/workspaces/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export function getWorkspaceFiles(workspace) {
  return request(`/workspaces/${encodeURIComponent(workspace)}/files`);
}

export function getWorkspaceFile(workspace, filePath) {
  const { encodedWorkspace, encodedPath } = encodeWorkspacePath(
    workspace,
    filePath,
  );

  return request(`/workspaces/${encodedWorkspace}/files/${encodedPath}`);
}

export function saveWorkspaceFile(workspace, filePath, content) {
  const { encodedWorkspace, encodedPath } = encodeWorkspacePath(
    workspace,
    filePath,
  );

  return request(`/workspaces/${encodedWorkspace}/files/${encodedPath}`, {
    method: "PUT",
    body: JSON.stringify({
      content,
    }),
  });
}

export function createWorkspaceFile(workspace, filePath, content = "") {
  return saveWorkspaceFile(workspace, filePath, content);
}

export function deleteWorkspaceFile(workspace, filePath) {
  const { encodedWorkspace, encodedPath } = encodeWorkspacePath(
    workspace,
    filePath,
  );

  return request(`/workspaces/${encodedWorkspace}/files/${encodedPath}`, {
    method: "DELETE",
  });
}

export function runWorkspacePython(workspace, filePath, timeout = 10) {
  return request(`/workspaces/${encodeURIComponent(workspace)}/run`, {
    method: "POST",
    body: JSON.stringify({
      file: filePath,
      timeout,
    }),
  });
}

export function getWorkspaceDiff(workspace) {
  return request(`/workspaces/${encodeURIComponent(workspace)}/diff`);
}

export function createAgentRun({
  workspace,
  task,
  mode = "general",
  planningRequired = true,
  requiredQualityChecks = ["ruff"],
}) {
  return request("/agent/runs", {
    method: "POST",
    body: JSON.stringify({
      workspace,
      task,
      mode,
      planning_required: planningRequired,
      required_quality_checks: requiredQualityChecks,
    }),
  });
}

export function cancelAgentRun(runId) {
  return request(`/agent/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
  });
}

export function getAgentRun(runId) {
  return request(`/agent/runs/${encodeURIComponent(runId)}`);
}

export function createAgentRunSocket(runId) {
  return new WebSocket(
    `${WS_BASE_URL}/agent/runs/${encodeURIComponent(runId)}/stream`,
  );
}

export { API_BASE_URL, WS_BASE_URL };
