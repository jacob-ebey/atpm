import { Hono } from "hono";

import { Body, Head } from "@/components/document";
import { Layout } from "@/containers/layout";
import { createStatus, readUserStatus } from "@/models/status";
import { Toast } from "@/components/ui/toast";

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

app.on(["GET", "POST"], "/statusphere", async (c) => {
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
            <Toast toaster="toaster" category="error" title="Failed to create status" />
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
      hx-post
      class="flex flex-wrap gap-4 justify-center"
      method="post"
      hx-sync="this:abort"
      hx-browser-indicator="true"
    >
      {emojis.map((emoji) => (
        <button
          type="submit"
          class="btn text-2xl"
          size="icon-lg"
          data-variant={emoji === status?.status ? "outline" : "ghost"}
          name="status"
          value={emoji}
        >
          {emoji}
        </button>
      ))}
    </form>
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
