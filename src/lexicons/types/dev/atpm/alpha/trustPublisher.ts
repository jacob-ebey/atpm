import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _githubSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("dev.atpm.alpha.trustPublisher#github")),
  repository: /*#__PURE__*/ v.string(),
  username: /*#__PURE__*/ v.string(),
  workflow: /*#__PURE__*/ v.string(),
});
const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.string(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("dev.atpm.alpha.trustPublisher"),
    allowPublish: /*#__PURE__*/ v.boolean(),
    allowStage: /*#__PURE__*/ v.boolean(),
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Trust config for GitHub Actions. Other providers (e.g. gitlab, circleci) will add their own config refs alongside this one.
     */
    get github() {
      return /*#__PURE__*/ v.optional(githubSchema);
    },
  }),
);

type github$schematype = typeof _githubSchema;
type main$schematype = typeof _mainSchema;

export interface githubSchema extends github$schematype {}
export interface mainSchema extends main$schematype {}

export const githubSchema = _githubSchema as githubSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface Github extends v.InferInput<typeof githubSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "dev.atpm.alpha.trustPublisher": mainSchema;
  }
}
