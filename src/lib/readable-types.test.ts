import { describe, it, expect } from "vitest";
import { canExtractText, isTextual } from "./readable-types";

describe("isTextual", () => {
  it("accepts anything under text/", () => {
    expect(isTextual("text/plain")).toBe(true);
    expect(isTextual("text/csv")).toBe(true);
  });

  it("accepts the application types that are really text", () => {
    expect(isTextual("application/json")).toBe(true);
    expect(isTextual("application/xml")).toBe(true);
    expect(isTextual("application/x-yaml")).toBe(true);
  });

  it("ignores a charset parameter and casing", () => {
    expect(isTextual("TEXT/PLAIN; charset=UTF-8")).toBe(true);
    expect(isTextual("application/json;charset=utf-8")).toBe(true);
  });

  it("rejects binary formats", () => {
    expect(isTextual("application/zip")).toBe(false);
    expect(isTextual("image/png")).toBe(false);
    expect(isTextual("application/pdf")).toBe(false);
  });
});

describe("canExtractText", () => {
  it("includes PDFs, which isTextual alone does not", () => {
    expect(canExtractText("application/pdf")).toBe(true);
    expect(isTextual("application/pdf")).toBe(false);
  });

  it("includes everything textual", () => {
    expect(canExtractText("text/markdown")).toBe(true);
    expect(canExtractText("application/json")).toBe(true);
  });

  it("excludes what the model cannot read", () => {
    // The gate on the Ask box: offering it here would only ever apologise.
    expect(canExtractText("image/png")).toBe(false);
    expect(canExtractText("application/zip")).toBe(false);
    expect(canExtractText("application/octet-stream")).toBe(false);
  });

  it("copes with a missing content type", () => {
    expect(canExtractText("")).toBe(false);
  });
});
