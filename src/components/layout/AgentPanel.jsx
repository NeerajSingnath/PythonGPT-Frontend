import { Activity, Bot, FileDiff, ListChecks, Send } from "lucide-react";

import { useEffect, useState } from "react";

import AgentEvent from "../agent/AgentEvent";
import PlanItem from "../agent/PlanItem";
import StatusDot from "../common/StatusDot";

function DiffLine({ line }) {
  const type = line.type ?? "context";

  const className =
    type === "add"
      ? "bg-emerald-500/10 text-emerald-300"
      : type === "delete"
        ? "bg-red-500/10 text-red-300"
        : type === "header"
          ? "bg-zinc-800/70 text-zinc-500"
          : "text-zinc-400";

  const prefix =
    type === "add"
      ? "+"
      : type === "delete"
        ? "-"
        : type === "header"
          ? ""
          : " ";

  return (
    <div
      className={`flex min-w-max font-mono text-[11px] leading-5 ${className}`}
    >
      <span className="w-5 shrink-0 select-none text-center text-zinc-600">
        {prefix}
      </span>

      <span className="whitespace-pre pr-3">{line.content}</span>
    </div>
  );
}

function ChangeItem({ change }) {
  const status = change.status ?? "M";

  const statusClass =
    status === "A"
      ? "text-emerald-400"
      : status === "D"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <span className={`font-mono text-[11px] font-semibold ${statusClass}`}>
          {status}
        </span>

        <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
          {change.path}
        </span>

        {(change.additions > 0 || change.deletions > 0) && (
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px]">
            {change.additions > 0 && (
              <span className="text-emerald-400">+{change.additions}</span>
            )}

            {change.deletions > 0 && (
              <span className="text-red-400">-{change.deletions}</span>
            )}
          </div>
        )}
      </div>

      {change.lines?.length > 0 ? (
        <div className="max-h-80 overflow-auto py-1">
          {change.lines.map((line, index) => (
            <DiffLine key={`${change.path}-${index}`} line={line} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-3 text-[11px] text-zinc-600">
          No diff content.
        </div>
      )}
    </div>
  );
}

function AgentPanel({
  prompt,
  onPromptChange,
  onSendPrompt,
  plan = [],
  events = [],
  changes = [],
  status = "idle",
}) {
  const [activeTab, setActiveTab] = useState("plan");

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

  useEffect(() => {
    if (status === "running" && plan.length > 0) {
      setActiveTab("plan");
    }
  }, [status, plan.length]);

  const tabs = [
    {
      id: "plan",
      label: "Plan",
      icon: ListChecks,
      count: plan.length,
    },
    {
      id: "activity",
      label: "Activity",
      icon: Activity,
      count: events.length,
    },
    {
      id: "changes",
      label: "Changes",
      icon: FileDiff,
      count: changes.length,
    },
  ];

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
        <Bot size={15} className="text-zinc-400" />

        <span className="text-xs font-semibold">PythonGPT Agent</span>

        <div className="ml-auto">
          <StatusDot status={statusType} label={statusLabel} />
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center border-b border-zinc-800 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-1 text-[10px] transition ${
                active
                  ? "border-zinc-200 text-zinc-200"
                  : "border-transparent text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <Icon size={12} />

              <span>{tab.label}</span>

              {tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                    active
                      ? "bg-zinc-800 text-zinc-300"
                      : "bg-zinc-900 text-zinc-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {activeTab === "plan" && (
          <>
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
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
          </>
        )}

        {activeTab === "activity" && (
          <>
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Agent Activity
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
          </>
        )}

        {activeTab === "changes" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Workspace Changes
              </span>

              {changes.length > 0 && (
                <span className="font-mono text-[10px] text-zinc-600">
                  {changes.length} file
                  {changes.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {changes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-5 text-center text-xs text-zinc-600">
                No changes to display.
              </div>
            ) : (
              <div className="space-y-3">
                {changes.map((change, index) => (
                  <ChangeItem key={`${change.path}-${index}`} change={change} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-800 p-3">
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
              type="button"
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
