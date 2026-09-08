import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  Plus,
} from "lucide-react";

function Explorer({
  files = [],
  selectedFile,
  expandedFolders,
  onToggleFolder,
  onOpenFile,
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-10 items-center justify-between border-b border-zinc-900 px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Explorer
        </span>

        <button className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {files.map((item) => {
          if (item.type === "folder") {
            const expanded = expandedFolders[item.name];

            return (
              <div key={item.name}>
                <button
                  onClick={() => onToggleFolder(item.name)}
                  className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-900"
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

                  {item.name}
                </button>

                {expanded &&
                  item.children?.map((child) => {
                    const path = `${item.name}/${child.name}`;
                    const active = selectedFile === path;

                    return (
                      <button
                        key={path}
                        onClick={() => onOpenFile(path)}
                        className={`flex w-full items-center gap-2 py-1 pl-8 pr-2 text-left text-xs transition ${
                          active
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                        }`}
                      >
                        <FileCode2 size={13} className="text-zinc-500" />

                        {child.name}
                      </button>
                    );
                  })}
              </div>
            );
          }

          const active = selectedFile === item.name;

          return (
            <button
              key={item.name}
              onClick={() => onOpenFile(item.name)}
              className={`flex w-full items-center gap-2 py-1 pl-6 pr-2 text-left text-xs transition ${
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <FileCode2 size={13} className="text-zinc-500" />

              {item.name}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default Explorer;
