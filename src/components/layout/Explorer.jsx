import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { useRef, useState } from "react";

function Explorer({
  files = [],
  selectedFile,
  expandedFolders = {},
  onToggleFolder,
  onOpenFile,
  onCreateFile,
  onDeleteFile,
}) {
  const [creatingFile, setCreatingFile] = useState(false);

  const [newFilePath, setNewFilePath] = useState("");

  const [createBusy, setCreateBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [deleteBusy, setDeleteBusy] = useState(false);

  const inputRef = useRef(null);

  const startCreateFile = () => {
    setDeleteTarget(null);

    setCreatingFile(true);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const cancelCreateFile = () => {
    if (createBusy) {
      return;
    }

    setCreatingFile(false);
    setNewFilePath("");
  };

  const createFile = async () => {
    const filePath = newFilePath.trim();

    if (!filePath || createBusy) {
      return;
    }

    try {
      setCreateBusy(true);

      await onCreateFile?.(filePath);

      setNewFilePath("");
      setCreatingFile(false);
    } finally {
      setCreateBusy(false);
    }
  };

  const handleCreateKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      createFile();

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      cancelCreateFile();
    }
  };

  const requestDelete = (event, path) => {
    event.stopPropagation();

    setCreatingFile(false);
    setNewFilePath("");

    setDeleteTarget(path);
  };

  const cancelDelete = () => {
    if (deleteBusy) {
      return;
    }

    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteBusy) {
      return;
    }

    try {
      setDeleteBusy(true);

      await onDeleteFile?.(deleteTarget);

      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const renderFile = (name, path, nested = false) => {
    const active = selectedFile === path;

    return (
      <div
        key={path}
        className={`group flex items-center ${
          active ? "bg-zinc-800" : "hover:bg-zinc-900"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenFile?.(path)}
          className={`flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs transition ${
            nested ? "pl-8" : "pl-6"
          } ${
            active ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
          }`}
        >
          <FileCode2 size={13} className="shrink-0 text-zinc-500" />

          <span className="truncate">{name}</span>
        </button>

        <button
          type="button"
          onClick={(event) => requestDelete(event, path)}
          title={`Delete ${path}`}
          className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-10 items-center justify-between border-b border-zinc-900 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Explorer
        </span>

        <button
          type="button"
          onClick={startCreateFile}
          title="New file"
          className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Plus size={14} />
        </button>
      </div>

      {creatingFile && (
        <div className="border-b border-zinc-900 p-2">
          <div className="flex items-center gap-1">
            <FileCode2 size={13} className="shrink-0 text-zinc-500" />

            <input
              ref={inputRef}
              type="text"
              value={newFilePath}
              onChange={(event) => setNewFilePath(event.target.value)}
              onKeyDown={handleCreateKeyDown}
              disabled={createBusy}
              placeholder="main.py"
              className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600 disabled:opacity-60"
            />

            <button
              type="button"
              onClick={cancelCreateFile}
              disabled={createBusy}
              title="Cancel"
              className="rounded p-1 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-50"
            >
              <X size={13} />
            </button>
          </div>

          <div className="mt-1 pl-5 text-[10px] text-zinc-600">
            Enter to create · Esc to cancel
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="border-b border-zinc-800 bg-zinc-950 p-2">
          <div className="text-xs font-medium text-zinc-300">Delete file?</div>

          <div className="mt-1 break-all text-[11px] text-zinc-500">
            {deleteTarget}
          </div>

          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={cancelDelete}
              disabled={deleteBusy}
              className="rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteBusy}
              className="rounded bg-red-500 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteBusy ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto py-2">
        {files.length === 0 && (
          <div className="px-3 py-2 text-xs text-zinc-600">No files</div>
        )}

        {files.map((item) => {
          if (item.type === "folder") {
            const expanded = expandedFolders[item.name];

            return (
              <div key={item.name}>
                <button
                  type="button"
                  onClick={() => onToggleFolder?.(item.name)}
                  className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs text-zinc-300 transition hover:bg-zinc-900"
                >
                  {expanded ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )}

                  {expanded ? (
                    <FolderOpen size={14} className="text-zinc-500" />
                  ) : (
                    <Folder size={14} className="text-zinc-500" />
                  )}

                  <span className="truncate">{item.name}</span>
                </button>

                {expanded &&
                  item.children?.map((child) => {
                    const path = `${item.name}/${child.name}`;

                    return renderFile(child.name, path, true);
                  })}
              </div>
            );
          }

          return renderFile(item.name, item.name);
        })}
      </div>
    </aside>
  );
}

export default Explorer;
