import { DurableObject } from "cloudflare:workers";
import * as v from "valibot";

const ProfileSchema = v.object({
  did: v.pipe(v.string(), v.regex(/^did:[a-z]+:[a-zA-Z0-9]+$/)),
  handle: v.pipe(v.string(), v.domain()),
  displayName: v.pipe(v.string(), v.minLength(1)),
});

type ProfileData = v.InferOutput<typeof ProfileSchema>;

export class Profile extends DurableObject {
  #profile: ProfileData | undefined;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.#profile = await ctx.storage.get("profile");
    });
  }

  get() {
    return this.#profile;
  }

  async set(profile: ProfileData) {
    const parsed = v.safeParse(ProfileSchema, profile);
    if (!parsed.success) return v.flatten(parsed.issues);
    this.#profile = parsed.output;
    await this.ctx.storage.put("profile", parsed.output);
    return undefined;
  }
}
