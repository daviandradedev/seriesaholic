"use client";

import type { ReactNode } from "react";
import { usePreferences } from "@/components/Preferences";
import { cn } from "@/lib/utils";

function openModal(node: HTMLDialogElement | null) {
  if (!node) return;
  if (!node.open) node.showModal();
  return () => {
    if (node.open) node.close();
  };
}

export function ModalDialog({
  labelledBy,
  describedBy,
  lightDismiss = false,
  onClose,
  className,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  lightDismiss?: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const { theme } = usePreferences();
  const light = theme === "light";

  return (
    <dialog
      ref={openModal}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      closedby={lightDismiss ? "any" : "closerequest"}
      onClose={(event) => {
        if (event.currentTarget.open) return;
        onClose();
      }}
      className={cn(
        "fixed inset-0 mx-auto mt-auto mb-4 max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border p-6 shadow-2xl sm:my-auto",
        light
          ? "border-zinc-200 bg-white text-zinc-900 backdrop:bg-zinc-900/40"
          : "border-white/10 bg-[#12121a] text-white backdrop:bg-black/70",
        className,
      )}
    >
      {children}
    </dialog>
  );
}
