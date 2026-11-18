import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string; className?: string }>) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img">) =>
    React.createElement("img", { ...props, alt: props.alt ?? "" }),
}));

if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    setTimeout(() => this.dispatchEvent(new Event("close")), 0);
  };
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("dark"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
});
