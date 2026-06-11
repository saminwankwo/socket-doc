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
    const eventNames = new Set<string>();
    const errorCodes = new Map<string, Set<string>>();
    
    for (const [evtName, evt] of Object.entries(ns.events) as [string, any][]) {
      const path = `namespaces.${nsName}.events.${evtName}`;

      // Check for duplicate event names in the same namespace
      if (eventNames.has(evtName)) {
        issues.push({
          type: 'error',
          message: `Duplicate event name '${evtName}' in namespace '${nsName}'`,
          path
        });
      }
      eventNames.add(evtName);

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

      // Check auth and roles validation
      if (evt.authRequired && (!spec.security || spec.security.length === 0)) {
        issues.push({
          type: 'warning',
          message: `Event '${evtName}' requires auth but no security schemes are defined at the API level`,
          path: `${path}.authRequired`
        });
      }

      if (evt.roles && evt.roles.length > 0) {
        for (let i = 0; i < evt.roles.length; i++) {
          const role = evt.roles[i];
          if (typeof role !== 'string' || role.trim() === '') {
            issues.push({
              type: 'error',
              message: `Role at index ${i} for event '${evtName}' is invalid (must be a non-empty string)`,
              path: `${path}.roles[${i}]`
            });
          }
        }
      }

      // Check examples
      if (evt.examples && evt.examples.length > 0) {
        for (let i = 0; i < evt.examples.length; i++) {
          const example = evt.examples[i];
          if (!example || typeof example !== 'object') {
            issues.push({
              type: 'warning',
              message: `Example ${i} for event '${evtName}' is not a valid object`,
              path: `${path}.examples[${i}]`
            });
          }
        }
      }

      // Check errors
      if (evt.errors && evt.errors.length > 0) {
        if (!errorCodes.has(evtName)) {
          errorCodes.set(evtName, new Set<string>());
        }
        const evtErrorCodes = errorCodes.get(evtName)!;

        for (let i = 0; i < evt.errors.length; i++) {
          const err = evt.errors[i];
          const errPath = `${path}.errors[${i}]`;
          
          if (!err.code) {
            issues.push({
              type: 'error',
              message: `Error at index ${i} for event '${evtName}' is missing required error code`,
              path: `${errPath}.code`
            });
          } else {
            // Check for duplicate error codes within the same event
            if (evtErrorCodes.has(String(err.code))) {
              issues.push({
                type: 'error',
                message: `Duplicate error code '${err.code}' for event '${evtName}'`,
                path: errPath
              });
            }
            evtErrorCodes.add(String(err.code));
          }
          
          if (!err.description) {
            issues.push({
              type: 'warning',
              message: `Error at index ${i} for event '${evtName}' is missing description`,
              path: `${errPath}.description`
            });
          }
        }
      }
    }

    // Check if namespace has no events
    if (Object.keys(ns.events).length === 0) {
      issues.push({
        type: 'warning',
        message: `Namespace '${nsName}' has no events defined`,
        path: `namespaces.${nsName}`
      });
    }
  }

  // Check if there are no namespaces at all
  if (Object.keys(spec.namespaces).length === 0) {
    issues.push({
      type: 'warning',
      message: 'No namespaces defined in the contract',
      path: 'namespaces'
    });
  }

  return issues;
}
