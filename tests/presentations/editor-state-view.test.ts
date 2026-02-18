import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isValidElement, type ReactElement, type ReactNode } from "react";

import { Button } from "../../src/components/ui/button";
import { PresentationEditorState } from "../../src/routes/presentations/-editor-state-view";

type TestElementProps = {
  children?: ReactNode;
  onClick?: () => void;
};

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<TestElementProps>) => boolean,
): ReactElement<TestElementProps> | null {
  if (node === null || node === undefined || typeof node === "boolean") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const match = findElement(item, predicate);
      if (match) return match;
    }
    return null;
  }

  if (!isValidElement<TestElementProps>(node)) {
    return null;
  }

  const element = node;
  if (predicate(element)) {
    return element;
  }

  return findElement(element.props.children, predicate);
}

function getText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => getText(child)).join("");
  }
  if (!isValidElement<TestElementProps>(node)) {
    return "";
  }
  return getText(node.props.children);
}

test("retry button calls onRetry callback when clicked", () => {
  let retries = 0;
  const element = PresentationEditorState({
    title: "Load error",
    description: "Could not load presentation",
    retryLabel: "Retry",
    backLabel: "Back",
    onRetry: () => {
      retries += 1;
    },
  });

  const retryButton = findElement(element, (candidate) => {
    if (candidate.type !== Button) {
      return false;
    }
    return getText(candidate.props.children).trim() === "Retry";
  });

  assert.ok(retryButton, "Retry button should be present");
  const onClick = retryButton.props.onClick;
  assert.equal(typeof onClick, "function");

  onClick?.();
  assert.equal(retries, 1);
});
