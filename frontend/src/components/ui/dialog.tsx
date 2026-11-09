import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/25 duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

// fullscreen: 画面全体を覆う層。下の画面と二重に見せないよう、層の地は開いてから除かれるまで不透明にし、中身だけを現し、消す。
// 閉じるときは、中身が消えるのと同じ長さの見えない退出を層に掛け、それを終えてから層を除く。
// 動きを減らす設定でも見えない退出は残し、中身ごと一度に除く。
const dialogContentVariantClassNames = {
  default:
    "top-[50%] left-[50%] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg p-6 shadow-raised duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:max-w-lg",
  fullscreen:
    "group/dialog-fullscreen top-0 left-0 flex h-svh w-full flex-col pb-[env(safe-area-inset-bottom)] duration-(--duration-normal) ease-exit data-[state=closed]:animate-out data-[state=closed]:fade-out-100",
} as const

const dialogFullscreenBodyClassName =
  "flex min-h-0 flex-1 flex-col animate-in fade-in-0 duration-(--duration-normal) ease-enter motion-safe:group-data-[state=closed]/dialog-fullscreen:animate-out group-data-[state=closed]/dialog-fullscreen:fade-out-0 group-data-[state=closed]/dialog-fullscreen:ease-exit group-data-[state=closed]/dialog-fullscreen:fill-mode-forwards motion-reduce:animate-none"

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  variant?: keyof typeof dialogContentVariantClassNames
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-variant={variant}
        className={cn(
          "fixed z-50 bg-background outline-none",
          dialogContentVariantClassNames[variant],
          className
        )}
        {...props}
      >
        {variant === "fullscreen" ? (
          <div className={dialogFullscreenBodyClassName}>{children}</div>
        ) : (
          children
        )}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-md opacity-70 transition-opacity hover:opacity-100 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

// banner: 全画面の層の帯に、見出しの大きさでゲームの名前を1行に収めて置く。
const dialogTitleSizeClassNames = {
  heading: "text-heading",
  banner: "min-w-0 truncate text-heading",
} as const

function DialogTitle({
  className,
  size = "heading",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & {
  size?: keyof typeof dialogTitleSizeClassNames
}) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      // 開いた直後のフォーカスを見出しに置く層があるので、見出しにはフォーカスの枠を出さない。
      className={cn(
        "outline-none",
        dialogTitleSizeClassNames[size],
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-supporting text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
