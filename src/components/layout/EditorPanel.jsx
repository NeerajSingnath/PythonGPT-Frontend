import Editor from "@monaco-editor/react";
import { Circle, FileCode2, Play } from "lucide-react";

function EditorPanel({ selectedFile, code, onChange, onRun }) {
  const language = selectedFile?.endsWith(".py") ? "python" : "plaintext";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-zinc-800 bg-zinc-950">
        <div className="flex h-full items-center gap-2 border-r border-zinc-800 bg-zinc-900 px-4 text-xs text-zinc-300">
          <FileCode2 size={13} className="text-zinc-500" />

          <span className="max-w-80 truncate">
            {selectedFile || "No file selected"}
          </span>

          {selectedFile && (
            <Circle size={6} className="fill-zinc-500 text-zinc-500" />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 px-2">
          <button
            type="button"
            onClick={onRun}
            disabled={!selectedFile}
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Play size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {selectedFile ? (
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={(value) => onChange(value ?? "")}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: {
                enabled: true,
              },
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: {
                top: 14,
              },
              fontLigatures: true,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              renderLineHighlight: "all",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            Select a file from the Explorer
          </div>
        )}
      </div>
    </div>
  );
}

export default EditorPanel;
