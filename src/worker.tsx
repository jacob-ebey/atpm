import { renderToReadableStream } from "srv-jsx";

import { App } from "./app";

export default {
  async fetch(_: Request) {
    const body = await renderToReadableStream(<App />);
    return new Response(body, {
      status: 200,
    });
  },
};
