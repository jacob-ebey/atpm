import { Marked } from "marked";
import markedShiki from "marked-shiki";
import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import markdown from "shiki/langs/markdown.mjs";
import toml from "shiki/langs/toml.mjs";
import typescript from "shiki/langs/typescript.mjs";
import tsx from "shiki/langs/tsx.mjs";
import yaml from "shiki/langs/yaml.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import type { HighlighterCore } from "shiki/core";

const themes = { light: "github-light", dark: "github-dark" };

let highlighter: HighlighterCore | undefined;

// cloudflare workers cannot initialize wasm from binary data, so the
// oniguruma wasm module is imported as an asset and passed to loadWasm.
// https://shiki.style/guide/install#cloudflare-workers
export async function getHighlighter() {
  highlighter ??= await (async () => {
    const [{ createHighlighterCore }, { createOnigurumaEngine, loadWasm }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/oniguruma"),
    ]);

    const wasm = import("shiki/onig.wasm") as Promise<{
      default: (
        importObject: Record<string, Record<string, WebAssembly.ImportValue>> | undefined,
      ) => Promise<
        | WebAssembly.WebAssemblyInstantiatedSource
        | WebAssembly.Instance
        | WebAssembly.Instance["exports"]
      >;
    }>;
    await loadWasm(wasm);

    return createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: [bash, css, diff, html, javascript, json, jsx, markdown, toml, typescript, tsx, yaml],
      engine: await createOnigurumaEngine(),
    });
  })();

  return highlighter;
}

export const docsMarked = new Marked().use(
  markedShiki({
    async highlight(code, lang) {
      const hl = await getHighlighter();
      try {
        return hl.codeToHtml(code, { lang, themes });
      } catch {
        return hl.codeToHtml(code, { lang: "text", themes });
      }
    },
  }),
);
