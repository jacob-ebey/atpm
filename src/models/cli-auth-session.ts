import { DurableObject } from "cloudflare:workers";

type State = "pending" | "timed-out" | "done";

export class CliAuthSession extends DurableObject {
  #did: string | undefined;
  #secret: string | undefined;
  #state: State | undefined;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    void this.ctx.blockConcurrencyWhile(async () => {
      this.#state = await this.ctx.storage.get<State>("state");
      this.#secret = await this.ctx.storage.get<State>("secret");
      this.#did = await this.ctx.storage.get<State>("did");
    });
  }

  async alarm() {
    if (this.#state === "done") {
      await this.ctx.storage.deleteAll();
    } else {
      this.#state = "timed-out";
    }
  }

  async setup() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (typeof currentAlarm !== "number") {
        await this.ctx.storage.transaction(async () => {
          await Promise.all([
            this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000),
            this.ctx.storage.put("state", "pending"),
          ]);
        });
      }
    });
  }

  async poll() {
    if (!this.#state || this.#state === "pending") {
      return {
        state: "pending",
      } as const;
    }

    if (this.#state === "timed-out") {
      return {
        state: "timed-out",
      } as const;
    }

    return {
      state: "done",
      did: this.#did,
      secret: this.#secret,
    } as const;
  }

  async finish(did: string) {
    const secret = crypto.randomUUID();

    await this.ctx.storage.transaction(async () => {
      await Promise.all([
        this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000),
        this.ctx.storage.put("secret", secret),
        this.ctx.storage.put("state", "done"),
        this.ctx.storage.put("did", did),
      ]);
    });

    this.#did = did;
    this.#secret = secret;
    this.#state = "done";

    return this.poll();
  }
}
