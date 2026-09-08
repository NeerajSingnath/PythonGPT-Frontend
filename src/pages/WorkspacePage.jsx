import { useEffect, useState } from "react";

import { getWorkspaces } from "../api";
import AgentPanel from "../components/layout/AgentPanel";
import BottomPanel from "../components/layout/BottomPanel";
import EditorPanel from "../components/layout/EditorPanel";
import Explorer from "../components/layout/Explorer";
import TopBar from "../components/layout/TopBar";

const files = [
  {
    name: "app",
    type: "folder",
    children: [
      {
        name: "main.py",
        type: "file",
      },
      {
        name: "agent.py",
        type: "file",
      },
    ],
  },
  {
    name: "tests",
    type: "folder",
    children: [
      {
        name: "test_main.py",
        type: "file",
      },
    ],
  },
  {
    name: "requirements.txt",
    type: "file",
  },
];

const fileContents = {
  "app/main.py": `from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello PythonGPT"}
`,

  "app/agent.py": `class PythonGPTAgent:
    def __init__(self):
        self.name = "PythonGPT"

    def run(self, task: str):
        return {
            "task": task,
            "status": "running",
        }
`,

  "tests/test_main.py": `def test_example():
    assert True
`,

  "requirements.txt": `fastapi
uvicorn
pytest
ruff
`,
};

function normalizeWorkspaces(data) {
  const items = Array.isArray(data) ? data : (data?.workspaces ?? []);

  return items
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter(Boolean);
}

function WorkspacePage() {
  const [workspace, setWorkspace] = useState("Loading...");

  const [connected, setConnected] = useState(false);

  const [selectedFile, setSelectedFile] = useState("app/main.py");

  const [expandedFolders, setExpandedFolders] = useState({
    app: true,
    tests: true,
  });

  const [code, setCode] = useState(fileContents["app/main.py"]);

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
    async function loadWorkspaces() {
      try {
        const data = await getWorkspaces();

        const workspaces = normalizeWorkspaces(data);

        setConnected(true);
        setAgentStatus("connected");

        if (workspaces.length > 0) {
          const activeWorkspace = workspaces[0];

          setWorkspace(activeWorkspace);

          setAgentEvents([
            {
              title: "Backend connected",
              description: "PythonGPT API is available.",
              type: "success",
            },
            {
              title: "Workspace loaded",
              description: `${activeWorkspace} is ready.`,
              type: "success",
            },
          ]);

          setTerminalLines([
            `PythonGPT ~/${activeWorkspace} $`,
            "Terminal ready.",
          ]);

          return;
        }

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

    loadWorkspaces();
  }, []);

  const toggleFolder = (folderName) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderName]: !current[folderName],
    }));
  };

  const openFile = (path) => {
    setSelectedFile(path);

    setCode(fileContents[path] ?? "");
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
