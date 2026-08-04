import { Head } from "./components/head";
import { transition } from "./lib/view-transition";

export function App() {
  return (
    <html lang="en">
      <Head>
        <title>OSCMS</title>
      </Head>
      <body>
        <div class="min-h-screen flex flex-col">
          <header class="sticky top-0 z-50 w-full border-b border-border backdrop-blur supports-backdrop-filter:bg-background">
            <div class="flex h-16 max-w-7xl items-center gap-8 c-x">
              <a href="#" class="text-lg font-semibold">
                OSCMS
              </a>
              <div class="flex-1 flex items-center justify-end gap-8">
                <button
                  class="btn"
                  data-size="icon"
                  data-variant="outline"
                  data-tooltip="Toggle Theme"
                  data-side="inline-start"
                  onclick={() => {
                    "use client";
                    void transition(() => {
                      window.basecoat.theme.toggle();
                    });
                  }}
                >
                  <span class="sr-only">Toggle Theme</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="dark:hidden"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M14.828 14.828a4 4 0 1 0 -5.656 -5.656a4 4 0 0 0 5.656 5.656" />
                    <path d="M6.343 17.657l-1.414 1.414" />
                    <path d="M6.343 6.343l-1.414 -1.414" />
                    <path d="M17.657 6.343l1.414 -1.414" />
                    <path d="M17.657 17.657l1.414 1.414" />
                    <path d="M4 12h-2" />
                    <path d="M12 4v-2" />
                    <path d="M20 12h2" />
                    <path d="M12 20v2" />
                  </svg>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="hidden dark:inline-block"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" />
                    <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
                    <path d="M19 11h2m-1 -1v2" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <div class="flex-1 flex">
            <main class="flex-1">
              <section class="c-x c-y">
                <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
                  The data solution for your whole team.
                </h1>
                <p class="max-w-prose text-lg text-muted-foreground mb-6">
                  Connect any database. Auto-generate ORM models, a no-code interface, and a native
                  MCP server for your <span class="text-primary text-xl">Agents</span>.
                </p>
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
                  <div class="hidden sm:flex flex-1 justify-end">
                    <div
                      class="item py-0 pr-1 flex-0 w-min text-nowrap flex-nowrap justify-between"
                      data-variant="outline"
                      data-size="sm"
                    >
                      <code>{"npm i oscms"}</code>
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
                  </div>
                </div>
              </section>

              <section></section>
            </main>
          </div>

          <footer class="">Footer</footer>
        </div>
        <div id="toaster" class="toaster" />
      </body>
    </html>
  );
}
