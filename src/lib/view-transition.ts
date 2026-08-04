export async function transition(cb: () => void | Promise<void>) {
  await (typeof document.startViewTransition === "function"
    ? document.startViewTransition(cb).finished.catch()
    : cb());
}
