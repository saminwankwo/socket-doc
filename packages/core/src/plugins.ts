import { Contract } from "./contract.js"

export interface SocketDocsPlugin {
  name: string
  version: string
  onSetup?: (contract: Contract) => void
  onEvent?: (eventName: string, payload: any, namespace: string) => void
  onResponse?: (eventName: string, response: any, namespace: string) => void
  onError?: (eventName: string, error: any, namespace: string) => void
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

  notifyResponse(eventName: string, response: any, namespace: string) {
    for (const plugin of this.plugins) {
      if (plugin.onResponse) {
        plugin.onResponse(eventName, response, namespace)
      }
    }
  }

  notifyError(eventName: string, error: any, namespace: string) {
    for (const plugin of this.plugins) {
      if (plugin.onError) {
        plugin.onError(eventName, error, namespace)
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
