export interface LintIssue {
  type: 'error' | 'warning';
  message: string;
  path: string;
}

export function lintSpec(spec: any): LintIssue[] {
  const issues: LintIssue[] = [];

  // Check info
  if (!spec.info.description) {
    issues.push({
      type: 'warning',
      message: 'API description is missing',
      path: 'info.description'
    });
  }

  // Check namespaces
  for (const [nsName, ns] of Object.entries(spec.namespaces) as [string, any][]) {
    if (nsName !== 'default' && !/^[a-z0-9-]+$/.test(nsName)) {
      issues.push({
        type: 'warning',
        message: `Namespace name '${nsName}' should be lowercase and kebab-case`,
        path: `namespaces.${nsName}`
      });
    }

    // Check events
    for (const [evtName, evt] of Object.entries(ns.events) as [string, any][]) {
      const path = `namespaces.${nsName}.events.${evtName}`;

      if (!/^[a-z0-9_]+$/.test(evtName)) {
        issues.push({
          type: 'warning',
          message: `Event name '${evtName}' should be lowercase and snake_case`,
          path
        });
      }

      if (!evt.summary && !evt.description) {
        issues.push({
          type: 'warning',
          message: `Event '${evtName}' is missing both summary and description`,
          path
        });
      }

      if (!evt.payloadSchema && evt.direction !== 'server_to_client') {
        issues.push({
          type: 'warning',
          message: `Event '${evtName}' has no payload schema defined`,
          path
        });
      }
      
      if (evt.type === 'request_response' && !evt.responseSchema) {
        issues.push({
          type: 'warning',
          message: `Request-Response event '${evtName}' is missing a response schema`,
          path
        });
      }
    }
  }

  return issues;
}
