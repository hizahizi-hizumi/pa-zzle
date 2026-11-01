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
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
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
        // card: 各タブを枠のあるカードにして並べる。並べ方は cardArrangement で選ぶ。
        card: "items-stretch justify-start gap-2 rounded-none bg-transparent group-data-[orientation=horizontal]/tabs:h-auto",
      },
      // card の並べ方。
      // scroll: 1行に並べる。lg より狭い幅では、ページの余白まで広げて横に送り、次のカードを3割ほどのぞかせ、カードの頭で止める。
      // list: lg より狭い幅では縦に並べ、lg では1行に並べる。
      // どちらもフォーカスの輪郭がスクロールの端で切れないよう、輪郭の分の余白を内側に取る。
      cardArrangement: {
        scroll: "@container -mx-4 -my-1 flex w-auto snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-1 lg:scroll-px-1 lg:px-1 [&::-webkit-scrollbar]:hidden",
        list: "-m-1 flex min-h-0 w-auto flex-col overflow-y-auto p-1 lg:flex-row lg:overflow-visible",
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
  cardArrangement,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-layout={layout}
      data-card-arrangement={cardArrangement ?? undefined}
      className={cn(
        tabsListVariants({ variant, layout, cardArrangement }),
        className
      )}
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
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        // card のカードは盤面の見本などの図を中に描くので、アイコンの大きさにそろえない。
        "group-data-[layout=default]/tabs-list:[&_svg:not([class*='size-'])]:size-4 group-data-[layout=stacked]/tabs-list:[&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        "group-data-[layout=stacked]/tabs-list:h-auto group-data-[layout=stacked]/tabs-list:min-w-0 group-data-[layout=stacked]/tabs-list:flex-col group-data-[layout=stacked]/tabs-list:gap-0 group-data-[layout=stacked]/tabs-list:px-1 group-data-[layout=stacked]/tabs-list:py-1",
        // card のカードは中身の幅で決まる大きさを持たず（@container/level-card）、中身が自分の幅に合わせて大きさを選べるようにする。
        // 選んだカードは枠と内側の輪郭で示し、フォーカスは選んだ輪郭と重ならないよう、外側に間を空けた輪郭で示す。
        // 並べ方を切り替えたときにカードの大きさを動かして見せないよう、色と輪郭だけを移り変わらせる。
        "group-data-[layout=card]/tabs-list:@container/level-card group-data-[layout=card]/tabs-list:transition-[color,background-color,border-color,box-shadow,outline-color] group-data-[layout=card]/tabs-list:h-auto group-data-[layout=card]/tabs-list:min-w-0 group-data-[layout=card]/tabs-list:flex-col group-data-[layout=card]/tabs-list:items-stretch group-data-[layout=card]/tabs-list:justify-start group-data-[layout=card]/tabs-list:gap-1 group-data-[layout=card]/tabs-list:rounded-xl group-data-[layout=card]/tabs-list:border-(length:--border-width-normal) group-data-[layout=card]/tabs-list:border-border group-data-[layout=card]/tabs-list:bg-background group-data-[layout=card]/tabs-list:p-1.5 group-data-[layout=card]/tabs-list:text-left group-data-[layout=card]/tabs-list:text-foreground group-data-[layout=card]/tabs-list:hover:bg-accent group-data-[layout=card]/tabs-list:focus-visible:border-border group-data-[layout=card]/tabs-list:focus-visible:ring-0 group-data-[layout=card]/tabs-list:focus-visible:outline-2 group-data-[layout=card]/tabs-list:focus-visible:outline-offset-2 group-data-[layout=card]/tabs-list:data-[state=active]:border-ring group-data-[layout=card]/tabs-list:data-[state=active]:bg-background group-data-[layout=card]/tabs-list:data-[state=active]:shadow-none group-data-[layout=card]/tabs-list:data-[state=active]:ring-1 group-data-[layout=card]/tabs-list:data-[state=active]:ring-ring sm:group-data-[layout=card]/tabs-list:p-2",
        // scroll: lg より狭い幅では、送る領域の幅から、2枚（sm で3枚、md で4枚）と次のカードの3割が見える幅にする。
        "group-data-[card-arrangement=scroll]/tabs-list:w-[calc(100cqw/2.3)] max-lg:group-data-[card-arrangement=scroll]/tabs-list:flex-none group-data-[card-arrangement=scroll]/tabs-list:snap-start sm:group-data-[card-arrangement=scroll]/tabs-list:w-[calc(100cqw/3.3)] md:group-data-[card-arrangement=scroll]/tabs-list:w-[calc((100cqw-var(--spacing)*2)/4.3)] lg:group-data-[card-arrangement=scroll]/tabs-list:w-auto",
        // list: lg より狭い幅では、横長のカードを縦に並べる。
        "group-data-[card-arrangement=list]/tabs-list:flex-none max-lg:group-data-[card-arrangement=list]/tabs-list:flex-row max-lg:group-data-[card-arrangement=list]/tabs-list:items-center max-lg:group-data-[card-arrangement=list]/tabs-list:gap-3 lg:group-data-[card-arrangement=list]/tabs-list:flex-1",
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
