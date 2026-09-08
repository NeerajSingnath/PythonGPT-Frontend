import { Bot, ChevronDown, FolderOpen, Wifi } from "lucide-react";

function TopBar({ workspace = "demo_project", connected = true }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-950">
          <Bot size={18} />
        </div>

        <div>
          <div className="text-sm font-semibold tracking-tight">PythonGPT</div>

          <div className="text-[10px] text-zinc-500">
            Autonomous Python Engineer
          </div>
        </div>
      </div>

      <button className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
        <FolderOpen size={14} />
        {workspace}
        <ChevronDown size={13} />
      </button>

      <div
        className={`flex items-center gap-2 text-xs ${
          connected ? "text-emerald-400" : "text-red-400"
        }`}
      >
        <Wifi size={14} />
        {connected ? "Connected" : "Disconnected"}
      </div>
    </header>
  );
}

export default TopBar;
