import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

const stack: HTMLElement[] = [];
const returnFocus = new WeakMap<HTMLElement, HTMLElement | null>();
let previousOverflow = "";
export function Modal({
  label,
  alert = false,
  onClose,
  children,
}: {
  label: string;
  alert?: boolean;
  onClose?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const outsidePress = useRef(false);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const root = document.getElementById("root");
    const previous = document.activeElement as HTMLElement | null;
    if (!stack.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const parent = stack.at(-1);
    if (parent) parent.inert = true;
    returnFocus.set(dialog, previous);
    stack.push(dialog);
    if (root) root.inert = true;
    dialog
      .querySelector<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
      )
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (stack.at(-1) !== dialog) return;
      if (e.key === "Escape" && close.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (!first) {
        e.preventDefault();
        dialog.focus();
      } else if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      const wasTop = stack.at(-1) === dialog;
      const previous = returnFocus.get(dialog);
      for (const remaining of stack) {
        const target = returnFocus.get(remaining);
        if (target && dialog.contains(target))
          returnFocus.set(remaining, previous ?? null);
      }
      stack.splice(stack.indexOf(dialog), 1);
      const top = stack.at(-1);
      if (top) top.inert = false;
      if (root) root.inert = stack.length > 0;
      if (!stack.length) document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", key);
      if (wasTop) {
        if (previous?.isConnected && !previous.closest("[inert]"))
          previous.focus({ preventScroll: true });
        // 削除・復元後は元のボタンが無効になる場合がある。
        if (top && !top.contains(document.activeElement))
          top.focus({ preventScroll: true });
      }
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        outsidePress.current =
          event.target === event.currentTarget && event.button === 0;
      }}
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          outsidePress.current &&
          stack.at(-1) === ref.current
        ) {
          event.stopPropagation();
          close.current?.();
        }
        outsidePress.current = false;
      }}
    >
      <div
        ref={ref}
        className="confirmation"
        role={alert ? "alertdialog" : "dialog"}
        aria-label={label}
        aria-modal="true"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
