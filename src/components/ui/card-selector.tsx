import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CardOption {
  value: string
  label: string
  icon: LucideIcon
}

interface CardSelectorProps {
  options: CardOption[]
  value: string
  onChange: (value: string) => void
  columns?: number
  className?: string
}

export function CardSelector({
  options,
  value,
  onChange,
  columns = 3,
  className,
}: CardSelectorProps) {
  const gridCols: Record<number, string> = {
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 gap-3",
        gridCols[columns],
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center text-sm font-medium transition-all outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/5 ring-2 ring-primary"
                : "border-border bg-transparent hover:bg-muted/50 hover:border-foreground/20",
            )}
            aria-pressed={isSelected}
          >
            <Icon className={cn("size-6", isSelected ? "text-primary" : "text-muted-foreground")} />
            <span className={isSelected ? "text-primary" : "text-foreground"}>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
