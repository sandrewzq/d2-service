import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

export type SharedItemDetailView = {
  name: string;
  isBusy?: boolean;
};

export type VendorOfferContext = {
  vendorName: string;
  costLabel: string;
  affordabilityLabel: string;
  characterLabel: string;
  refreshLabel: string;
  rollLabels?: string[];
  stats?: Record<string, number>;
  ownershipLabel?: string;
  ownershipLocationLabel?: string;
  ownershipAsOfLabel?: string;
};

export type SharedItemDetailDialogProps = {
  detail: SharedItemDetailView;
  vendorContext?: VendorOfferContext;
  closeLabel: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  sections: ReactNode;
  variant?: "default" | "weapon" | "armor" | "loading";
  subtitle?: ReactNode;
  objectContext?: ReactNode;
};

export function SharedItemDetailDialog(props: SharedItemDetailDialogProps) {
  const portalTarget = typeof document === "undefined"
    ? null
    : document.querySelector<HTMLElement>(".app-shell") ?? document.body;
  const titleId = useId();
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  const initialFocus = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : document.activeElement as HTMLElement | null
  );
  const canonicalTitle = props.variant === "armor"
    ? "护甲档案"
    : props.variant === "weapon"
      ? "武器档案"
      : "装备档案";
  const canonicalDescription = props.variant === "armor"
    ? "真实属性、获取来源、护甲配置、目标匹配、强化状态和账号实例"
    : props.variant === "weapon"
      ? "查看当前 Roll、真实属性、获取来源、推荐 Roll 和升级状态"
      : "正在读取完整定义与装备状态";

  useEffect(() => {
    const overlayRoot = backdropRef.current;
    const isolatedElements = typeof document === "undefined" || !overlayRoot?.parentElement
      ? []
      : [...overlayRoot.parentElement.children]
          .filter((element): element is HTMLElement => (
            element instanceof HTMLElement
            && element !== overlayRoot
          ))
          .map((element) => ({ element, wasInert: element.inert }));
    for (const { element } of isolatedElements) element.inert = true;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[data-ui-kind="drawer"].is-open')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      for (const { element, wasInert } of isolatedElements) element.inert = wasInert;
      (props.returnFocusRef?.current ?? initialFocus.current)?.focus();
    };
  }, [props.returnFocusRef]);

  const dialog = (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      data-overlay-root="item-detail"
      role="presentation"
      onClick={props.onClose}
    >
      <section
        ref={dialogRef}
        className={`item-modal shared-item-detail-dialog shared-item-detail-${props.variant ?? "default"}`}
        data-detail-contract={props.variant === "weapon" || props.variant === "armor" || props.variant === "loading" ? "detail.dossier" : undefined}
        data-has-vendor-context={props.vendorContext ? "true" : undefined}
        data-state={props.detail.isBusy ? "loading" : "normal"}
        data-surface="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={props.detail.isBusy ? "true" : "false"}
        onClick={(event) => event.stopPropagation()}
      >
        {props.variant === "weapon" || props.variant === "armor" || props.variant === "loading" ? (
          <header className="shared-item-detail-header" data-ui-kind="shell-chrome">
            <div>
              <h2 id={titleId} data-ui-part="value" data-text-tone="primary" data-info-priority="display">{canonicalTitle}</h2>
              <p data-ui-part="detail" data-text-tone="body" data-info-priority="reading">{canonicalDescription}</p>
            </div>
            <button
              ref={closeButtonRef}
              className="modal-close shared-item-detail-close"
              type="button"
              aria-label={props.closeLabel}
              title={props.closeLabel}
              data-ui-kind="button"
              data-control-variant="quiet"
              onClick={props.onClose}
            >
              ×
            </button>
          </header>
        ) : (
          <>
            <h2 id={titleId} className="shared-item-detail-title">{props.detail.name}</h2>
            <button
              ref={closeButtonRef}
              className="modal-close"
              type="button"
              aria-label={props.closeLabel}
              onClick={props.onClose}
            >
              关闭
            </button>
          </>
        )}
        {props.vendorContext ? (
          <section className="shared-item-detail-vendor" role="region" aria-label="商人售卖信息">
            <strong>{props.vendorContext.vendorName}</strong>
            <span>{props.vendorContext.costLabel}</span>
            <span>{props.vendorContext.affordabilityLabel}</span>
            <span>{props.vendorContext.characterLabel}</span>
            <span>{props.vendorContext.refreshLabel}</span>
            {props.vendorContext.ownershipLabel ? (
              <span>账号状态：{props.vendorContext.ownershipLabel}</span>
            ) : null}
            {props.vendorContext.ownershipLocationLabel ? (
              <span>实例位置：{props.vendorContext.ownershipLocationLabel}</span>
            ) : null}
            {props.vendorContext.ownershipAsOfLabel ? (
              <span>账号数据：{props.vendorContext.ownershipAsOfLabel}</span>
            ) : null}
            {props.vendorContext.rollLabels?.length ? (
              <span>当前售卖 Perk：{props.vendorContext.rollLabels.join(" / ")}</span>
            ) : null}
          </section>
        ) : null}
        <div className="shared-item-detail-body" data-scroll-region="page">{props.sections}</div>
      </section>
    </div>
  );

  return !portalTarget
    ? dialog
    : createPortal(dialog, portalTarget);
}

export function SharedItemDetailLoading() {
  return (
    <div className="shared-item-detail-loading-state" role="status" aria-live="polite">
      <div className="shared-item-detail-loading-identity">
        <span className="shared-item-detail-loading-block is-icon" aria-hidden="true" />
        <div>
          <span className="shared-item-detail-loading-block is-title" aria-hidden="true" />
          <span className="shared-item-detail-loading-block is-subtitle" aria-hidden="true" />
        </div>
        <div className="shared-item-detail-loading-summary" aria-hidden="true">
          <span className="shared-item-detail-loading-block" />
          <span className="shared-item-detail-loading-block" />
          <span className="shared-item-detail-loading-block" />
          <span className="shared-item-detail-loading-block" />
        </div>
      </div>
      <div className="shared-item-detail-loading-tabs" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </div>
      <div className="shared-item-detail-loading-content" aria-hidden="true">
        <section><span /><span /><span /><span /></section>
        <section><span /><span /><span /></section>
      </div>
      <p>正在读取装备定义与实时状态...</p>
    </div>
  );
}
