import { Hono } from "hono";
import * as v from "valibot";

import { Body, Head } from "@/components/document";
import { Layout } from "@/containers/layout";
import { ReturnToSchema } from "@/lib/return-to";

const app = new Hono();

app.get("/", async (c) => {
  return c.render(
    <html lang="en">
      <Head>
        <title>ATPM</title>
        <meta name="description" content="Distributed package management." />
      </Head>
      <Body>
        <Layout>
          <main>
            <section class="c-x c-y">
              <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
                Own your code
              </h1>
              <p class="max-w-prose text-lg text-muted-foreground mb-6">
                Package management for the decentralized web built on the AT Protocol.
              </p>
              <p class="max-w-prose text-muted-foreground mb-6">
                AT Package Manager works by publishing each package as an AT Protocol record with
                version tarballs in the users PDS. The registry resolves handles to DIDs, serves
                packages over an npm-compatible API, and falls back to the npm registry for anything
                not published to the AT Protocol.
              </p>
              <div
                class="item flex w-full max-w-fit py-0 pr-1 text-nowrap flex-nowrap justify-between"
                data-variant="outline"
                data-size="sm"
              >
                <code class="min-w-0 flex-1 overflow-x-auto scrollbar-none">
                  {`registry=${new URL("/registry", c.req.url)}`}
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
                    aria-hidden="true"
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
            </section>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

app.get("/login", (c) => {
  const atcute = c.get("atcute");
  const url = new URL(c.req.url);
  const returnTo = decodeURIComponent(url.searchParams.get("returnTo") || "");
  const success = url.searchParams.has("success");

  const isCliLogin = returnTo.startsWith("/registry/-/cli/");
  if (
    !isCliLogin &&
    atcute.session &&
    !url.searchParams.has("error") &&
    !url.searchParams.has("success")
  ) {
    return c.redirect(v.parse(ReturnToSchema, returnTo));
  }

  return c.render(
    <html lang="en">
      <Head>
        <title>Login</title>
      </Head>
      <Body>
        <Layout>
          <main class="c-x py-16">
            {success ? (
              <div class="card max-w-sm mx-auto">
                <header>
                  <h2>Login Successful</h2>
                </header>
                <section>
                  <p>You have successfully logged in and can close this window.</p>
                </section>
              </div>
            ) : (
              <div class="grid gap-4">
                {isCliLogin && atcute.session ? (
                  <div class="card max-w-sm w-full mx-auto">
                    <header>
                      <h2>Continue</h2>
                      <p>
                        Login as <code class="break-all">{atcute.session.did}</code>
                      </p>
                    </header>
                    <footer>
                      <a href={returnTo} class="btn w-full">
                        Continue
                      </a>
                    </footer>
                  </div>
                ) : null}
                <div class="card max-w-sm w-full mx-auto">
                  <header>
                    <h2>Login</h2>
                    <p>Log in with your Atmosphere account.</p>
                  </header>
                  <section>
                    <form id="login-form" class="grid gap-4" method="post" action="/oauth/login">
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <div class="grid gap-3">
                        <label class="label sr-only" for="login-dialog-username">
                          Handle
                        </label>
                        <input
                          autofocus
                          name="handle"
                          class="input"
                          type="text"
                          placeholder="atmosphere.handle"
                          id="login-dialog-username"
                        />
                      </div>
                    </form>
                  </section>
                  <footer class="flex-col gap-2">
                    <button type="submit" form="login-form" class="btn w-full">
                      Authorize
                    </button>
                  </footer>
                </div>
              </div>
            )}
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

export default app;
