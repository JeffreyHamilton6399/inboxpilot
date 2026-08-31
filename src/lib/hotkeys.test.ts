import { describe, it, expect } from "vitest";
import { isTypingTarget, shouldHandleKey } from "./hotkeys";

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  ...mods,
});

describe("isTypingTarget", () => {
  it("recognises the fields a person types into", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
  });

  it("recognises a contenteditable region", () => {
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("does not mistake ordinary elements for fields", () => {
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });

  it("does not care about the case of the tag name", () => {
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
  });
});

describe("shouldHandleKey", () => {
  const body = { tagName: "BODY" };
  const compose = { tagName: "TEXTAREA" };

  it("lets shortcuts through outside a field", () => {
    expect(shouldHandleKey(key("e"), body)).toBe(true);
    expect(shouldHandleKey(key("j"), body)).toBe(true);
  });

  it("keeps out of the way of typing", () => {
    // The whole point: writing "See the attached deck" in a reply must not
    // archive the message, star it, or jump to the next one.
    expect(shouldHandleKey(key("e"), compose)).toBe(false);
    expect(shouldHandleKey(key("s"), compose)).toBe(false);
    expect(shouldHandleKey(key("j"), compose)).toBe(false);
    expect(shouldHandleKey(key("/"), compose)).toBe(false);
  });

  it("still lets Escape out of a field", () => {
    // A search box you cannot escape from is a trap.
    expect(shouldHandleKey(key("Escape"), compose)).toBe(true);
    expect(shouldHandleKey(key("Escape"), { tagName: "INPUT" })).toBe(true);
  });

  it("leaves modified keystrokes to the browser and the OS", () => {
    // Ctrl+E and Cmd+E are the browser's; taking them would break find,
    // reload, address bar, and every OS-level binding.
    expect(shouldHandleKey(key("e", { ctrlKey: true }), body)).toBe(false);
    expect(shouldHandleKey(key("e", { metaKey: true }), body)).toBe(false);
    expect(shouldHandleKey(key("e", { altKey: true }), body)).toBe(false);
  });

  it("does not exempt a modified Escape inside a field", () => {
    expect(shouldHandleKey(key("Escape", { metaKey: true }), compose)).toBe(false);
  });
});
