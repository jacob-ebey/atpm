import "./styles.css";

import appAssets from "./app.tsx?assets=ssr";
import browserAssets from "./browser?assets=client";

const assets = appAssets.merge(browserAssets);

export function App() {
  return (
    <html lang="en" class="dark">
      <head>
        <title>OSCMS</title>
        {assets.css.map((css) => (
          <link rel="stylesheet" {...css} />
        ))}
        {assets.js.map((js) => (
          <link rel="modulepreload" {...js} />
        ))}
        <script async type="module" src={assets.entry} />
      </head>
      <body>
        <div class="min-h-screen flex flex-col">
          <header class="">Header</header>

          <div class="flex-1 flex flex-col sm:flex-row">
            <main class="flex-1">Content here</main>

            <nav class="order-first sm:w-32">Sidebar</nav>

            <aside class="sm:w-32">Right Sidebar</aside>
          </div>

          <footer class="">Footer</footer>
        </div>
      </body>
    </html>
  );
}
