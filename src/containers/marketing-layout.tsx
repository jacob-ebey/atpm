import type { JSXChild } from "srv-jsx";

import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { getContext } from "hono/context-storage";

export async function MarketingLayout({ children }: { children?: JSXChild }) {
  const c = getContext<Env>();
  const atproto = c.get("atproto");
  const profile = atproto?.session.did
    ? await c.env.PROFILE.getByName(atproto.session.did).get()
    : undefined;

  return (
    <>
      <header class="sticky top-0 z-50 w-full border-b border-border backdrop-blur supports-backdrop-filter:bg-background">
        <div class="flex h-16 max-w-7xl items-center gap-8 c-x">
          <a href="/" class="text-lg font-semibold">
            AT Starter
          </a>
          <div class="flex-1 flex items-center justify-end gap-2">
            {profile ? (
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
                  {profile.displayName}
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
                    <div role="group" aria-labelledby="dropdown-account-account">
                      <div role="heading" id="dropdown-account-account">
                        {profile.handle}
                      </div>
                    </div>
                    <hr role="separator" />
                    <button type="submit" role="menuitem">
                      Logout
                    </button>
                  </form>
                </div>
              </DropdownMenu>
            ) : (
              <>
                <button
                  type="button"
                  class="btn"
                  data-variant="outline"
                  command="show-modal"
                  commandfor="layout-login-dialog"
                >
                  Login
                </button>
                <dialog
                  id="layout-login-dialog"
                  class="dialog"
                  aria-labelledby="layout-login-dialog-title"
                  aria-describedby="layout-login-dialog-description"
                  closedby="any"
                >
                  <div class="sm:max-w-sm">
                    <header>
                      <h2 id="layout-login-dialog-title">Login</h2>
                      <p id="layout-login-dialog-description">Log in with Atmosphere account.</p>
                    </header>
                    <section>
                      <form
                        id="layout-login-form"
                        class="grid gap-4"
                        method="post"
                        action="/oauth/login"
                      >
                        <div class="grid gap-3">
                          <label class="label sr-only" for="layout-login-dialog-username">
                            Handle
                          </label>
                          <input
                            name="handle"
                            class="input"
                            type="text"
                            placeholder="atmosphere.handle"
                            id="layout-login-dialog-username"
                          />
                        </div>
                      </form>
                    </section>
                    <footer>
                      <button
                        type="button"
                        class="btn"
                        data-variant="outline"
                        command="close"
                        commandfor="layout-login-dialog"
                      >
                        Cancel
                      </button>
                      <button type="submit" form="layout-login-form" class="btn">
                        Authorize
                      </button>
                    </footer>
                    <button
                      type="button"
                      class="btn"
                      data-variant="ghost"
                      data-size="icon-sm"
                      aria-label="Close dialog"
                      command="close"
                      commandfor="layout-login-dialog"
                    >
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-x-icon lucide-x"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                </dialog>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
