import { Contract } from "./contract.js"

/**
 * Interface for SocketDocs plugins that can hook into the lifecycle
 */
export interface SocketDocsPlugin {
  /** Name of the plugin */
  name: string
  /** Version of the plugin */
  version: string
  /** Called when the plugin is first registered with the contract */
  onSetup?: (contract: Contract) => void
  /** Called when an event is received by the server */
  onEvent?: (eventName: string, payload: any, namespace: string) => void
  /** Called when a response is sent by the server */
  onResponse?: (eventName: string, response: any, namespace: string) => void
  /** Called when an error occurs during event processing */
  onError?: (eventName: string, error: any, namespace: string) => void
  /** Called after a spec has been generated from the contract */
  onSpecGenerated?: (spec: any) => void
}

/**
 * Manages registered plugins and notifies them of lifecycle events
 */
export class PluginManager {
  private plugins: SocketDocsPlugin[] = []

  /**
   * Creates a new plugin manager
   * 
   * @param contract - The contract instance this manager is attached to
   */
  constructor(private contract: Contract) {}

  /**
   * Registers a new plugin
   * 
   * @param plugin - The plugin to register
   */
  register(plugin: SocketDocsPlugin) {
    this.plugins.push(plugin)
    if (plugin.onSetup) {
      plugin.onSetup(this.contract)
    }
  }

  /**
   * Notifies all plugins that an event has been received
   * 
   * @param eventName - Name of the event
   * @param payload - Payload of the event
   * @param namespace - Namespace the event was received on
   */
  notifyEvent(eventName: string, payload: any, namespace: string) {
    for (const plugin of this.plugins) {
      if (plugin.onEvent) {
        plugin.onEvent(eventName, payload, namespace)
      }
    }
  }

  /**
   * Notifies all plugins that a response has been sent
   * 
   * @param eventName - Name of the event that triggered the response
   * @param response - The response data
   * @param namespace - Namespace the response was sent on
   */
  notifyResponse(eventName: string, response: any, namespace: string) {
    for (const plugin of this.plugins) {
      if (plugin.onResponse) {
        plugin.onResponse(eventName, response, namespace)
      }
    }
  }

  /**
   * Notifies all plugins that an error has occurred
   * 
   * @param eventName - Name of the event where the error occurred
   * @param error - The error that occurred
   * @param namespace - Namespace the error occurred on
   */
  notifyError(eventName: string, error: any, namespace: string) {
    for (const plugin of this.plugins) {
      if (plugin.onError) {
        plugin.onError(eventName, error, namespace)
      }
    }
  }

  /**
   * Notifies all plugins that a spec has been generated
   * 
   * @param spec - The generated spec
   */
  notifySpecGenerated(spec: any) {
    for (const plugin of this.plugins) {
      if (plugin.onSpecGenerated) {
        plugin.onSpecGenerated(spec)
      }
    }
  }
}
