import { Bot, Send } from "lucide-react";

import AgentEvent from "../agent/AgentEvent";
import PlanItem from "../agent/PlanItem";
import StatusDot from "../common/StatusDot";

function AgentPanel({
  prompt,
  onPromptChange,
  onSendPrompt,
  plan = [],
  events = [],
  status = "idle",
}) {
  const statusLabel =
    status === "running"
      ? "Running"
      : status === "connected"
        ? "Ready"
        : status === "error"
          ? "Error"
          : "Idle";

  const statusType =
    status === "running"
      ? "running"
      : status === "connected"
        ? "connected"
        : status === "error"
          ? "error"
          : "idle";

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex h-10 items-center gap-2 border-b border-zinc-800 px-3">
        <Bot size={15} className="text-zinc-400" />

        <span className="text-xs font-semibold">PythonGPT Agent</span>

        <div className="ml-auto">
          <StatusDot status={statusType} label={statusLabel} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Current Plan
          </div>

          {plan.length === 0 ? (
            <div className="text-xs text-zinc-600">No active plan.</div>
          ) : (
            <div className="space-y-2">
              {plan.map((step) => (
                <PlanItem
                  key={step.id}
                  label={step.description}
                  status={step.status}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {events.length === 0 ? (
            <AgentEvent
              title="System ready"
              description="Waiting for your request."
            />
          ) : (
            events.map((event, index) => (
              <AgentEvent
                key={`${event.title}-${index}`}
                title={event.title}
                description={event.description}
                type={event.type}
              />
            ))
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 p-3">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 focus-within:border-zinc-600">
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSendPrompt();
              }
            }}
            placeholder="Ask PythonGPT to build, fix or explain..."
            rows={4}
            className="w-full resize-none bg-transparent p-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <span className="px-1 text-[10px] text-zinc-600">
              Shift + Enter for new line
            </span>

            <button
              onClick={onSendPrompt}
              disabled={!prompt.trim() || status === "running"}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default AgentPanel;
