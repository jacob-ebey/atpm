import type { JSXChild } from "srv-jsx";

import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { getContext } from "hono/context-storage";

export async function Layout({ children }: { children?: JSXChild }) {
  const c = getContext<Env>();
  const atcute = c.get("atcute");

  return (
    <>
      <header
        class="sticky top-0 z-50 w-full border-b border-border backdrop-blur supports-backdrop-filter:bg-background"
        style="view-transition-name: layout-header;"
      >
        <div class="flex items-center gap-2 c-x py-4">
          <a href="/" class="text-lg font-semibold text-nowrap hidden sm:block py-1">
            ATPM
          </a>
          <div class="flex-1 flex flex-wrap-reverse items-center justify-end gap-2">
            {atcute.session ? (
              <DropdownMenu id="dropdown-account">
                <button
                  type="button"
                  id="dropdown-account-trigger"
                  aria-haspopup="menu"
                  aria-controls="dropdown-account-menu"
                  aria-expanded="false"
                  class="btn"
                  data-variant="outline"
                >
                  {atcute.session.did}
                </button>
                <div
                  id="dropdown-account-popover"
                  data-popover
                  data-side="bottom"
                  data-align="end"
                  aria-hidden="true"
                  class="min-w-32"
                >
                  <form
                    role="menu"
                    id="dropdown-account-menu"
                    aria-labelledby="dropdown-account-trigger"
                    method="post"
                    action="/oauth/logout"
                  >
                    <button type="submit" role="menuitem">
                      Logout
                    </button>
                  </form>
                </div>
              </DropdownMenu>
            ) : (
              <a href="/login" class="btn" data-variant="outline">
                Login
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
