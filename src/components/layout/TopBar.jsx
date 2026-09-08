import { ChevronDown, Folder, Plus, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function TopBar({
  workspace,
  workspaces = [],
  connected = false,
  onSelectWorkspace,
  onCreateWorkspace,
}) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectWorkspace = (name) => {
    setWorkspaceMenuOpen(false);

    if (name === workspace) {
      return;
    }

    onSelectWorkspace?.(name);
  };

  const createWorkspace = async () => {
    const name = newWorkspaceName.trim();

    if (!name || creatingWorkspace) {
      return;
    }

    try {
      setCreatingWorkspace(true);

      await onCreateWorkspace?.(name);

      setNewWorkspaceName("");

      setWorkspaceMenuOpen(false);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleWorkspaceKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      createWorkspace();
    }
  };

  return (
    <header className="flex h-[54px] shrink-0 items-center border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex min-w-[260px] items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950">
          <span className="text-lg">
            <img src="../../assets/pythongpt.png" alt="" />
          </span>
        </div>

        <div>
          <div className="text-sm font-semibold text-zinc-100">PythonGPT</div>

          <div className="text-[11px] text-zinc-500">
            Autonomous Python Engineer
          </div>
        </div>
      </div>

      <div className="flex flex-1 justify-center">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen((current) => !current)}
            className="flex min-w-[230px] items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Folder size={16} className="shrink-0 text-zinc-400" />

              <span className="truncate">{workspace}</span>
            </div>

            <ChevronDown
              size={15}
              className={`shrink-0 text-zinc-500 transition-transform ${
                workspaceMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {workspaceMenuOpen && (
            <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[280px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
              {workspaces.length > 0 && (
                <div className="max-h-56 overflow-y-auto py-1">
                  {workspaces.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectWorkspace(name)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                        name === workspace
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-300 hover:bg-zinc-900"
                      }`}
                    >
                      <Folder size={15} className="shrink-0 text-zinc-500" />

                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-zinc-800 p-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <Plus size={14} />
                  New Workspace
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(event) =>
                      setNewWorkspaceName(event.target.value)
                    }
                    onKeyDown={handleWorkspaceKeyDown}
                    placeholder="my_project"
                    disabled={creatingWorkspace}
                    className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={createWorkspace}
                    disabled={!newWorkspaceName.trim() || creatingWorkspace}
                    className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingWorkspace ? "..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-[260px] justify-end">
        <div
          className={`flex items-center gap-2 text-xs ${
            connected ? "text-emerald-400" : "text-red-400"
          }`}
        >
          <Wifi size={15} />

          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
