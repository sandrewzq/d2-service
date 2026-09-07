import type { ReactNode } from "react";
import { ControlButton, type ControlButtonProps } from "./ControlButton.js";

export type RefreshControlButtonProps = Omit<ControlButtonProps, "aria-busy" | "children"> & {
  children: ReactNode;
  refreshing?: boolean;
};

export function RefreshControlButton({
  children,
  className,
  disabled,
  refreshing = false,
  ...props
}: RefreshControlButtonProps) {
  const buttonClassName = [
    "control-refresh-button",
    refreshing ? "is-refreshing" : "",
    className ?? ""
  ].filter(Boolean).join(" ");

  return (
    <ControlButton
      {...props}
      className={buttonClassName}
      disabled={disabled || refreshing}
      aria-busy={refreshing || undefined}
    >
      <svg className="control-refresh-button-icon" aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </svg>
      <span>{children}</span>
    </ControlButton>
  );
}
