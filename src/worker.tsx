import { Hono } from "hono";

import { App } from "./app";
import { srvJsxRenderer } from "./lib/renderer";

const app = new Hono();

app.use(srvJsxRenderer());

app.get("/", ({ render }) => {
  return render(<App />);
});

export default app;
