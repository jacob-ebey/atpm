import { Marker, type JSXProps } from "srv-jsx";

import { basecoat } from "@/lib/basecoat";
import { clsx } from "@/lib/clsx";

export function Toaster({ children, class: className, id, ...props }: JSXProps<HTMLDivElement>) {
  return (
    <div
      {...props}
      id={id}
      class={clsx("toaster", className)}
      ref={async () => {
        "use client";
        const api = await basecoat();
        api.init("toaster");
      }}
    >
      {children}
      {typeof id === "string" && id ? <Marker name={id} /> : null}
    </div>
  );
}

export function Toast({
  toaster,
  title,
  action,
  cancel,
  category,
  description,
  duration,
}: {
  toaster?: string;
  duration?: number;
  category?: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
  cancel?: string;
}) {
  const toast = (
    <div
      class="toast"
      role="status"
      aria-atomic="true"
      aria-hidden="false"
      data-category={category}
      data-duration={duration}
      ref={async () => {
        "use client";
        const api = await basecoat();
        api.init("toast");
      }}
    >
      <div class="toast-content">
        {category === "success" ? (
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        ) : category === "error" ? (
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        ) : category === "warning" ? (
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        )}
        <section>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </section>
        {cancel || action ? (
          <footer>
            {action ? (
              <a class="btn" href={action.href} data-toast-action>
                {action.label}
              </a>
            ) : null}
            {cancel ? (
              <button type="button" class="btn" data-variant="outline" data-toast-cancel>
                {cancel}
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );

  return toaster ? (
    <template for={toaster}>
      {toast}
      <Marker name={toaster} />
    </template>
  ) : (
    toast
  );
}
