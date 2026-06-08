export function Namespace(name) {
    return function (target) {
        target.__socketdocs_namespace = name;
    };
}
export function Event(name, direction = "bidirectional") {
    return function (target, key) {
        if (!target.__socketdocs_events) {
            target.__socketdocs_events = [];
        }
        target.__socketdocs_events.push({
            name,
            direction,
            method: key,
            // In a real implementation, we could extract Zod schemas from parameters
            // or use other decorators to define them.
        });
    };
}
