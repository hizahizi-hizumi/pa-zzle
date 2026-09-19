import type { ReactNode } from "react";

type MenuButtonProps = {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
};

export function MenuButton({ icon, label, onClick }: MenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
