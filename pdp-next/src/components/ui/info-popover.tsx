"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type InfoPopoverProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function InfoPopover({ label, children, className }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const popoverId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const viewportPadding = 8;
    const anchorGap = 8;

    const updatePosition = () => {
      if (!containerRef.current || !popoverRef.current) {
        return;
      }

      const anchorRect = containerRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
      left = Math.max(viewportPadding, Math.min(left, viewportWidth - popoverRect.width - viewportPadding));

      const bottomTop = anchorRect.bottom + anchorGap;
      const topTop = anchorRect.top - popoverRect.height - anchorGap;
      const canOpenBelow = bottomTop + popoverRect.height <= viewportHeight - viewportPadding;

      let top = canOpenBelow ? bottomTop : topTop;
      top = Math.max(viewportPadding, Math.min(top, viewportHeight - popoverRect.height - viewportPadding));

      setPopoverStyle({
        left,
        top,
        maxHeight: viewportHeight - viewportPadding * 2,
      });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current || !popoverRef.current) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Node &&
        !containerRef.current.contains(target) &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("touchstart", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`inline-flex ${className ?? ""}`.trim()}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        title={label}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
      >
        i
      </button>
      {isOpen
        ? createPortal(
            <div
              id={popoverId}
              ref={popoverRef}
              role="dialog"
              aria-label={label}
              className="pdp-card fixed z-[100] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto p-3 text-xs leading-5 shadow-xl"
              style={popoverStyle}
            >
              <p style={{ color: "var(--pdp-text)" }}>{children}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
