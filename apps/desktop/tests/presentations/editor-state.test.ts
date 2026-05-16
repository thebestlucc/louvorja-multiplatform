import { test } from "node:test";
import { strict as assert } from "node:assert";

import { resolvePresentationEditorState } from "../../src/routes/presentations/-editor-state";

test("returns invalid-id for non-positive or non-integer IDs", () => {
  const fromStringRoute = resolvePresentationEditorState({
    presentationId: Number.NaN,
    isInitialLoading: false,
    isPresentationError: false,
    presentationError: null,
    hasPresentation: false,
  });
  assert.equal(fromStringRoute, "invalid-id");

  const zeroId = resolvePresentationEditorState({
    presentationId: 0,
    isInitialLoading: false,
    isPresentationError: false,
    presentationError: null,
    hasPresentation: false,
  });
  assert.equal(zeroId, "invalid-id");
});

test("returns loading while initial presentation query is pending", () => {
  const state = resolvePresentationEditorState({
    presentationId: 12,
    isInitialLoading: true,
    isPresentationError: false,
    presentationError: null,
    hasPresentation: false,
  });
  assert.equal(state, "loading");
});

test("returns not-found for not found errors", () => {
  const state = resolvePresentationEditorState({
    presentationId: 12,
    isInitialLoading: false,
    isPresentationError: true,
    presentationError: new Error("Presentation not found"),
    hasPresentation: false,
  });
  assert.equal(state, "not-found");
});

test("returns error for generic backend failures", () => {
  const state = resolvePresentationEditorState({
    presentationId: 12,
    isInitialLoading: false,
    isPresentationError: true,
    presentationError: new Error("connection timeout"),
    hasPresentation: false,
  });
  assert.equal(state, "error");
});

test("returns not-found when query completes without data", () => {
  const state = resolvePresentationEditorState({
    presentationId: 12,
    isInitialLoading: false,
    isPresentationError: false,
    presentationError: null,
    hasPresentation: false,
  });
  assert.equal(state, "not-found");
});

test("returns success when presentation data exists and no errors occurred", () => {
  const state = resolvePresentationEditorState({
    presentationId: 12,
    isInitialLoading: false,
    isPresentationError: false,
    presentationError: null,
    hasPresentation: true,
  });
  assert.equal(state, "success");
});
