import type { SocketDocsSpec } from "./spec.js";

export interface LintIssue {
  type: "error" | "warning";
  message: string;
  path: string;
}

export function lintSpec(spec: SocketDocsSpec): LintIssue[] {
  const issues: LintIssue[] = [];

  if (!spec.info.description) {
    issues.push({
      type: "warning",
      message: "API description is missing",
      path: "info.description",
    });
  }

  for (const [nsName, ns] of Object.entries(spec.namespaces)) {
    const eventNames = new Set<string>();
    const errorCodes = new Map<string, Set<string>>();

    for (const [evtName, evt] of Object.entries(ns.events)) {
      const path = `namespaces.${nsName}.events.${evtName}`;

      if (eventNames.has(evtName)) {
        issues.push({
          type: "error",
          message: `Duplicate event name '${evtName}' in namespace '${nsName}'`,
          path,
        });
      }
      eventNames.add(evtName);

      if (!/^[a-z0-9_]+$/.test(evtName)) {
        issues.push({
          type: "warning",
          message: `Event name '${evtName}' should be lowercase and snake_case`,
          path,
        });
      }

      if (!evt.summary && !evt.description) {
        issues.push({
          type: "warning",
          message: `Event '${evtName}' is missing both summary and description`,
          path,
        });
      }

      if (!evt.payloadSchema && evt.direction !== "server_to_client") {
        issues.push({
          type: "warning",
          message: `Event '${evtName}' has no payload schema defined`,
          path,
        });
      }

      if (evt.kind === "request_response" && !evt.responseSchema) {
        issues.push({
          type: "warning",
          message: `Request-Response event '${evtName}' is missing a response schema`,
          path,
        });
      }

      if (evt.authRequired && (!spec.security || spec.security.length === 0)) {
        issues.push({
          type: "warning",
          message: `Event '${evtName}' requires auth but no security schemes are defined at the API level`,
          path: `${path}.authRequired`,
        });
      }

      if (evt.examples && evt.examples.length > 0) {
        for (let i = 0; i < evt.examples.length; i++) {
          const example = evt.examples[i];
          if (!example || typeof example !== "object") {
            issues.push({
              type: "warning",
              message: `Example ${i} for event '${evtName}' is not a valid object`,
              path: `${path}.examples[${i}]`,
            });
          }
        }
      }

      if (evt.errors && evt.errors.length > 0) {
        if (!errorCodes.has(evtName)) {
          errorCodes.set(evtName, new Set<string>());
        }
        const evtErrorCodes = errorCodes.get(evtName)!;

        for (let i = 0; i < evt.errors.length; i++) {
          const err = evt.errors[i];
          const errPath = `${path}.errors[${i}]`;

          if (err.code === undefined || err.code === null || err.code === "") {
            issues.push({
              type: "error",
              message: `Error at index ${i} for event '${evtName}' is missing required error code`,
              path: `${errPath}.code`,
            });
          } else {
            if (evtErrorCodes.has(String(err.code))) {
              issues.push({
                type: "error",
                message: `Duplicate error code '${err.code}' for event '${evtName}'`,
                path: errPath,
              });
            }
            evtErrorCodes.add(String(err.code));
          }

          if (!err.description) {
            issues.push({
              type: "warning",
              message: `Error at index ${i} for event '${evtName}' is missing description`,
              path: `${errPath}.description`,
            });
          }
        }
      }
    }

    if (Object.keys(ns.events).length === 0) {
      issues.push({
        type: "warning",
        message: `Namespace '${nsName}' has no events defined`,
        path: `namespaces.${nsName}`,
      });
    }
  }

  if (Object.keys(spec.namespaces).length === 0) {
    issues.push({
      type: "warning",
      message: "No namespaces defined in the spec",
      path: "namespaces",
    });
  }

  return issues;
}
