import { useEffect, useRef, useState } from "react";

import {
  createAgentRun,
  createAgentRunSocket,
  getAgentRun,
  getWorkspaceFile,
  getWorkspaceFiles,
  getWorkspaces,
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

function WorkspacePage() {
  const [workspace, setWorkspace] = useState("Loading...");

  const [connected, setConnected] = useState(false);

  const [files, setFiles] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);

  const [expandedFolders, setExpandedFolders] = useState({});

  const [code, setCode] = useState("");

  const [prompt, setPrompt] = useState("");

  const [bottomTab, setBottomTab] = useState("terminal");

  const [agentStatus, setAgentStatus] = useState("idle");

  const [runId, setRunId] = useState(null);

  const [plan, setPlan] = useState([]);

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

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

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

  const reloadSelectedFile = async (activeWorkspace, filePath) => {
    if (!filePath) {
      return;
    }

    const data = await getWorkspaceFile(activeWorkspace, filePath);

    setCode(normalizeFileContent(data));
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

    try {
      await refreshFiles(workspace);

      await reloadSelectedFile(workspace, selectedFileRef.current);
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

    setRunId((current) => (current === failedRunId ? null : current));
  };

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const workspaceData = await getWorkspaces();

        const workspaces = normalizeWorkspaces(workspaceData);

        setConnected(true);

        setAgentStatus("connected");

        if (workspaces.length === 0) {
          setWorkspace("No workspace");

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

        const activeWorkspace = workspaces[0];

        setWorkspace(activeWorkspace);

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

          await reloadSelectedFile(activeWorkspace, firstFile);
        }

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
      } catch (error) {
        setConnected(false);

        setWorkspace("Unavailable");

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

    loadWorkspace();
  }, []);

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
            try {
              await refreshFiles(workspace);

              await reloadSelectedFile(workspace, selectedFileRef.current);
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
  }, [runId, workspace]);

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
  }, [runId, workspace]);

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

    setSelectedFile(path);

    setCode("");

    try {
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
    if (!selectedFile || !workspaceReady(workspace)) {
      return;
    }

    try {
      await saveWorkspaceFile(workspace, selectedFile, code);

      setAgentEvents((current) => [
        ...current,
        {
          title: "File saved",
          description: selectedFile,
          type: "success",
        },
      ]);

      setTerminalLines((current) => [...current, `Saved ${selectedFile}`]);
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
  }, [workspace, selectedFile, code]);

  const sendPrompt = async () => {
    const task = prompt.trim();

    if (!task || agentStatus === "running" || !workspaceReady(workspace)) {
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

  const runCurrentFile = () => {
    if (!selectedFile) {
      return;
    }

    setTerminalLines((current) => [...current, `$ python ${selectedFile}`]);

    setBottomTab("terminal");
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <TopBar workspace={workspace} connected={connected} />

      <div className="flex min-h-0 flex-1">
        <Explorer
          files={files}
          selectedFile={selectedFile}
          expandedFolders={expandedFolders}
          onToggleFolder={toggleFolder}
          onOpenFile={openFile}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <EditorPanel
            selectedFile={selectedFile}
            code={code}
            onChange={setCode}
            onRun={runCurrentFile}
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
          status={agentStatus}
        />
      </div>
    </div>
  );
}

export default WorkspacePage;
