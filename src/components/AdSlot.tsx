type Props = {
  label?: string;
  className?: string;
  height?: string;
};

export function AdSlot({ label = "Advertisement space", className = "", height = "h-24" }: Props) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground ${height} ${className}`}
      aria-label="Advertisement"
    >
      {label}
    </div>
  );
}
