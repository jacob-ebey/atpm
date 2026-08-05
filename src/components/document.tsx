import type { ImportAssetsResult } from "@hiogawa/vite-plugin-fullstack/runtime";
import { getContext } from "hono/context-storage";
import type { JSXChild } from "srv-jsx";

import { Toast, Toaster } from "@/components/ui/toast";

import "@/styles.css";

import serverAssets from "./document?assets=ssr";
import browserAssets from "@/browser?assets=client";

const headAssets = serverAssets.merge(browserAssets);

export function Head({ assets, children }: { assets?: ImportAssetsResult; children?: JSXChild }) {
  const allAssets = assets ? assets.merge(headAssets) : headAssets;
  return (
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.svg" />
      {children}
      <script
        innerHTML={`(() => {let theme = window.localStorage.getItem("themeMode"); if (theme === "dark" || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add("dark");})();`}
      />
      {allAssets.css.map((css) => (
        <link rel="stylesheet" {...css} />
      ))}
      {allAssets.js.map((js) => (
        <link rel="modulepreload" {...js} />
      ))}
      <script async type="module" src={allAssets.entry} />
    </head>
  );
}

export function Body({ children }: { children?: JSXChild }) {
  const c = getContext();
  const url = new URL(c.req.url);
  const errors = url.searchParams.getAll("error");

  return (
    <body hx-boost:inherited="true">
      <Toaster id="toaster">
        {errors.map((error) => (
          <Toast category="error" title={error} />
        ))}
      </Toaster>
      {children}
    </body>
  );
}
