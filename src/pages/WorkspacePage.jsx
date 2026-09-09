import { useEffect, useRef, useState } from "react";

import {
  createAgentRun,
  createAgentRunSocket,
  createWorkspaceFile,
  createWorkspace as createWorkspaceRequest,
  deleteWorkspaceFile,
  deleteWorkspace as deleteWorkspaceRequest,
  getAgentRun,
  getWorkspaceDiff,
  getWorkspaceFile,
  getWorkspaceFiles,
  getWorkspaces,
  runWorkspacePython,
  saveWorkspaceFile,
} from "../api";

import AgentPanel from "../components/layout/AgentPanel";
import BottomPanel from "../components/layout/BottomPanel";
import EditorPanel from "../components/layout/EditorPanel";
import Explorer from "../components/layout/Explorer";
import TopBar from "../components/layout/TopBar";

function normalizeWorkspaces(data) {
  const items = Array.isArray(data) ? data : (data?.workspaces ?? []);

  return items
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter(Boolean);
}

function normalizeFilePaths(data) {
  const items = Array.isArray(data) ? data : (data?.files ?? []);

  return items
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      return item?.path ?? item?.name;
    })
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"));
}

function normalizeFileContent(data) {
  if (typeof data === "string") {
    return data;
  }

  return data?.content ?? "";
}

function normalizeCreatedWorkspace(data, fallbackName) {
  if (typeof data === "string") {
    return data;
  }

  if (typeof data?.workspace === "string") {
    return data.workspace;
  }

  return data?.name ?? data?.workspace?.name ?? fallbackName;
}

function normalizeNewFilePath(path) {
  return path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

function buildExplorerFiles(paths) {
  const rootFiles = [];
  const folders = new Map();

  for (const path of paths) {
    const parts = path.split("/");

    if (parts.length === 1) {
      rootFiles.push({
        name: path,
        type: "file",
      });

      continue;
    }

    const folderName = parts[0];

    const childName = parts.slice(1).join("/");

    if (!folders.has(folderName)) {
      folders.set(folderName, {
        name: folderName,
        type: "folder",
        children: [],
      });
    }

    folders.get(folderName).children.push({
      name: childName,
      type: "file",
    });
  }

  return [...Array.from(folders.values()), ...rootFiles];
}

function getFirstFilePath(files) {
  for (const item of files) {
    if (item.type === "file") {
      return item.name;
    }

    if (item.type === "folder" && item.children?.length) {
      return `${item.name}/${item.children[0].name}`;
    }
  }

  return null;
}

function workspaceReady(workspace) {
  return (
    workspace &&
    workspace !== "Loading..." &&
    workspace !== "Unavailable" &&
    workspace !== "No workspace"
  );
}

function getAgentPayload(event) {
  return event?.data ?? event?.payload ?? event ?? {};
}

function getToolOutput(result) {
  const lines = [];

  if (result?.stdout) {
    lines.push(...result.stdout.split("\n").filter(Boolean));
  }

  if (result?.stderr) {
    lines.push(...result.stderr.split("\n").filter(Boolean));
  }

  return lines;
}

function getExecutionOutput(result) {
  const lines = [];

  if (result?.stdout) {
    lines.push(
      ...result.stdout
        .replaceAll("\r\n", "\n")
        .split("\n")
        .filter(
          (line, index, items) => line !== "" || index !== items.length - 1,
        ),
    );
  }

  if (result?.stderr) {
    lines.push(
      ...result.stderr
        .replaceAll("\r\n", "\n")
        .split("\n")
        .filter(
          (line, index, items) => line !== "" || index !== items.length - 1,
        ),
    );
  }

  return lines;
}

function getLatestTestOutput(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const event = history[index];

    if (event?.type !== "tool_result") {
      continue;
    }

    const data = event.data ?? {};

    if (data.tool !== "run_tests") {
      continue;
    }

    return getToolOutput(data.result ?? {});
  }

  return [];
}

function normalizeGitPath(path) {
  if (!path) {
    return "";
  }

  let value = path.trim();

  if (value.includes(" -> ")) {
    value = value.split(" -> ").at(-1);
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  if (value.startsWith("a/") || value.startsWith("b/")) {
    value = value.slice(2);
  }

  return value;
}

function getGitStatus(code) {
  if (code === "??") {
    return "A";
  }

  if (code.includes("D")) {
    return "D";
  }

  if (code.includes("A")) {
    return "A";
  }

  return "M";
}

function parseWorkspaceChanges(data) {
  const changes = new Map();

  const statusText = data?.status ?? "";

  const diffText = data?.diff ?? "";

  for (const line of statusText.replaceAll("\r\n", "\n").split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const code = line.slice(0, 2);

    const rawPath = line.length > 3 ? line.slice(3) : "";

    const path = normalizeGitPath(rawPath);

    if (!path) {
      continue;
    }

    changes.set(path, {
      path,
      status: getGitStatus(code),
      additions: 0,
      deletions: 0,
      lines: [],
      untracked: code === "??",
    });
  }

  let currentChange = null;

  const ensureChange = (path) => {
    if (!changes.has(path)) {
      changes.set(path, {
        path,
        status: "M",
        additions: 0,
        deletions: 0,
        lines: [],
        untracked: true,
      });
    }

    return changes.get(path);
  };

  for (const line of diffText.replaceAll("\r\n", "\n").split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);

      if (match) {
        const path = normalizeGitPath(match[2]);

        currentChange = ensureChange(path);
      } else {
        currentChange = null;
      }

      continue;
    }

    if (!currentChange) {
      continue;
    }

    if (line.startsWith("new file mode ")) {
      currentChange.status = "A";

      continue;
    }

    if (line.startsWith("deleted file mode ")) {
      currentChange.status = "D";

      continue;
    }

    if (
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      continue;
    }

    if (line.startsWith("@@")) {
      currentChange.lines.push({
        type: "header",
        content: line,
      });

      continue;
    }

    if (line.startsWith("+")) {
      currentChange.additions += 1;

      currentChange.lines.push({
        type: "add",
        content: line.slice(1),
      });

      continue;
    }

    if (line.startsWith("-")) {
      currentChange.deletions += 1;

      currentChange.lines.push({
        type: "delete",
        content: line.slice(1),
      });

      continue;
    }

    if (line.startsWith(" ")) {
      currentChange.lines.push({
        type: "context",
        content: line.slice(1),
      });

      continue;
    }

    if (line.startsWith("\\ No newline")) {
      currentChange.lines.push({
        type: "header",
        content: line,
      });
    }
  }

  return Array.from(changes.values()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState([]);

  const [workspace, setWorkspace] = useState("Loading...");

  const [connected, setConnected] = useState(false);

  const [files, setFiles] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);

  const [expandedFolders, setExpandedFolders] = useState({});

  const [code, setCode] = useState("");

  const [savedCode, setSavedCode] = useState("");

  const [prompt, setPrompt] = useState("");

  const [bottomTab, setBottomTab] = useState("terminal");

  const [agentStatus, setAgentStatus] = useState("idle");

  const [fileRunning, setFileRunning] = useState(false);

  const [runId, setRunId] = useState(null);

  const [plan, setPlan] = useState([]);

  const [changes, setChanges] = useState([]);

  const [agentEvents, setAgentEvents] = useState([
    {
      title: "Connecting",
      description: "Connecting to PythonGPT backend.",
      type: "info",
    },
  ]);

  const [terminalLines, setTerminalLines] = useState([
    "PythonGPT $",
    "Terminal ready.",
  ]);

  const [testLines, setTestLines] = useState([]);

  const handledRuns = useRef(new Set());

  const selectedFileRef = useRef(selectedFile);

  const workspaceRef = useRef(workspace);

  const isDirty = Boolean(selectedFile && code !== savedCode);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const refreshFiles = async (activeWorkspace) => {
    const fileData = await getWorkspaceFiles(activeWorkspace);

    const paths = normalizeFilePaths(fileData);

    const explorerFiles = buildExplorerFiles(paths);

    setFiles(explorerFiles);

    return {
      paths,
      explorerFiles,
    };
  };

  const refreshChanges = async (activeWorkspace) => {
    if (!workspaceReady(activeWorkspace)) {
      setChanges([]);
      return [];
    }

    try {
      const data = await getWorkspaceDiff(activeWorkspace);

      const parsed = parseWorkspaceChanges(data);

      const untracked = parsed.filter((change) => change.untracked);

      await Promise.all(
        untracked.map(async (change) => {
          try {
            const fileData = await getWorkspaceFile(
              activeWorkspace,
              change.path,
            );

            const content = normalizeFileContent(fileData).replaceAll(
              "\r\n",
              "\n",
            );

            if (content === "") {
              return;
            }

            const lines = content.split("\n");

            if (lines.at(-1) === "") {
              lines.pop();
            }

            change.additions = lines.length;

            change.lines = [
              {
                type: "header",
                content: `@@ -0,0 +1,${lines.length} @@`,
              },
              ...lines.map((line) => ({
                type: "add",
                content: line,
              })),
            ];
          } catch {
            // Binary or unreadable
            // untracked files remain
            // visible without content.
          }
        }),
      );

      if (workspaceRef.current === activeWorkspace) {
        setChanges(parsed);
      }

      return parsed;
    } catch {
      if (workspaceRef.current === activeWorkspace) {
        setChanges([]);
      }

      return [];
    }
  };

  const reloadSelectedFile = async (activeWorkspace, filePath) => {
    if (!filePath) {
      setCode("");
      setSavedCode("");
      return;
    }

    const data = await getWorkspaceFile(activeWorkspace, filePath);

    const content = normalizeFileContent(data);

    setCode(content);

    setSavedCode(content);
  };

  const saveActiveFile = async ({ report = false } = {}) => {
    if (!selectedFile || !workspaceReady(workspace)) {
      return false;
    }

    const activeWorkspace = workspace;

    const activeFile = selectedFile;

    const content = code;

    await saveWorkspaceFile(activeWorkspace, activeFile, content);

    if (
      workspaceRef.current === activeWorkspace &&
      selectedFileRef.current === activeFile
    ) {
      setSavedCode(content);
    }

    await refreshChanges(activeWorkspace);

    if (report) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "File saved",
          description: activeFile,
          type: "success",
        },
      ]);

      setTerminalLines((current) => [...current, `Saved ${activeFile}`]);
    }

    return true;
  };

  const loadWorkspace = async (activeWorkspace, { initial = false } = {}) => {
    setWorkspace(activeWorkspace);

    workspaceRef.current = activeWorkspace;

    setFiles([]);
    setChanges([]);

    setSelectedFile(null);

    selectedFileRef.current = null;

    setCode("");
    setSavedCode("");
    setPlan([]);
    setTestLines([]);

    const { paths, explorerFiles } = await refreshFiles(activeWorkspace);

    const expanded = {};

    explorerFiles.forEach((item) => {
      if (item.type === "folder") {
        expanded[item.name] = true;
      }
    });

    setExpandedFolders(expanded);

    const firstFile = getFirstFilePath(explorerFiles);

    if (firstFile) {
      setSelectedFile(firstFile);

      selectedFileRef.current = firstFile;

      await reloadSelectedFile(activeWorkspace, firstFile);
    }

    await refreshChanges(activeWorkspace);

    if (initial) {
      setAgentEvents([
        {
          title: "Backend connected",
          description: "PythonGPT API is available.",
          type: "success",
        },
        {
          title: "Workspace loaded",
          description: `${activeWorkspace} loaded with ${paths.length} files.`,
          type: "success",
        },
      ]);

      setTerminalLines([
        `PythonGPT ~/${activeWorkspace} $`,
        `${paths.length} workspace files loaded.`,
      ]);

      return;
    }

    setAgentEvents((current) => [
      ...current,
      {
        title: "Workspace switched",
        description: `${activeWorkspace} loaded with ${paths.length} files.`,
        type: "success",
      },
    ]);

    setTerminalLines([
      `PythonGPT ~/${activeWorkspace} $`,
      `${paths.length} workspace files loaded.`,
    ]);
  };

  useEffect(() => {
    async function initialize() {
      try {
        const workspaceData = await getWorkspaces();

        const names = normalizeWorkspaces(workspaceData);

        setWorkspaces(names);

        setConnected(true);

        setAgentStatus("connected");

        if (names.length === 0) {
          setWorkspace("No workspace");

          workspaceRef.current = "No workspace";

          setCode("");
          setSavedCode("");
          setChanges([]);

          setAgentEvents([
            {
              title: "Backend connected",
              description: "PythonGPT API is available.",
              type: "success",
            },
            {
              title: "No workspace found",
              description: "Create a workspace to begin.",
              type: "warning",
            },
          ]);

          return;
        }

        await loadWorkspace(names[0], {
          initial: true,
        });
      } catch (error) {
        setConnected(false);

        setWorkspace("Unavailable");

        workspaceRef.current = "Unavailable";

        setCode("");
        setSavedCode("");
        setChanges([]);

        setAgentStatus("error");

        setAgentEvents([
          {
            title: "Connection failed",
            description: error.message,
            type: "error",
          },
        ]);
      }
    }

    initialize();
  }, []);

  const selectWorkspace = async (name) => {
    if (name === workspace) {
      return;
    }

    if (agentStatus === "running" || fileRunning) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace switch blocked",
          description: "Wait for the active execution to finish.",
          type: "warning",
        },
      ]);

      return;
    }

    try {
      if (isDirty) {
        await saveActiveFile();
      }

      await loadWorkspace(name);
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace switch failed",
          description: error.message,
          type: "error",
        },
      ]);
    }
  };

  const createNewWorkspace = async (name) => {
    if (agentStatus === "running" || fileRunning) {
      const error = new Error("Wait for the active execution to finish.");

      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace creation blocked",
          description: error.message,
          type: "warning",
        },
      ]);

      throw error;
    }

    try {
      if (isDirty) {
        await saveActiveFile();
      }

      const created = await createWorkspaceRequest(name);

      const createdName = normalizeCreatedWorkspace(created, name);

      const workspaceData = await getWorkspaces();

      const names = normalizeWorkspaces(workspaceData);

      setWorkspaces(names);

      const targetWorkspace = names.includes(createdName)
        ? createdName
        : names.includes(name)
          ? name
          : createdName;

      await loadWorkspace(targetWorkspace);

      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace created",
          description: `${targetWorkspace} is ready.`,
          type: "success",
        },
      ]);
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace creation failed",
          description: error.message,
          type: "error",
        },
      ]);

      throw error;
    }
  };

  const deleteExistingWorkspace = async (name) => {
    if (agentStatus === "running" || fileRunning) {
      const error = new Error("Wait for the active execution to finish.");

      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace deletion blocked",
          description: error.message,
          type: "warning",
        },
      ]);

      throw error;
    }

    try {
      const deletingActiveWorkspace = name === workspaceRef.current;

      if (!deletingActiveWorkspace && isDirty) {
        await saveActiveFile();
      }

      await deleteWorkspaceRequest(name);

      const workspaceData = await getWorkspaces();

      const names = normalizeWorkspaces(workspaceData);

      setWorkspaces(names);

      if (names.length === 0) {
        setWorkspace("No workspace");

        workspaceRef.current = "No workspace";

        setFiles([]);
        setChanges([]);

        setSelectedFile(null);

        selectedFileRef.current = null;

        setCode("");
        setSavedCode("");

        setExpandedFolders({});

        setPlan([]);

        setTestLines([]);

        setTerminalLines(["PythonGPT $", "No workspace selected."]);
      } else if (deletingActiveWorkspace) {
        await loadWorkspace(names[0]);
      }

      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace deleted",
          description: `${name} was permanently deleted.`,
          type: "success",
        },
      ]);
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Workspace deletion failed",
          description: error.message,
          type: "error",
        },
      ]);

      throw error;
    }
  };

  const createNewFile = async (rawPath) => {
    if (!workspaceReady(workspace)) {
      const error = new Error("No workspace selected.");

      setAgentEvents((current) => [
        ...current,
        {
          title: "File creation failed",
          description: error.message,
          type: "error",
        },
      ]);

      throw error;
    }

    if (agentStatus === "running" || fileRunning) {
      const error = new Error("Wait for the active execution to finish.");

      setAgentEvents((current) => [
        ...current,
        {
          title: "File creation blocked",
          description: error.message,
          type: "warning",
        },
      ]);

      throw error;
    }

    const filePath = normalizeNewFilePath(rawPath);

    if (!filePath) {
      throw new Error("File path cannot be empty.");
    }

    try {
      const fileData = await getWorkspaceFiles(workspace);

      const existingPaths = normalizeFilePaths(fileData);

      if (existingPaths.includes(filePath)) {
        throw new Error(`File already exists: ${filePath}`);
      }

      if (isDirty) {
        await saveActiveFile();
      }

      await createWorkspaceFile(workspace, filePath, "");

      await refreshFiles(workspace);

      await refreshChanges(workspace);

      const topFolder = filePath.includes("/") ? filePath.split("/")[0] : null;

      if (topFolder) {
        setExpandedFolders((current) => ({
          ...current,
          [topFolder]: true,
        }));
      }

      setSelectedFile(filePath);

      selectedFileRef.current = filePath;

      setCode("");
      setSavedCode("");

      setAgentEvents((current) => [
        ...current,
        {
          title: "File created",
          description: filePath,
          type: "success",
        },
      ]);

      setTerminalLines((current) => [...current, `Created ${filePath}`]);
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "File creation failed",
          description: error.message,
          type: "error",
        },
      ]);

      throw error;
    }
  };

  const deleteExistingFile = async (filePath) => {
    if (!workspaceReady(workspace)) {
      const error = new Error("No workspace selected.");

      setAgentEvents((current) => [
        ...current,
        {
          title: "File deletion failed",
          description: error.message,
          type: "error",
        },
      ]);

      throw error;
    }

    if (agentStatus === "running" || fileRunning) {
      const error = new Error("Wait for the active execution to finish.");

      setAgentEvents((current) => [
        ...current,
        {
          title: "File deletion blocked",
          description: error.message,
          type: "warning",
        },
      ]);

      throw error;
    }

    try {
      const deletingSelected = selectedFileRef.current === filePath;

      if (!deletingSelected && isDirty) {
        await saveActiveFile();
      }

      await deleteWorkspaceFile(workspace, filePath);

      const { paths, explorerFiles } = await refreshFiles(workspace);

      await refreshChanges(workspace);

      if (deletingSelected) {
        const nextFile = getFirstFilePath(explorerFiles);

        if (nextFile) {
          setSelectedFile(nextFile);

          selectedFileRef.current = nextFile;

          await reloadSelectedFile(workspace, nextFile);
        } else {
          setSelectedFile(null);

          selectedFileRef.current = null;

          setCode("");
          setSavedCode("");
        }
      }

      setAgentEvents((current) => [
        ...current,
        {
          title: "File deleted",
          description: filePath,
          type: "success",
        },
      ]);

      setTerminalLines((current) => [
        ...current,
        `Deleted ${filePath}`,
        `${paths.length} workspace files remaining.`,
      ]);
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "File deletion failed",
          description: error.message,
          type: "error",
        },
      ]);

      throw error;
    }
  };

  const synchronizeCompletedRun = async (run) => {
    const completedRunId = run?.id ?? runId;

    if (completedRunId && handledRuns.current.has(completedRunId)) {
      return;
    }

    if (completedRunId) {
      handledRuns.current.add(completedRunId);
    }

    if (Array.isArray(run?.plan) && run.plan.length > 0) {
      setPlan(run.plan);
    }

    const finalTestOutput = getLatestTestOutput(run?.history);

    if (finalTestOutput.length > 0) {
      setTestLines(finalTestOutput);
    }

    setAgentStatus("connected");

    setAgentEvents((current) => [
      ...current,
      {
        title: "Run completed",
        description: run?.tests_verified
          ? "Task completed and tests verified."
          : "PythonGPT finished the task.",
        type: "success",
      },
    ]);

    setTerminalLines((current) => [...current, "PythonGPT run completed."]);

    const activeWorkspace = workspaceRef.current;

    try {
      await refreshFiles(activeWorkspace);

      await reloadSelectedFile(activeWorkspace, selectedFileRef.current);

      await refreshChanges(activeWorkspace);
    } catch {}

    setRunId((current) => (current === completedRunId ? null : current));
  };

  const synchronizeFailedRun = (run) => {
    const failedRunId = run?.id ?? runId;

    if (failedRunId && handledRuns.current.has(failedRunId)) {
      return;
    }

    if (failedRunId) {
      handledRuns.current.add(failedRunId);
    }

    if (Array.isArray(run?.plan) && run.plan.length > 0) {
      setPlan(run.plan);
    }

    setAgentStatus("error");

    setAgentEvents((current) => [
      ...current,
      {
        title: "Run failed",
        description: run?.error ?? "PythonGPT agent failed.",
        type: "error",
      },
    ]);

    setTerminalLines((current) => [
      ...current,
      `Run failed: ${run?.error ?? "Unknown error"}`,
    ]);

    refreshChanges(workspaceRef.current);

    setRunId((current) => (current === failedRunId ? null : current));
  };

  useEffect(() => {
    if (!runId) {
      return;
    }

    const socket = createAgentRunSocket(runId);

    socket.onopen = () => {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Live connection established",
          description: "Receiving PythonGPT activity.",
          type: "success",
        },
      ]);
    };

    socket.onmessage = async (socketEvent) => {
      let message;

      try {
        message = JSON.parse(socketEvent.data);
      } catch {
        return;
      }

      if (message.type === "run_snapshot") {
        const snapshot = message.run ?? message.snapshot ?? message.data ?? {};

        if (Array.isArray(snapshot.plan) && snapshot.plan.length > 0) {
          setPlan(snapshot.plan);
        }

        if (snapshot.status === "completed") {
          await synchronizeCompletedRun(snapshot);
        }

        if (snapshot.status === "failed") {
          synchronizeFailedRun(snapshot);
        }

        return;
      }

      if (message.type === "agent_event") {
        const agentEvent = message.event ?? {};

        const eventType = agentEvent.type;

        const payload = getAgentPayload(agentEvent);

        if (eventType === "plan_created") {
          const steps = payload.steps ?? [];

          if (steps.length > 0) {
            setPlan(steps);
          }

          setAgentEvents((current) => [
            ...current,
            {
              title: "Plan created",
              description: `${steps.length} engineering steps planned.`,
              type: "info",
            },
          ]);

          return;
        }

        if (eventType === "plan_updated") {
          const step = payload.step;

          if (step) {
            setPlan((current) => {
              const exists = current.some((item) => item.id === step.id);

              if (!exists) {
                return [...current, step];
              }

              return current.map((item) =>
                item.id === step.id
                  ? {
                      ...item,
                      ...step,
                    }
                  : item,
              );
            });

            if (step.status === "completed") {
              setAgentEvents((current) => [
                ...current,
                {
                  title: "Plan step completed",
                  description: step.description,
                  type: "success",
                },
              ]);
            }
          }

          return;
        }

        if (eventType === "tool_result") {
          const tool = payload.tool ?? "tool";

          const result = payload.result ?? {};

          const success = result.success !== false;

          setAgentEvents((current) => [
            ...current,
            {
              title: success ? `${tool} completed` : `${tool} failed`,
              description: result.path ?? result.command?.join?.(" ") ?? "",
              type: success ? "success" : "error",
            },
          ]);

          const output = getToolOutput(result);

          if (tool === "run_tests") {
            setTestLines(
              output.length
                ? output
                : [success ? "Tests passed." : "Tests failed."],
            );
          }

          if (output.length > 0) {
            setTerminalLines((current) => [...current, ...output]);
          }

          if (
            tool === "write_file" ||
            tool === "edit_file" ||
            tool === "delete_file"
          ) {
            const activeWorkspace = workspaceRef.current;

            try {
              await refreshFiles(activeWorkspace);

              await reloadSelectedFile(
                activeWorkspace,
                selectedFileRef.current,
              );

              await refreshChanges(activeWorkspace);
            } catch {}
          }

          return;
        }

        if (eventType === "action_rejected") {
          setAgentEvents((current) => [
            ...current,
            {
              title: "Action rejected",
              description: payload.reason ?? "Agent action was rejected.",
              type: "warning",
            },
          ]);

          return;
        }

        if (eventType === "plan_update_rejected") {
          setAgentEvents((current) => [
            ...current,
            {
              title: "Plan evidence rejected",
              description:
                payload.reason ?? "Plan step could not be completed yet.",
              type: "warning",
            },
          ]);

          return;
        }

        if (eventType === "finish_rejected") {
          setAgentEvents((current) => [
            ...current,
            {
              title: "Verification required",
              description:
                payload.reason ??
                "PythonGPT must complete verification before finishing.",
              type: "warning",
            },
          ]);

          return;
        }

        if (eventType === "finished") {
          setAgentEvents((current) => [
            ...current,
            {
              title: "Agent finishing",
              description: payload.summary ?? "All agent steps completed.",
              type: "success",
            },
          ]);
        }

        return;
      }

      if (message.type === "run_completed") {
        try {
          const run = await getAgentRun(runId);

          await synchronizeCompletedRun(run);
        } catch {
          await synchronizeCompletedRun({
            id: runId,
            status: "completed",
            tests_verified: message.tests_verified,
          });
        }

        return;
      }

      if (message.type === "run_failed") {
        try {
          const run = await getAgentRun(runId);

          synchronizeFailedRun(run);
        } catch {
          synchronizeFailedRun({
            id: runId,
            status: "failed",
            error: message.error,
          });
        }
      }
    };

    socket.onerror = () => {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Live connection interrupted",
          description: "Waiting for backend synchronization.",
          type: "warning",
        },
      ]);
    };

    return () => {
      socket.close();
    };
  }, [runId]);

  useEffect(() => {
    if (!runId) {
      return;
    }

    let cancelled = false;

    const synchronizeRun = async () => {
      try {
        const run = await getAgentRun(runId);

        if (cancelled) {
          return;
        }

        if (Array.isArray(run.plan) && run.plan.length > 0) {
          setPlan(run.plan);
        }

        if (run.status === "completed") {
          await synchronizeCompletedRun(run);

          return;
        }

        if (run.status === "failed") {
          synchronizeFailedRun(run);
        }
      } catch {}
    };

    synchronizeRun();

    const interval = window.setInterval(synchronizeRun, 2000);

    return () => {
      cancelled = true;

      window.clearInterval(interval);
    };
  }, [runId]);

  const toggleFolder = (folderName) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderName]: !current[folderName],
    }));
  };

  const openFile = async (path) => {
    if (!workspaceReady(workspace)) {
      return;
    }

    if (path === selectedFile) {
      return;
    }

    if (agentStatus === "running" || fileRunning) {
      return;
    }

    try {
      if (isDirty) {
        await saveActiveFile();
      }

      setSelectedFile(path);

      selectedFileRef.current = path;

      setCode("");
      setSavedCode("");

      await reloadSelectedFile(workspace, path);
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Failed to open file",
          description: error.message,
          type: "error",
        },
      ]);
    }
  };

  const saveCurrentFile = async () => {
    if (!selectedFile || !workspaceReady(workspace) || !isDirty) {
      return;
    }

    try {
      await saveActiveFile({
        report: true,
      });
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Save failed",
          description: error.message,
          type: "error",
        },
      ]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const saveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!saveShortcut) {
        return;
      }

      event.preventDefault();

      saveCurrentFile();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [workspace, selectedFile, code, savedCode]);

  const sendPrompt = async () => {
    const task = prompt.trim();

    if (
      !task ||
      agentStatus === "running" ||
      fileRunning ||
      !workspaceReady(workspace)
    ) {
      return;
    }

    try {
      if (isDirty) {
        await saveActiveFile();
      }

      await refreshChanges(workspace);
    } catch (error) {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Agent start blocked",
          description: `Unable to save ${selectedFile}: ${error.message}`,
          type: "error",
        },
      ]);

      return;
    }

    setAgentStatus("running");

    setPlan([]);
    setTestLines([]);

    setAgentEvents((current) => [
      ...current,
      {
        title: "Task submitted",
        description: task,
        type: "info",
      },
    ]);

    setTerminalLines((current) => [
      ...current,
      `> ${task}`,
      "Starting PythonGPT agent...",
    ]);

    setPrompt("");

    try {
      const run = await createAgentRun({
        workspace,
        task,
        mode: "general",
        planningRequired: true,
        requiredQualityChecks: ["ruff"],
      });

      const newRunId = run.id ?? run.run_id;

      if (!newRunId) {
        throw new Error("Backend did not return a run ID.");
      }

      handledRuns.current.delete(newRunId);

      setRunId(newRunId);

      setAgentEvents((current) => [
        ...current,
        {
          title: "Agent started",
          description: `Run ${newRunId}`,
          type: "success",
        },
      ]);

      setTerminalLines((current) => [...current, `Run ID: ${newRunId}`]);
    } catch (error) {
      setAgentStatus("error");

      setAgentEvents((current) => [
        ...current,
        {
          title: "Failed to start agent",
          description: error.message,
          type: "error",
        },
      ]);

      setTerminalLines((current) => [...current, `Error: ${error.message}`]);
    }
  };

  const runCurrentFile = async () => {
    if (!selectedFile || !workspaceReady(workspace) || fileRunning) {
      return;
    }

    setBottomTab("terminal");

    if (!selectedFile.toLowerCase().endsWith(".py")) {
      setTerminalLines((current) => [
        ...current,
        `PythonGPT ~/${workspace} $ python ${selectedFile}`,
        "Error: Only Python files can be executed.",
      ]);

      setAgentEvents((current) => [
        ...current,
        {
          title: "Execution rejected",
          description: "Only Python files can be executed.",
          type: "warning",
        },
      ]);

      return;
    }

    if (agentStatus === "running") {
      setAgentEvents((current) => [
        ...current,
        {
          title: "Execution blocked",
          description: "Wait for the active agent run to finish.",
          type: "warning",
        },
      ]);

      return;
    }

    setFileRunning(true);

    setTerminalLines((current) => [
      ...current,
      "",
      `PythonGPT ~/${workspace} $ python ${selectedFile}`,
    ]);

    try {
      await saveActiveFile();

      const result = await runWorkspacePython(workspace, selectedFile, 10);

      const output = getExecutionOutput(result);

      const exitLine = `Process exited with code ${result.return_code}.`;

      setTerminalLines((current) => [
        ...current,
        ...(output.length ? output : ["(no output)"]),
        exitLine,
      ]);

      setAgentEvents((current) => [
        ...current,
        {
          title: result.success ? "Execution completed" : "Execution failed",
          description: `${selectedFile} exited with code ${result.return_code}.`,
          type: result.success ? "success" : "error",
        },
      ]);
    } catch (error) {
      setTerminalLines((current) => [...current, `Error: ${error.message}`]);

      setAgentEvents((current) => [
        ...current,
        {
          title: "Execution failed",
          description: error.message,
          type: "error",
        },
      ]);
    } finally {
      setFileRunning(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <TopBar
        workspace={workspace}
        workspaces={workspaces}
        connected={connected}
        onSelectWorkspace={selectWorkspace}
        onCreateWorkspace={createNewWorkspace}
        onDeleteWorkspace={deleteExistingWorkspace}
      />

      <div className="flex min-h-0 flex-1">
        <Explorer
          files={files}
          selectedFile={selectedFile}
          expandedFolders={expandedFolders}
          onToggleFolder={toggleFolder}
          onOpenFile={openFile}
          onCreateFile={createNewFile}
          onDeleteFile={deleteExistingFile}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <EditorPanel
            selectedFile={selectedFile}
            code={code}
            onChange={setCode}
            onRun={runCurrentFile}
            isDirty={isDirty}
          />

          <BottomPanel
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            terminalLines={terminalLines}
            testLines={testLines}
          />
        </div>

        <AgentPanel
          prompt={prompt}
          onPromptChange={setPrompt}
          onSendPrompt={sendPrompt}
          plan={plan}
          events={agentEvents}
          changes={changes}
          status={agentStatus}
        />
      </div>
    </div>
  );
}

export default WorkspacePage;
