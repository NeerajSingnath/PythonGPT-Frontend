import { Terminal, TestTube2 } from "lucide-react";

function BottomPanel({
  activeTab,
  onTabChange,
  terminalLines = [],
  testLines = [],
}) {
  const lines = activeTab === "terminal" ? terminalLines : testLines;

  return (
    <div className="h-48 shrink-0 border-t border-zinc-800 bg-zinc-950">
      <div className="flex h-9 items-center border-b border-zinc-800 px-3">
        <button
          onClick={() => onTabChange("terminal")}
          className={`flex h-full items-center gap-2 border-b-2 px-2 text-xs ${
            activeTab === "terminal"
              ? "border-white text-white"
              : "border-transparent text-zinc-500"
          }`}
        >
          <Terminal size={13} />
          Terminal
        </button>

        <button
          onClick={() => onTabChange("tests")}
          className={`flex h-full items-center gap-2 border-b-2 px-2 text-xs ${
            activeTab === "tests"
              ? "border-white text-white"
              : "border-transparent text-zinc-500"
          }`}
        >
          <TestTube2 size={13} />
          Tests
        </button>
      </div>

      <div className="h-[calc(100%-2.25rem)] overflow-auto p-3 font-mono text-xs">
        {lines.length === 0 ? (
          <div className="text-zinc-600">
            {activeTab === "terminal"
              ? "Terminal ready."
              : "No test output yet."}
          </div>
        ) : (
          <div className="space-y-1">
            {lines.map((line, index) => (
              <div
                key={`${line}-${index}`}
                className="whitespace-pre-wrap text-zinc-400"
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomPanel;
