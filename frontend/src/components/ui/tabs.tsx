import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-md p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
      // stacked: タブを横幅いっぱいに等分し、各タブの中身（名前と補足の値など）を縦に積む。
      layout: {
        default: "",
        stacked: "w-full group-data-[orientation=horizontal]/tabs:h-auto",
        // card: 各タブをカードにして、幅を等分して1行に並べる。
        card: "grid w-full auto-cols-fr grid-flow-col items-stretch gap-1.5 rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
      layout: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  layout = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-layout={layout}
      className={cn(tabsListVariants({ variant, layout }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-sm border border-transparent px-2 py-1 text-supporting font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-raised group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "[&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        "group-data-[layout=stacked]/tabs-list:h-auto group-data-[layout=stacked]/tabs-list:min-w-0 group-data-[layout=stacked]/tabs-list:flex-col group-data-[layout=stacked]/tabs-list:gap-0 group-data-[layout=stacked]/tabs-list:px-1 group-data-[layout=stacked]/tabs-list:py-1",
        // 選んだレベルだけが目に付くよう、選んでいないカードには面を持たせない。選び替えで中の文字が動かないよう、選んだことは枠の太さを変えない輪郭で示す。
        "group-data-[layout=card]/tabs-list:h-auto group-data-[layout=card]/tabs-list:min-w-0 group-data-[layout=card]/tabs-list:flex-col group-data-[layout=card]/tabs-list:gap-0 group-data-[layout=card]/tabs-list:rounded-md group-data-[layout=card]/tabs-list:bg-transparent group-data-[layout=card]/tabs-list:px-1 group-data-[layout=card]/tabs-list:py-1.5 group-data-[layout=card]/tabs-list:text-meta group-data-[layout=card]/tabs-list:text-foreground/70 group-data-[layout=card]/tabs-list:transition-none group-data-[layout=card]/tabs-list:hover:bg-card/50 group-data-[layout=card]/tabs-list:hover:text-foreground group-data-[layout=card]/tabs-list:data-[state=active]:bg-card group-data-[layout=card]/tabs-list:data-[state=active]:text-foreground group-data-[layout=card]/tabs-list:data-[state=active]:shadow-none group-data-[layout=card]/tabs-list:data-[state=active]:ring-2 group-data-[layout=card]/tabs-list:data-[state=active]:ring-ring",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
