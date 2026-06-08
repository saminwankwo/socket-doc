export class PluginManager {
    constructor(contract) {
        this.contract = contract;
        this.plugins = [];
    }
    register(plugin) {
        this.plugins.push(plugin);
        if (plugin.onSetup) {
            plugin.onSetup(this.contract);
        }
    }
    notifyEvent(eventName, payload, namespace) {
        for (const plugin of this.plugins) {
            if (plugin.onEvent) {
                plugin.onEvent(eventName, payload, namespace);
            }
        }
    }
    notifySpecGenerated(spec) {
        for (const plugin of this.plugins) {
            if (plugin.onSpecGenerated) {
                plugin.onSpecGenerated(spec);
            }
        }
    }
}
