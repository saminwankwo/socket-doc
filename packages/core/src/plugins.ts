import { Contract } from "./contract"

export interface SocketDocsPlugin {
  name: string
  version: string
  onSetup?: (contract: Contract) => void
  onEvent?: (eventName: string, payload: any, namespace: string) => void
  onSpecGenerated?: (spec: any) => void
}

export class PluginManager {
  private plugins: SocketDocsPlugin[] = []

  constructor(private contract: Contract) {}

  register(plugin: SocketDocsPlugin) {
    this.plugins.push(plugin)
    if (plugin.onSetup) {
      plugin.onSetup(this.contract)
    }
  }

  notifyEvent(eventName: string, payload: any, namespace: string) {
    for (const plugin of this.plugins) {
      if (plugin.onEvent) {
        plugin.onEvent(eventName, payload, namespace)
      }
    }
  }

  notifySpecGenerated(spec: any) {
    for (const plugin of this.plugins) {
      if (plugin.onSpecGenerated) {
        plugin.onSpecGenerated(spec)
      }
    }
  }
}
