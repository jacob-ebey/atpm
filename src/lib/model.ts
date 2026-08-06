import type { Client } from "@atcute/client";
import * as l from "@atcute/lexicons";
import * as lv from "@atcute/lexicons/validations";
import type { OAuthSession } from "@atcute/oauth-node-client";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { Context } from "hono";
import { getContext } from "hono/context-storage";
import * as v from "valibot";

import { invariant } from "@/lib/invariant";
import { ComAtprotoRepoCreateRecord } from "@atcute/atproto";

export type IssuesFor<A> = A extends (...args: any[]) => infer R
  ? Awaited<R> extends Result<infer S, any>
    ? v.FlatErrors<S>
    : never
  : never;

export type Result<S extends v.ObjectSchema<any, any>, R> =
  | {
      success: false;
      issues: v.FlatErrors<S>;
      result?: undefined;
    }
  | {
      success: true;
      issues?: undefined;
      result: R;
    };

export function defineCreateRecord<
  S extends v.ObjectSchema<any, any>,
  L extends lv.RecordSchema<any, any>,
  R = undefined,
>(
  schema: S,
  lexicon: L,
  createRecord: (input: v.InferOutput<S>) => lv.InferInput<L>,
  action: (
    args: {
      c: Context<Env>;
      db: DrizzleD1Database;
      client: Client;
      session: OAuthSession;
    },
    created: {
      cid: string;
      record: lv.InferInput<L>;
      uri: string;
    },
    input: v.InferOutput<S>,
  ) => R | Promise<R>,
) {
  return async (input: v.InferInput<S>): Promise<Result<S, R>> => {
    const c = getContext<Env>();
    const atcute = c.get("atcute");
    const db = c.get("db");
    invariant(atcute.client, "no client");
    invariant(atcute.session, "no session");

    const parsedInput = v.safeParse(schema, input);
    if (!parsedInput.success) {
      return {
        success: false,
        issues: v.flatten(parsedInput.issues),
      };
    }

    const record = createRecord(parsedInput.output);
    const parsedRecord = l.safeParse(lexicon, record);
    if (!parsedRecord.ok) {
      return {
        success: false,
        issues: flatten(parsedRecord.issues),
      };
    }

    const created = await atcute.client.call(ComAtprotoRepoCreateRecord, {
      input: {
        repo: atcute.session.did,
        collection: parsedRecord.value.$type,
        record: parsedRecord.value,
      },
    });
    invariant(created.ok, "failed to create record");

    return {
      success: true,
      result: await action(
        { c, client: atcute.client, db, session: atcute.session },
        {
          cid: created.data.cid,
          record: parsedRecord.value,
          uri: created.data.uri,
        },
        parsedInput.output,
      ),
    };
  };
}

export function defineCreate<S extends v.ObjectSchema<any, any>, R>(
  schema: S,
  action: (
    args: {
      c: Context<Env>;
      db: DrizzleD1Database;
      client: Client;
      session: OAuthSession;
    },
    input: v.InferOutput<S>,
  ) => R | Promise<R>,
) {
  return async (input: v.InferInput<S>): Promise<Result<S, R>> => {
    const c = getContext<Env>();
    const atcute = c.get("atcute");
    const db = c.get("db");
    invariant(atcute.client, "no client");
    invariant(atcute.session, "no session");

    const parsed = await schema["~standard"].validate(input);
    if (parsed.issues) {
      return {
        success: false,
        issues: flatten(parsed.issues),
      };
    }

    return {
      success: true,
      result: await action({ c, client: atcute.client, db, session: atcute.session }, parsed.value),
    };
  };
}

type Issue =
  | {
      readonly message: string;
      readonly code?: string;
      readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
    }
  | {
      readonly message?: string;
      readonly code: string;
      readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
    };

type PathSegment = {
  readonly key: PropertyKey;
};

function flatten<S extends v.ObjectSchema<any, any>>(issues: readonly Issue[]): v.FlatErrors<S> {
  const errors: DeepWriteable<v.FlatErrors<any>> = {};
  for (const issue of issues) {
    if (!issue.path) {
      if (!errors.root) errors.root = [(issue.message ?? issue.code) as string];
      else errors.root.push((issue.message ?? issue.code) as string);
    } else {
      addError((errors.nested ??= {}), issue.path, (issue.message ?? issue.code) as string);
    }
  }
  return errors as v.FlatErrors<S>;
}

function addError(
  obj: Record<any, any>,
  _keys: readonly (PropertyKey | PathSegment)[],
  value: string,
) {
  const keys = Array.from(_keys);
  const lastKey: any = Array.from(keys).pop();

  const target = keys.reduce((acc, _key) => {
    const key: any = typeof _key === "object" ? _key.key : _key;
    if (!acc[key]) acc[key] = {};
    return acc[key];
  }, obj);

  if (target[lastKey]) target[lastKey].push(value);
  else target[lastKey] = [value];
  return obj;
}

type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };
