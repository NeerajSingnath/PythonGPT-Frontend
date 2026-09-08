function StatusDot({ status = "idle", label }) {
  const dotClass =
    status === "connected"
      ? "bg-emerald-400"
      : status === "running"
        ? "bg-blue-400"
        : status === "error"
          ? "bg-red-400"
          : status === "warning"
            ? "bg-amber-400"
            : "bg-zinc-600";

  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />

      {label && <span className="text-[10px] text-zinc-400">{label}</span>}
    </div>
  );
}

export default StatusDot;
