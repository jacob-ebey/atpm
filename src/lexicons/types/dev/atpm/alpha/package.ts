import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.string(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("dev.atpm.alpha.package"),
    createdAt: /*#__PURE__*/ v.datetimeString(),
    tags: /*#__PURE__*/ v.unknown(),
    /**
     * @minLength 1
     */
    type: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [/*#__PURE__*/ v.stringLength(1)]),
    get versions() {
      return /*#__PURE__*/ v.array(packageSchema);
    },
  }),
);
const _packageSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("dev.atpm.alpha.package#package")),
  blob: /*#__PURE__*/ v.blob(),
  createdAt: /*#__PURE__*/ v.datetimeString(),
  meta: /*#__PURE__*/ v.unknown(),
  version: /*#__PURE__*/ v.string(),
});

type main$schematype = typeof _mainSchema;
type package$schematype = typeof _packageSchema;

export interface mainSchema extends main$schematype {}
export interface packageSchema extends package$schematype {}

export const mainSchema = _mainSchema as mainSchema;
export const packageSchema = _packageSchema as packageSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
export interface Package extends v.InferInput<typeof packageSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "dev.atpm.alpha.package": mainSchema;
  }
}
