export async function basecoat() {
  // @ts-expect-error - no types
  await import("basecoat-css/all");
  return window.basecoat;
}
