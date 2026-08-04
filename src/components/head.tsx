import type { JSXChild } from "srv-jsx";
import type { ImportAssetsResult } from "@hiogawa/vite-plugin-fullstack/runtime";

import "../styles.css";

import serverAssets from "./head?assets=ssr";
import browserAssets from "../browser?assets=client";

const headAssets = serverAssets.merge(browserAssets);

export function Head({ assets, children }: { assets?: ImportAssetsResult; children?: JSXChild }) {
  const allAssets = assets ? assets.merge(headAssets) : headAssets;
  return (
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {children}
      <script
        innerHTML={`if (window.localStorage.getItem("themeMode") === "dark") document.documentElement.classList.add("dark");`}
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
