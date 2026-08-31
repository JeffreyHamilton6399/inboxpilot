import { describe, it, expect } from "vitest";
import { labelsFor } from "./gmail";

describe("labelsFor", () => {
  it("changes nothing when asked for nothing", () => {
    expect(labelsFor({})).toEqual({ addLabelIds: [], removeLabelIds: [] });
  });

  it("stars by adding STARRED and unstars by removing it", () => {
    expect(labelsFor({ starred: true }).addLabelIds).toEqual(["STARRED"]);
    expect(labelsFor({ starred: false }).removeLabelIds).toEqual(["STARRED"]);
  });

  it("marks read by removing UNREAD", () => {
    // The one that reads backwards in the other direction: "read" is the
    // absence of the label, so marking read is a removal.
    expect(labelsFor({ unread: false })).toEqual({
      addLabelIds: [],
      removeLabelIds: ["UNREAD"],
    });
    expect(labelsFor({ unread: true })).toEqual({
      addLabelIds: ["UNREAD"],
      removeLabelIds: [],
    });
  });

  it("archives by removing INBOX, not by adding anything", () => {
    expect(labelsFor({ archived: true })).toEqual({
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    });
  });

  it("moves back to the inbox by adding INBOX", () => {
    expect(labelsFor({ archived: false })).toEqual({
      addLabelIds: ["INBOX"],
      removeLabelIds: [],
    });
  });

  it("distinguishes false from absent", () => {
    // `starred: false` means unstar; leaving it out means leave it alone.
    expect(labelsFor({ starred: false, unread: undefined })).toEqual({
      addLabelIds: [],
      removeLabelIds: ["STARRED"],
    });
  });

  it("combines several changes into one call", () => {
    const { addLabelIds, removeLabelIds } = labelsFor({
      starred: true,
      unread: false,
      archived: true,
    });
    expect(addLabelIds).toEqual(["STARRED"]);
    expect(removeLabelIds).toEqual(["UNREAD", "INBOX"]);
  });
});
