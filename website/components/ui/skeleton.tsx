import { cn } from "@/lib/utils"

// For genuine loading only. The blank-by-default data mode renders an em dash,
// not a skeleton (docs/superpowers/specs/2026-08-28-react-migration-design.md).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-fill", className)}
      {...props}
    />
  )
}

export { Skeleton }
