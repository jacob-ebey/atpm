import { Hono } from "hono";

import { Body, Head } from "@/components/document";
import { Toast, Toaster } from "@/components/ui/toast";
import { Layout } from "@/containers/layout";
import { requireAuth } from "@/lib/auth";
import { clsx } from "@/lib/clsx";
import { createStatus, readRecentStatuses, readUserStatus } from "@/models/status";
import { Suspense } from "srv-jsx";

const app = new Hono<Env>();

app.get("/", async (c) => {
  const atcute = c.get("atcute");
  if (atcute.session) {
    return c.redirect(new URL("/statusphere", c.req.url));
  }

  return c.render(
    <html lang="en">
      <Head>
        <title>AT Starter</title>
        <meta name="description" content="The batteries-included AT Protocol starter." />
      </Head>
      <Body>
        <Layout>
          <main>
            <section class="c-x c-y">
              <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
                The batteries-included AT Protocol starter.
              </h1>
              <p class="max-w-prose text-lg text-muted-foreground mb-6">
                Authentication, custom lexicons, Basecoat UI. Backed by the power of Cloudflare.
              </p>
              <div
                class="item flex w-full max-w-fit py-0 pr-1 text-nowrap flex-nowrap justify-between"
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

app.on(["GET", "POST"], "/statusphere", requireAuth(), async (c) => {
  const hxRequest = c.req.method === "POST" && c.req.header("HX-Request") === "true";

  if (c.req.method === "POST") {
    const formData = await c.req.formData();
    const status = formData.get("status") as string;
    const created = await createStatus({ status });

    if (created.issues) {
      if (hxRequest) {
        return c.render(
          <>
            <EmojiForm />
            <Toaster>
              <Toast category="error" title="Failed to create status" />
            </Toaster>
          </>,
        );
      }

      return c.redirect(
        new URL(`/statusphere?error=${encodeURI("Failed to create status")}`, c.req.url),
      );
    }
  }

  if (hxRequest) {
    return c.render(<EmojiForm />);
  }

  return c.render(
    <html lang="en">
      <Head>
        <title>Statusphere</title>
      </Head>
      <Body>
        <Layout>
          <main>
            <section class="c-x py-4 md:py-8">
              <div class="card">
                <header>
                  <h2>Statusphere</h2>
                  <p>Set your satus on the Atmosphere</p>
                </header>
                <section>
                  <EmojiForm />
                </section>
              </div>
            </section>
            <section class="c-x py-4 md:py-8">
              <div class="card">
                <header>
                  <h2>Recent Statuses</h2>
                  <p>What's everyone emoting?</p>
                </header>
                <section>
                  <Suspense
                    fallback={
                      <div>
                        {Array.from({ length: 10 }).map(() => (
                          <div class="flex items-center gap-4 h-15.5 px-4">
                            <div class="skeleton size-8 shrink-0 rounded-full"></div>
                            <div class="grid gap-2">
                              <div class="skeleton h-4 w-58"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <RecentStatuses />
                  </Suspense>
                </section>
              </div>
            </section>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

async function EmojiForm() {
  const status = await readUserStatus();

  return (
    <form
      class="flex flex-wrap gap-4 justify-center"
      method="post"
      action="/statusphere"
      hx-post="/statusphere"
      hx-target="this"
      hx-swap="outerHTML transition:true"
      hx-sync="this:queue last"
      hx-browser-indicator="true"
    >
      {emojis.map((emoji) => (
        <button
          type="submit"
          class={clsx("btn text-2xl", emoji === status?.status && "order-first")}
          size="icon-lg"
          data-variant={emoji === status?.status ? "outline" : "ghost"}
          name="status"
          value={emoji}
          style={`view-transition-name: status-${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </form>
  );
}

async function RecentStatuses() {
  const statuses = await readRecentStatuses();
  return (
    <div>
      {statuses.map((status) => (
        <div class="item">
          <figure>
            <svg viewBox="0 0 100 100" class="size-8">
              <foreignObject width="100" height="100">
                <div style="width:100%; height:100%; display:flex; justify-content:center; align-items:center; font-size:80px;">
                  {status.record.status}
                </div>
              </foreignObject>
            </svg>
          </figure>
          <section>
            <p>{status.did}</p>
          </section>
        </div>
      ))}
    </div>
  );
}

const emojis = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😃",
  "😄",
  "😅",
  "😆",
  "😉",
  "😊",
  "😋",
  "😎",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "☺️",
  "🙂",
  "🤗",
  "🤩",
  "🤔",
  "🤨",
  "😐",
  "😑",
  "😶",
  "🙄",
  "😏",
  "😣",
  "😥",
  "😮",
  "🤐",
  "😯",
  "😪",
  "😫",
  "😴",
  "😌",
  "😛",
  "😜",
  "😝",
  "🤤",
  "😒",
  "😓",
  "😔",
  "😕",
  "🙃",
  "🤑",
  "😲",
  "☹️",
  "🙁",
  "😖",
  "😞",
  "😟",
  "😤",
  "😢",
  "😭",
  "😦",
  "😧",
  "😨",
  "😩",
  "🤯",
  "😬",
  "😰",
  "😱",
  "🥵",
  "🥶",
  "😳",
  "🤪",
  "😵",
  "😡",
  "😠",
  "🤬",
  "😷",
  "🤒",
  "🤕",
  "🤢",
  "🤮",
  "🥴",
  "😇",
  "🤠",
  "🤡",
  "🥳",
  "🥺",
  "🤥",
  "🤫",
  "🤭",
  "🧐",
  "🤓",
  "😈",
  "👿",
  "👹",
  "👺",
  "💀",
  "☠️",
  "👻",
  "👽",
  "👾",
  "🤖",
  "💩",
  "😺",
  "😸",
  "😹",
  "😻",
  "😼",
  "😽",
  "🙀",
  "😿",
  "😾",
];

export default app;
