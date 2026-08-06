import "basecoat-css/all";
import "htmx.org";
import "htmx.org/dist/ext/hx-browser-indicator";

function areProcessingDirectivesSupported() {
  const el = document.createElement("div");
  el.innerHTML = "<?marker name=a><?start name=b><?end>";
  return Array.from(el.childNodes).every((n) => n.nodeType === 7);
}

function areInvokerCommandsSupported() {
  return (
    typeof HTMLButtonElement !== "undefined" &&
    "command" in HTMLButtonElement.prototype &&
    "source" in (((window.CommandEvent || {}) as any).prototype || {})
  );
}

function installPolyfills() {
  if (!areProcessingDirectivesSupported()) {
    // @ts-expect-error - no types
    void import("template-for-polyfill").catch(console.error.bind(console));
  }

  if (!areInvokerCommandsSupported()) {
    void import("invokers-polyfill").catch(console.error.bind(console));
  }
}

installPolyfills();
