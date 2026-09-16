import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  context?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  context,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-header", className)}>
      {context && (
        <div className="text-supporting font-control text-muted-foreground">
          {context}
        </div>
      )}
      <h1 className="text-page-title tracking-heading sm:text-page-title-wide">
        {title}
      </h1>
      {description && (
        <p className="text-body text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
