import { Hono } from "hono";

import { Body, Head } from "@/components/document";
import { Sidebar } from "@/components/ui/sidebar";
import { Layout } from "@/containers/layout";
import { docsMarked } from "@/lib/docs";

const app = new Hono();

// Lazy-load the markdown sources from the docs/ folder with Vite glob.
const docs = import.meta.glob("../../docs/**/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const cache = new Map<string, { title: string; html: string }>();

app.get("/:slug{.+}", async (c) => {
  const atcute = c.get("atcute");
  const slug = c.req.param("slug");

  const extraMobileButtons = (
    <button
      type="button"
      class="btn md:hidden"
      data-variant="outline"
      data-size="icon"
      aria-label="Open docs menu"
      onclick={() => {
        "use client";
        const sidebar = document.getElementById("docs-sidebar") as HTMLDivElement;
        sidebar.toggle();
      }}
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
        class="icon icon-tabler icons-tabler-outline icon-tabler-book"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
        <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
        <path d="M3 6l0 13" />
        <path d="M12 6l0 13" />
        <path d="M21 6l0 13" />
      </svg>
    </button>
  );

  const sidebar = (
    <Sidebar id="docs-sidebar" data-side="left">
      <nav aria-label="Sidebar navigation">
        <section class="scrollbar-sm">
          <div role="group" aria-labelledby="group-label-content-1">
            <h3 id="group-label-content-1">Documentation</h3>
            <ul>
              <li>
                <a href="/docs/getting-started">
                  <span>Getting started</span>
                </a>
              </li>
              <li>
                <a href="/docs/trusted-publishing">
                  <span>Trusted publishing</span>
                </a>
              </li>
            </ul>
          </div>
        </section>
      </nav>
    </Sidebar>
  );

  const loader = docs[`../../docs/${slug}.md`];
  if (!loader) {
    return c.notFound();
  }

  let doc = cache.get(slug);
  if (!doc) {
    const source = await loader();
    const html = await docsMarked.parse(source, { async: true });
    const title = source.match(/^#\s+(.+)$/m)?.[1] ?? "Documentation";
    doc = { title, html };
    cache.set(slug, doc);
  }

  if (!atcute.authenticated) c.header("Cache-Control", "s-maxage=30, stale-while-revalidate=1800");
  return c.render(
    <html lang="en">
      <Head>
        <title>{`${doc.title} | ATPM Docs`}</title>
        <meta name="description" content="ATPM documentation." />
      </Head>
      <Body>
        {sidebar}
        <div>
          <Layout extraMobileButtons={extraMobileButtons}>
            <main>
              <section class="c-x c-y-s">
                <article class="typeset" innerHTML={doc.html} />
              </section>
            </main>
          </Layout>
        </div>
      </Body>
    </html>,
  );
});

export default app;
