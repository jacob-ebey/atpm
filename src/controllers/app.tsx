import { Hono } from "hono";

import { Body, Head } from "@/components/document";
import { Layout } from "@/containers/layout";

const app = new Hono();

app.get("/login", (c) => {
  const url = new URL(c.req.url);
  const returnTo = decodeURIComponent(url.searchParams.get("returnTo") || "");
  const success = url.searchParams.has("success");

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
              <div class="card max-w-sm mx-auto">
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
            )}
          </main>
        </Layout>
      </Body>
    </html>,
  );
});

export default app;
