import { basecoat } from "@/lib/basecoat";
import { clsx } from "@/lib/clsx";
import type { JSXProps } from "srv-jsx";

export function Sidebar({ class: className, ...props }: Omit<JSXProps<HTMLDivElement>, "ref">) {
  return (
    <aside
      {...props}
      class={clsx("sidebar", className)}
      ref={async () => {
        "use client";
        const api = await basecoat();
        api.init("sidebar");
      }}
    />
  );
}
