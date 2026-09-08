import { useState } from "react";

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

function WorkspacePage() {
  const [workspace] = useState("demo_project");

  const [connected] = useState(true);

  const [selectedFile, setSelectedFile] = useState("app/main.py");

  const [expandedFolders, setExpandedFolders] = useState({
    app: true,
    tests: true,
  });

  const [code, setCode] = useState(fileContents["app/main.py"]);

  const [prompt, setPrompt] = useState("");

  const [bottomTab, setBottomTab] = useState("terminal");

  const [agentStatus, setAgentStatus] = useState("connected");

  const [plan, setPlan] = useState([
    {
      id: 1,
      description: "Inspect repository",
      status: "completed",
    },
    {
      id: 2,
      description: "Waiting for task",
      status: "pending",
    },
  ]);

  const [agentEvents, setAgentEvents] = useState([
    {
      title: "System ready",
      description: "Connected to PythonGPT backend.",
      type: "success",
    },
    {
      title: "Workspace loaded",
      description: "demo_project is ready.",
      type: "info",
    },
  ]);

  const [terminalLines, setTerminalLines] = useState([
    "pythonGPT ~/demo_project $",
    "Terminal ready.",
  ]);

  const [testLines] = useState(["✓ 25 tests passed"]);

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
