import { basecoat } from "@/lib/basecoat";
import type { JSXProps } from "srv-jsx";

export function DropdownMenu({ ...props }: Omit<JSXProps<HTMLDivElement>, "ref">) {
  return (
    <div
      {...props}
      ref={async () => {
        "use client";
        const api = await basecoat();
        api.init("dropdown-menu");
      }}
    />
  );
}
