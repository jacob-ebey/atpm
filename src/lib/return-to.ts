import * as v from "valibot";

export const ReturnToSchema = v.fallback(
  v.custom<string>((v) => {
    if (typeof v === "string" && v.startsWith("/") && v.at(1) !== "/") {
      const url = new URL(v, "https://validation.com/");
      return url.pathname + url.search === v;
    }
    return false;
  }),
  "/",
);
