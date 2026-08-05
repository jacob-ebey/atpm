import { getContext } from "hono/context-storage";

import { Body, Head } from "@/components/document";
import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

export async function App() {
  const c = getContext<Env>();
  const atproto = c.get("atproto");
  const profile = atproto?.session.did
    ? await c.env.PROFILE.getByName(atproto.session.did).get()
    : undefined;

  return (
    <html lang="en">
      <Head>
        <title>OSCMS</title>
      </Head>
      <Body>
        <header class="sticky top-0 z-50 w-full border-b border-border backdrop-blur supports-backdrop-filter:bg-background">
          <div class="flex h-16 max-w-7xl items-center gap-8 c-x">
            <a href="/" class="text-lg font-semibold">
              OSCMS
            </a>
            <div class="flex-1 flex items-center justify-end gap-2">
              {profile ? (
                <DropdownMenu id="dropdown-account" class="dropdown-menu">
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
                    commandfor="demo-dialog-edit-profile"
                  >
                    Login
                  </button>
                  <dialog
                    id="demo-dialog-edit-profile"
                    class="dialog"
                    aria-labelledby="demo-dialog-edit-profile-title"
                    aria-describedby="demo-dialog-edit-profile-description"
                    closedby="any"
                  >
                    <div class="sm:max-w-sm">
                      <header>
                        <h2 id="demo-dialog-edit-profile-title">Login</h2>
                        <p id="demo-dialog-edit-profile-description">
                          Log in with Atmosphere account.
                        </p>
                      </header>
                      <section>
                        <form
                          id="login-form"
                          class="grid gap-4"
                          method="post"
                          action="/oauth/login"
                        >
                          <div class="grid gap-3">
                            <label class="label sr-only" for="demo-dialog-edit-profile-username">
                              Handle
                            </label>
                            <input
                              name="handle"
                              class="input"
                              type="text"
                              placeholder="atmosphere.handle"
                              id="demo-dialog-edit-profile-username"
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
                          commandfor="demo-dialog-edit-profile"
                        >
                          Cancel
                        </button>
                        <button type="submit" form="login-form" class="btn">
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
                        commandfor="demo-dialog-edit-profile"
                      >
                        <svg
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

        <main>
          <section class="c-x c-y">
            <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
              The batteries-included AT Protocol starter.
            </h1>
            <p class="max-w-prose text-lg text-muted-foreground mb-4">
              Authentication, custom lexicons, Basecoat UI. Backed by the power of Cloudflare.
            </p>
            <div
              class="item flex w-full max-w-fit py-0 pr-1 text-nowrap flex-nowrap justify-between mb-6"
              data-variant="outline"
              data-size="sm"
            >
              <code class="min-w-0 flex-1 overflow-x-auto scrollbar-none">
                {"npx degit jacob-ebey/atproto-starter my-project"}
              </code>
              <button
                class="btn"
                data-size="icon-sm"
                data-variant="ghost"
                onclick={(event) => {
                  "use client";
                  const btn = event.currentTarget as HTMLButtonElement;
                  const code = btn.previousElementSibling as HTMLElement;
                  void navigator.clipboard.writeText(code.textContent).then(() => {
                    document.getElementById("toaster")!.toast({
                      category: "success",
                      title: "Copied to clipboard",
                    });
                  });
                }}
              >
                <span class="sr-only">Copy</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" />
                  <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
                </svg>
              </button>
            </div>
            <div class="flex gap-2 flex-wrap">
              <a href="#" class="btn" data-size="lg">
                Get Started
              </a>
              <a href="#" class="btn" data-size="lg" data-variant="ghost">
                Learn More
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M5 12l14 0" />
                  <path d="M13 18l6 -6" />
                  <path d="M13 6l6 6" />
                </svg>
              </a>
            </div>
          </section>
        </main>
      </Body>
    </html>
  );
}
