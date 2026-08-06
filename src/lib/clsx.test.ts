/**
MIT License

Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { expect, test } from "vite-plus/test";

import { clsx } from "./clsx";

test("strings", () => {
  expect(clsx("")).toBe("");
  expect(clsx("foo")).toBe("foo");
  // oxlint-disable-next-line no-constant-binary-expression
  expect(clsx(true && "foo")).toBe("foo");
  // oxlint-disable-next-line no-constant-binary-expression
  expect(clsx(false && "foo")).toBe("");
});

test("strings (variadic)", () => {
  expect(clsx("")).toBe("");
  expect(clsx("foo", "bar")).toBe("foo bar");
  // oxlint-disable-next-line no-constant-binary-expression
  expect(clsx(true && "foo", false && "bar", "baz")).toBe("foo baz");
  // oxlint-disable-next-line no-constant-binary-expression
  expect(clsx(false && "foo", "bar", "baz", "")).toBe("bar baz");
});

test("emptys", () => {
  expect(clsx("")).toBe("");
  expect(clsx(undefined)).toBe("");
  expect(clsx(null)).toBe("");
  expect(clsx(0)).toBe("");
});

// lite ignores all non-strings
test("non-strings", () => {
  // number
  expect(clsx(1)).toBe("");
  expect(clsx(1, 2)).toBe("");
  expect(clsx(Infinity)).toBe("");
  expect(clsx(NaN)).toBe("");
  expect(clsx(0)).toBe("");

  // objects
  expect(clsx({})).toBe("");
  expect(clsx(null)).toBe("");
  expect(clsx({ a: 1 })).toBe("");
  expect(clsx({ a: 1 }, { b: 2 })).toBe("");

  // arrays
  expect(clsx([])).toBe("");
  expect(clsx(["foo"])).toBe("");
  expect(clsx(["foo", "bar"])).toBe("");

  // functions
  expect(clsx(clsx)).toBe("");
  expect(clsx(clsx, clsx)).toBe("");
});
