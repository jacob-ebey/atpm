import type { Context, MiddlewareHandler } from "hono";
import { type Component, Fragment, type JSXChild, renderToReadableStream } from "srv-jsx";

declare module "hono" {
  interface ContextRenderer {
    (children: JSXChild): Response | Promise<Response>;
  }
}

interface RendererOptions {
  prerender?: boolean;
}

interface ComponentProps {
  c: Context;
  children?: JSXChild;
  Layout: Component<{ children?: JSXChild }>;
}

export const srvJsxRenderer =
  (component?: Component<{ children?: JSXChild }>, options?: RendererOptions): MiddlewareHandler =>
  (c, next) => {
    const Layout = (c.getLayout() ?? Fragment) as unknown as Component<{
      children?: JSXChild;
    }>;
    if (component) {
      c.setLayout((props: any) => component({ ...props, Layout, c }));
    }
    c.setRenderer(createRenderer(c, Layout, component, options));
    return next();
  };

const createRenderer =
  (
    c: Context,
    Layout: Component<{ children?: JSXChild }>,
    component?: Component<ComponentProps>,
    options?: RendererOptions,
  ) =>
  async (children: JSXChild) => {
    const node = (component ? await component({ children, Layout, c }) : children) as JSXChild;

    const body = await renderToReadableStream(node, {
      prerender: options?.prerender,
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  };
