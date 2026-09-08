function AgentEvent({ title, description, type = "info" }) {
  const dotClass =
    type === "success"
      ? "bg-emerald-400"
      : type === "error"
        ? "bg-red-400"
        : type === "warning"
          ? "bg-amber-400"
          : "bg-zinc-600";

  return (
    <div className="flex gap-3">
      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />

      <div className="min-w-0">
        <div className="text-xs text-zinc-300">{title}</div>

        {description && (
          <div className="mt-0.5 break-words text-[11px] leading-relaxed text-zinc-600">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentEvent;
