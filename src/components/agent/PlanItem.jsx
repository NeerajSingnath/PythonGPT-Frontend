function PlanItem({ label, status = "pending" }) {
  const completed = status === "completed";

  const inProgress = status === "in_progress";

  const blocked = status === "blocked";

  return (
    <div className="flex items-start gap-2">
      <div
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          completed
            ? "border-emerald-500 bg-emerald-500/10"
            : inProgress
              ? "border-blue-500 bg-blue-500/10"
              : blocked
                ? "border-red-500 bg-red-500/10"
                : "border-zinc-700"
        }`}
      >
        {completed && <span className="text-[9px] text-emerald-400">✓</span>}

        {inProgress && (
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
        )}

        {blocked && <span className="text-[9px] text-red-400">!</span>}
      </div>

      <span
        className={`text-xs ${
          completed
            ? "text-zinc-400"
            : blocked
              ? "text-red-300"
              : "text-zinc-200"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default PlanItem;
