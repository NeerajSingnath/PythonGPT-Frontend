import { Terminal, TestTube2 } from "lucide-react";

import { useEffect, useRef, useState } from "react";

const DEFAULT_HEIGHT = 192;
const MIN_HEIGHT = 90;
const EDITOR_MIN_HEIGHT = 100;

function BottomPanel({
  activeTab,
  onTabChange,
  terminalLines = [],
  testLines = [],
}) {
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);

  const [resizing, setResizing] = useState(false);

  const panelRef = useRef(null);

  const outputRef = useRef(null);

  const resizeStartRef = useRef({
    y: 0,
    height: DEFAULT_HEIGHT,
  });

  const lines = activeTab === "terminal" ? terminalLines : testLines;

  const getMaxHeight = () => {
    const parent = panelRef.current?.parentElement;

    if (!parent) {
      return window.innerHeight * 0.8;
    }

    return Math.max(MIN_HEIGHT, parent.clientHeight - EDITOR_MIN_HEIGHT);
  };

  const stopResize = () => {
    setResizing(false);

    document.body.style.userSelect = "";

    document.body.style.cursor = "";
  };

  const handleResizeStart = (event) => {
    event.preventDefault();

    resizeStartRef.current = {
      y: event.clientY,
      height: panelRef.current?.getBoundingClientRect().height ?? panelHeight,
    };

    setResizing(true);

    document.body.style.userSelect = "none";

    document.body.style.cursor = "row-resize";
  };

  useEffect(() => {
    if (!resizing) {
      return;
    }

    const handlePointerMove = (event) => {
      const delta = resizeStartRef.current.y - event.clientY;

      const nextHeight = resizeStartRef.current.height + delta;

      const maxHeight = getMaxHeight();

      setPanelHeight(Math.min(maxHeight, Math.max(MIN_HEIGHT, nextHeight)));
    };

    const handlePointerUp = () => {
      stopResize();
    };

    window.addEventListener("pointermove", handlePointerMove);

    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);

      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [resizing]);

  useEffect(() => {
    const handleWindowResize = () => {
      const maxHeight = getMaxHeight();

      setPanelHeight((current) => Math.min(current, maxHeight));
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  useEffect(() => {
    const output = outputRef.current;

    if (!output) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      output.scrollTop = output.scrollHeight;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [lines, activeTab]);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";

      document.body.style.cursor = "";
    };
  }, []);

  return (
    <div
      ref={panelRef}
      style={{
        height: panelHeight,
      }}
      className="relative flex shrink-0 flex-col border-t border-zinc-800 bg-zinc-950"
    >
      <div
        onPointerDown={handleResizeStart}
        onDoubleClick={() => setPanelHeight(DEFAULT_HEIGHT)}
        title="Drag to resize · Double-click to reset"
        className={`absolute -top-1 left-0 z-20 h-2 w-full cursor-row-resize ${
          resizing ? "bg-zinc-600/40" : "bg-transparent hover:bg-zinc-700/30"
        }`}
      >
        <div
          className={`absolute left-1/2 top-[3px] h-[2px] w-10 -translate-x-1/2 rounded-full transition ${
            resizing ? "bg-zinc-400" : "bg-zinc-700"
          }`}
        />
      </div>

      <div className="flex h-9 shrink-0 items-center border-b border-zinc-800 px-3">
        <button
          type="button"
          onClick={() => onTabChange("terminal")}
          className={`flex h-full items-center gap-2 border-b-2 px-2 text-xs ${
            activeTab === "terminal"
              ? "border-white text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Terminal size={13} />
          Terminal
        </button>

        <button
          type="button"
          onClick={() => onTabChange("tests")}
          className={`flex h-full items-center gap-2 border-b-2 px-2 text-xs ${
            activeTab === "tests"
              ? "border-white text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <TestTube2 size={13} />
          Tests
        </button>
      </div>

      <div
        ref={outputRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-auto p-3 font-mono text-xs"
      >
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
                key={`${index}-${line}`}
                className="whitespace-pre-wrap break-words text-zinc-400"
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
