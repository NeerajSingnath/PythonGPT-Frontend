import { useEffect, useState } from "react";

import { getWorkspaceFile, getWorkspaceFiles, getWorkspaces } from "../api";
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

  const [plan, setPlan] = useState([
    {
      id: 1,
      description: "Waiting for task",
      status: "pending",
    },
  ]);

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

  const [testLines] = useState([]);

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

        const fileData = await getWorkspaceFiles(activeWorkspace);

        const paths = normalizeFilePaths(fileData);

        const explorerFiles = buildExplorerFiles(paths);

        setFiles(explorerFiles);

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

          const firstFileData = await getWorkspaceFile(
            activeWorkspace,
            firstFile,
          );

          setCode(normalizeFileContent(firstFileData));
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

  const toggleFolder = (folderName) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderName]: !current[folderName],
    }));
  };

  const openFile = async (path) => {
    if (
      !workspace ||
      workspace === "Loading..." ||
      workspace === "Unavailable" ||
      workspace === "No workspace"
    ) {
      return;
    }

    setSelectedFile(path);
    setCode("");

    try {
      const data = await getWorkspaceFile(workspace, path);

      setCode(normalizeFileContent(data));
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

  const sendPrompt = () => {
    const task = prompt.trim();

    if (!task || agentStatus === "running") {
      return;
    }

    setAgentStatus("running");

    setAgentEvents((current) => [
      ...current,
      {
        title: "Task submitted",
        description: task,
        type: "info",
      },
    ]);

    setPlan([
      {
        id: 1,
        description: "Create engineering plan",
        status: "completed",
      },
      {
        id: 2,
        description: "Execute requested task",
        status: "in_progress",
      },
      {
        id: 3,
        description: "Verify changes",
        status: "pending",
      },
    ]);

    setTerminalLines((current) => [...current, `> ${task}`]);

    setPrompt("");
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
