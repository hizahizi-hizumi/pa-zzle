import * as React from "react"
import { cn } from "@/lib/utils"

// body: 本文の横に並べて読むキー。本文の横で読める大きさと濃さにし、太さは文字の段の補足の太さのままにする。
const kbdSizeClassNames = {
  default: "h-5 min-w-5 px-1 text-meta font-medium text-muted-foreground",
  body: "h-6 min-w-6 px-1.5 text-supporting text-foreground",
} as const

function Kbd({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"kbd"> & {
  size?: keyof typeof kbdSizeClassNames
}) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex w-fit items-center justify-center gap-1 rounded-sm bg-muted font-sans select-none",
        kbdSizeClassNames[size],
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
