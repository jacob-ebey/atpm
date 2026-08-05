import { basecoat } from "@/lib/basecoat";
import { clsx } from "@/lib/clsx";
import type { JSXProps } from "srv-jsx";

export function DropdownMenu({
  class: className,
  ...props
}: Omit<JSXProps<HTMLDivElement>, "ref">) {
  return (
    <div
      {...props}
      class={clsx("dropdown-menu", className)}
      ref={async () => {
        "use client";
        const api = await basecoat();
        api.init("dropdown-menu");
      }}
    />
  );
}
