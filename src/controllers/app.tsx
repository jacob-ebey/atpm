import type { Did } from "@atcute/lexicons";
import type * as npm from "@npm/types";
import { Hono } from "hono";
import { marked } from "marked";
import { v5 as uuid } from "uuid";
import * as v from "valibot";

import { Body, Head } from "@/components/document";
import { Layout } from "@/containers/layout";
import { DevAtpmAlphaPackage as DevAtpmPackage } from "@/lexicons";
import { ReturnToSchema } from "@/lib/return-to";
import { timeAgo } from "@/lib/time";
import {
  approveStaged,
  readPackage,
  readRecentPackages,
  readStagedPackages,
  rejectStaged,
  searchPackages,
} from "@/models/packages";
import { requireAuth } from "@/lib/auth";
import { invariant } from "@/lib/invariant";

const app = new Hono();

app.get("/", async (c) => {
  const atcute = c.get("atcute");
  const recentPackages = await readRecentPackages();

  if (!atcute.authenticated) c.header("Cache-Control", "max-age=30, stale-while-revalidate=1800");
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
              <div
                class="item flex w-full max-w-fit py-0 pr-1 text-nowrap flex-nowrap justify-between mb-6"
                data-variant="outline"
                data-size="sm"
              >
                <code class="min-w-0 flex-1 overflow-x-auto scrollbar-none">
                  {`registry=${new URL("/", c.req.url)}`}
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
              <p class="max-w-prose text-muted-foreground">
                AT Package Manager works by publishing each package as an AT Protocol record with
                version tarballs in the users PDS. The registry resolves handles to DIDs, serves
                packages over an npm-compatible API, and falls back to the npm registry for anything
                not published to the AT Protocol.
              </p>
            </section>
            <section class="c-x c-y">
              <h2 class="font-serif text-2xl leading-tight tracking-tight text-balance lg:text-3xl mb-4">
                Recent Packages
              </h2>
              {recentPackages.map(async (pkg) => {
                const actor = await atcute.actorResolver
                  .resolve(pkg.did as Did)
                  .catch(() => undefined);
                if (!actor) return null;

                return (
                  <a href={`/package/${actor.did}/${pkg.rkey}`} class="item block">
                    <section>
                      <h3>
                        @{actor.handle}/{pkg.rkey}
                      </h3>
                      <p class="flex gap-3">
                        <span>{timeAgo(new Date(pkg.indexedAt).getTime())}</span>
                      </p>
                      <p class="truncate">
                        {pkg.did}/dev.atpm.alpha.package/{pkg.rkey}
                      </p>
                    </section>
                  </a>
                );
              })}
            </section>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

app.get("/search", async (c) => {
  const atcute = c.get("atcute");
  const url = new URL(c.req.url);

  const query = url.searchParams.get("q");
  const packages = query ? await searchPackages(query) : null;

  if (!packages?.length) c.status(404);

  if (!atcute.authenticated) c.header("Cache-Control", "max-age=30, stale-while-revalidate=1800");
  return c.render(
    <html lang="en">
      <Head>
        <title>{query ? `${query} | ATPM Search` : "ATPM Search"}</title>
        <meta name="description" content="Search for AT Protocol packages." />
      </Head>
      <Body>
        <Layout>
          <main>
            <section class="c-x c-y-s">
              {!packages?.length ? (
                <>
                  <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
                    No results found for "{query}"
                  </h1>
                  <p class="max-w-prose text-lg text-muted-foreground mb-6">
                    Try searching for a different package.
                  </p>
                </>
              ) : (
                packages.map(async (pkg) => {
                  const actor = await atcute.actorResolver
                    .resolve(pkg.did as Did)
                    .catch(() => undefined);
                  if (!actor) return null;

                  return (
                    <a href={`/package/${actor.did}/${pkg.rkey}`} class="item block">
                      <section>
                        <h3>
                          @{actor.handle}/{pkg.rkey}
                        </h3>
                        <p class="flex gap-3">
                          <span>{timeAgo(new Date(pkg.indexedAt).getTime())}</span>
                        </p>
                        <p class="truncate">
                          {pkg.did}/dev.atpm.alpha.package/{pkg.rkey}
                        </p>
                      </section>
                    </a>
                  );
                })
              )}
            </section>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

app.get("/package/:did/:rkey", async (c) => {
  const atcute = c.get("atcute");
  const url = new URL(c.req.url);
  const versionParam = url.searchParams.get("version");
  const did = c.req.param("did") as Did;
  const rkey = c.req.param("rkey");

  const [actor, pkg] = await Promise.all([
    atcute.actorResolver.resolve(c.req.param("did") as Did).catch(() => undefined),
    readPackage(did, rkey),
  ] as const);

  const selectedVersion = versionParam || (pkg?.tags as Record<string, string>)?.latest;

  const versions = pkg?.versions as DevAtpmPackage.Package[] | undefined;
  const version = versions?.find((v) => v.version === selectedVersion);

  if (!actor || !pkg || !versions || !version) {
    c.status(404);
    return c.render(
      <html lang="en">
        <Head>
          <title>Not Found | ATPM Search</title>
          <meta name="description" content="The package you are looking for could not be found." />
        </Head>
        <Body>
          <Layout>
            <main>
              <section class="c-x c-y-s">
                <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
                  Package not found
                </h1>
                <p class="max-w-prose text-lg text-muted-foreground mb-6">
                  The package you are looking for could not be found.
                </p>
              </section>
            </main>
          </Layout>
        </Body>
      </html>,
    );
  }

  const meta = version.meta as npm.PackumentVersion;

  let largestHeader = 6;
  if (meta.readme) {
    await marked
      .use({
        renderer: {
          heading({ tokens, depth }) {
            if (depth < largestHeader) largestHeader = depth;
            return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
          },
        },
      })
      .parse(meta.readme, {});
  }

  const hasNavMeta = Boolean(meta.homepage || meta.repository || meta.bugs);

  let size = "unknown";
  if ("size" in version.blob) {
    // convert to kB
    size = `${(version.blob.size / 1024).toFixed(2)} kB`;
  }

  if (!atcute.authenticated) c.header("Cache-Control", "max-age=30, stale-while-revalidate=1800");
  return c.render(
    <html lang="en">
      <Head>
        <title>{`${rkey} | ATPM`}</title>
        <meta name="description" content={meta.description || "No package description."} />
      </Head>
      <Body>
        <Layout>
          <main>
            <div class="c-x c-y-s">
              <h1 class="font-serif text-3xl leading-tight tracking-tight lg:text-4xl mb-4 break-all">
                @{actor.handle}/{rkey}
              </h1>
              {meta?.description ? (
                <p class="max-w-prose text-lg text-muted-foreground mb-6">{meta.description}</p>
              ) : null}
              {hasNavMeta ? (
                <nav class="breadcrumb" aria-label="External Links">
                  <ol>
                    {meta.repository ? (
                      <li>
                        <a
                          href={parseRepository(meta.repository.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          source
                        </a>
                      </li>
                    ) : null}
                    {meta.homepage ? (
                      <>
                        {meta.homepage || meta.repository ? (
                          <li aria-hidden="true">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                              <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path>
                            </svg>
                          </li>
                        ) : null}
                        <li>
                          <a href={meta.homepage} target="_blank" rel="noopener noreferrer">
                            homepage
                          </a>
                        </li>
                      </>
                    ) : null}
                    {meta.bugs?.url || meta.bugs?.email ? (
                      <>
                        {meta.homepage || meta.repository ? (
                          <li aria-hidden="true">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                              <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path>
                            </svg>
                          </li>
                        ) : null}
                        <li>
                          <a
                            href={meta.bugs.url || `mailto:${meta.bugs.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            issues
                          </a>
                        </li>
                      </>
                    ) : null}
                  </ol>
                </nav>
              ) : null}
              <hr class="my-8" />
              <section class="grid grid-cols-2 gap-8 sm:grid-cols-4">
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">Version</h4>
                  <div class="text-sm">{meta.version}</div>
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">License</h4>
                  <div class="text-sm">{meta.license || "unknown"}</div>
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">Install Size</h4>
                  <div class="text-sm">{size}</div>
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">Published</h4>
                  <div class="text-sm">{timeAgo(new Date(version.createdAt).getTime())}</div>
                </div>
              </section>
              <hr class="my-8" />
              <div class="md:grid md:grid-cols-[3fr_1fr] md:gap-8 md:[column-rule:1px_solid_var(--color-border)]">
                <div>
                  <h2 class="mb-4">README</h2>
                  <article
                    class="typeset"
                    innerHTML={await marked
                      .use({
                        renderer: {
                          heading({ tokens, depth }) {
                            const adjustedDepth = Math.min(depth + (2 - largestHeader), 6);
                            return `<h${adjustedDepth}>${this.parser.parseInline(tokens)}</h${adjustedDepth}>\n`;
                          },
                        },
                      })
                      .parse(meta.readme || "", {})}
                  />
                </div>

                <hr class="my-8 md:hidden" />

                <aside class="space-y-6">
                  <div class="space-y-2">
                    <h4 class="text-sm leading-none font-semibold">Dependencies</h4>
                    {Object.entries(meta.dependencies ?? {}).length > 0 ? (
                      Object.entries(meta.dependencies ?? {}).map(([name, version]) => (
                        <div class="text-sm">
                          {name}@{version}
                        </div>
                      ))
                    ) : (
                      <div class="text-sm">none</div>
                    )}
                  </div>
                  <div class="space-y-2">
                    <h4 class="text-sm leading-none font-semibold">Peer Dependencies</h4>
                    {Object.entries(meta.peerDependencies ?? {}).length > 0 ? (
                      Object.entries(meta.peerDependencies ?? {}).map(([name, version]) => (
                        <div class="text-sm">
                          {name}@{version}{" "}
                          {meta.peerDependenciesMeta?.[name]?.optional ? "(optional)" : null}
                        </div>
                      ))
                    ) : (
                      <div class="text-sm">none</div>
                    )}
                  </div>
                  <div class="space-y-2">
                    <h4 class="text-sm leading-none font-semibold">Versions</h4>
                    {versions.map((version) => (
                      <div>
                        <a href={`?version=${version.version}`} class="text-sm underline">
                          {version.version} - {timeAgo(new Date(version.createdAt).getTime())}
                        </a>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

app.get("/staged-packages", requireAuth(), async (c) => {
  const atcute = c.get("atcute");
  invariant(atcute.session);

  const staged = await readStagedPackages();

  return c.render(
    <html>
      <Head>
        <title>Staged Packages | ATPM</title>
        <meta name="description" content="List of staged packages." />
      </Head>
      <Body>
        <Layout>
          <main>
            <section class="c-x c-y-s">
              {!staged?.length ? (
                <>
                  <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
                    No staged packages
                  </h1>
                  <p class="max-w-prose text-lg text-muted-foreground mb-6">
                    You currently have no staged packages.
                  </p>
                </>
              ) : (
                <>
                  <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-6">
                    Staged packages
                  </h1>
                  {staged.map(async (pkg) => {
                    const stageId = uuid(pkg.uri + `/${pkg.cid}`, uuid.URL);

                    return (
                      <div class="card">
                        <header>
                          <h3>
                            {pkg.name}@{pkg.version}
                          </h3>
                          <p class="flex gap-3">
                            <span>{timeAgo(new Date(pkg.createdAt).getTime())}</span>
                          </p>
                        </header>
                        <section class="flex flex-wrap flex-col gap-6 sm:flex-row">
                          <div class="space-y-2">
                            <h4 class="text-sm leading-none font-semibold">Date</h4>
                            <div class="text-sm">
                              <time datetime={pkg.createdAt}>
                                {new Intl.DateTimeFormat("en-US", {
                                  timeZone: "UTC",
                                  dateStyle: "long",
                                  timeStyle: "long",
                                }).format(new Date(pkg.createdAt))}
                              </time>
                            </div>
                          </div>
                          <div class="space-y-2">
                            <h4 class="text-sm leading-none font-semibold">ID</h4>
                            <div class="text-sm break-all">{stageId}</div>
                          </div>
                          <div class="space-y-2">
                            <h4 class="text-sm leading-none font-semibold">URI</h4>
                            <div class="text-sm break-all">{pkg.uri}</div>
                          </div>
                          <div class="space-y-2">
                            <h4 class="text-sm leading-none font-semibold">Shasum</h4>
                            <div class="text-sm break-all">
                              {(pkg.meta as npm.PackumentVersion).dist.shasum}
                            </div>
                          </div>
                        </section>
                        <footer class="flex gap-2">
                          <form method="post" action={`/staged-package/${stageId}/approve`}>
                            <button type="submit" class="btn">
                              Approve
                            </button>
                          </form>
                          <a
                            class="btn"
                            data-variant="secondary"
                            href={`/staged-package/${stageId}`}
                          >
                            Review
                          </a>
                          <form method="post" action={`/staged-package/${stageId}/reject`}>
                            <button type="submit" class="btn" data-variant="destructive">
                              Reject
                            </button>
                          </form>
                        </footer>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

app.get("/staged-package/:stageId", requireAuth(), async (c) => {
  const stageId = c.req.param("stageId");
  const staged = await readStagedPackages();
  const pkg = staged.find((pkg) => stageId === uuid(pkg.uri + `/${pkg.cid}`, uuid.URL));
  if (!pkg) {
    return c.notFound();
  }

  return c.render(
    <html lang="en">
      <Head>
        <title>Staged {pkg.name} | ATPM</title>
        <meta name="description" content={`Staged package ${pkg.name}`} />
      </Head>
      <Body>
        <Layout>
          <main class="c-x c-y-s">
            <h1 class="font-serif text-3xl leading-tight tracking-tight text-balance lg:text-4xl mb-4">
              {pkg.name}@{pkg.version}
            </h1>
            <p class="max-w-prose text-lg text-muted-foreground mb-6">
              {timeAgo(new Date(pkg.createdAt).getTime())}
            </p>

            <section class="card mb-6">
              <section class="flex flex-wrap flex-col gap-6 sm:flex-row">
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">Date</h4>
                  <div class="text-sm">
                    <time datetime={pkg.createdAt}>
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: "UTC",
                        dateStyle: "long",
                        timeStyle: "long",
                      }).format(new Date(pkg.createdAt))}
                    </time>
                  </div>
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">ID</h4>
                  <div class="text-sm break-all">{stageId}</div>
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">URI</h4>
                  <div class="text-sm break-all">{pkg.uri}</div>
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm leading-none font-semibold">Shasum</h4>
                  <div class="text-sm break-all">
                    {(pkg.meta as npm.PackumentVersion).dist.shasum}
                  </div>
                </div>
              </section>
              <footer class="flex gap-2">
                <form method="post" action={`/staged-package/${stageId}/approve`}>
                  <button type="submit" class="btn">
                    Approve
                  </button>
                </form>
                <form method="post" action={`/staged-package/${stageId}/reject`}>
                  <button type="submit" class="btn" data-variant="destructive">
                    Reject
                  </button>
                </form>
              </footer>
            </section>

            <section class="empty border border-dashed">
              <header>
                <h3>Under Construction</h3>
                <p>A diff viewer is in the works.</p>
              </header>
            </section>
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

app.post("/staged-package/:stageId/approve", async (c) => {
  const stageId = c.req.param("stageId");
  const result = await approveStaged(stageId);
  const to = new URL("/staged-packages", c.req.url);
  if (!result.success) {
    to.searchParams.set("error", result.error);
  }
  return c.redirect(to);
});
app.post("/staged-package/:stageId/reject", async (c) => {
  const stageId = c.req.param("stageId");
  const result = await rejectStaged(stageId);
  const to = new URL("/staged-packages", c.req.url);
  if (!result.success) {
    to.searchParams.set("error", result.error);
  }
  return c.redirect(to);
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
          <main class="c-x c-y-s">
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

function parseRepository(url: string) {
  return url.replace(/^\w+\+http/, "http").replace(/\.git$/, "");
}

export default app;
