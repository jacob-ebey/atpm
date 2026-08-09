import { Suspense, type JSXChild } from "srv-jsx";

import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { getContext } from "hono/context-storage";

export async function Layout({ children }: { children?: JSXChild }) {
  const c = getContext<Env>();
  const atcute = c.get("atcute");

  const handlePromise = atcute.session
    ? atcute.actorResolver
        .resolve(atcute.session.did)
        .then((r) => r.handle || r.did)
        .catch(() => atcute.session!.did)
    : null;

  return (
    <>
      <header
        class="sticky top-0 z-50 w-full border-b border-border backdrop-blur supports-backdrop-filter:bg-background"
        style="view-transition-name: layout-header;"
      >
        <div class="flex items-center gap-2 c-x py-4">
          <a href="/" class="text-lg font-semibold text-nowrap">
            ATPM
          </a>
          <div class="flex-1 flex flex-wrap-reverse items-center justify-end gap-2">
            <Suspense>
              <div class="hidden sm:contents">
                <form class="flex-1 sm:flex-0" action="/search">
                  <div class="input-group">
                    <input type="text" placeholder="Search..." name="q" />
                    <span data-align="start" aria-hidden="true">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                        <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path>
                        <path d="M21 21l-6 -6"></path>
                      </svg>
                    </span>
                    <span data-align="end" class="hidden sm:inline">
                      <kbd class="kbd">⌘K</kbd>
                    </span>
                  </div>
                </form>
                {atcute.session ? (
                  <div>
                    <DropdownMenu id="dropdown-account">
                      <button
                        type="button"
                        id="dropdown-account-trigger"
                        aria-haspopup="menu"
                        aria-controls="dropdown-account-menu"
                        aria-expanded="false"
                        class="btn max-w-56"
                        data-variant="outline"
                      >
                        <span class="truncate">{handlePromise}</span>
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
                  </div>
                ) : (
                  <a href="/login" class="btn" data-variant="outline">
                    Login
                  </a>
                )}
              </div>
            </Suspense>
            <div class="hidden sm:contents">
              <ThemeToggle />
            </div>
            <button
              type="button"
              class="btn sm:hidden"
              data-variant="outline"
              data-size="icon"
              aria-label="Open Menu"
              command="show-modal"
              commandfor="layout-mobile-nav"
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
                class="icon icon-tabler icons-tabler-outline icon-tabler-menu-2"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M4 6l16 0"></path>
                <path d="M4 12l16 0"></path>
                <path d="M4 18l16 0"></path>
              </svg>
            </button>
          </div>
        </div>
      </header>
      {children}
      <dialog
        id="layout-mobile-nav"
        class="drawer h-min"
        data-side="top"
        aria-label="Main menu"
        closedby="any"
      >
        <article class="max-h-[50vh]" style="view-transition-name: layout-mobile-nav;">
          <section class="p-4 grid gap-4">
            <div class="flex">
              <div class="flex-1">
                <ThemeToggle />
              </div>
              <div class="flex-1 flex justify-end">
                {atcute.session ? (
                  <form
                    role="menu"
                    id="dropdown-account-menu"
                    aria-labelledby="dropdown-account-trigger"
                    method="post"
                    action="/oauth/logout"
                    class="contents"
                  >
                    <button type="submit" class="btn">
                      Logout
                    </button>
                  </form>
                ) : (
                  <a href="/login" class="btn" data-variant="outline">
                    Login
                  </a>
                )}
              </div>
            </div>

            <form class="flex-1 sm:flex-0" action="/search">
              <div class="input-group">
                <input type="text" placeholder="Search..." name="q" />
                <span data-align="start" aria-hidden="true">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path>
                    <path d="M21 21l-6 -6"></path>
                  </svg>
                </span>
              </div>
            </form>
          </section>
        </article>
      </dialog>
    </>
  );
}
