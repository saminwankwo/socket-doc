import 'reflect-metadata';
import { Module, DynamicModule, Global, Inject, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { SubscribeMessage } from '@nestjs/websockets';
import { Contract, createValidator } from '@socketdocs/core';


export const SOCKETDOCS_NAMESPACE = 'socketdocs:namespace';
export const SOCKETDOCS_EVENT = 'socketdocs:event';

export function Namespace(name: string): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(SOCKETDOCS_NAMESPACE, name, target);
  };
}

export interface EventOptions {
  name: string;
  direction?: 'client_to_server' | 'bidirectional';
  summary?: string;
  description?: string;
  authRequired?: boolean;
  roles?: string[];
}

export function Event(options: EventOptions): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(SOCKETDOCS_EVENT, options, descriptor.value);
    // Also mark it for NestJS WebSocketGateway if not already
    SubscribeMessage(options.name)(target, propertyKey, descriptor);
  };
}

// --- Module & Provider ---

@Global()
@Module({
  providers: [DiscoveryService, MetadataScanner],
})
export class SocketDocsModule implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject('SOCKETDOCS_CONTRACT') private readonly contract: Contract,
  ) {}

  static register(contract: Contract): DynamicModule {
    return {
      module: SocketDocsModule,
      providers: [
        {
          provide: 'SOCKETDOCS_CONTRACT',
          useValue: contract,
        },
      ],
      exports: ['SOCKETDOCS_CONTRACT'],
    };
  }

  onModuleInit() {
    this.scanAndRegister();
  }

  private scanAndRegister() {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();
    const allInstances = [...providers, ...controllers]
      .filter(wrapper => wrapper.instance)
      .map(wrapper => wrapper.instance);

    for (const instance of allInstances) {
      const prototype = Object.getPrototypeOf(instance);
      const nsName = this.reflector.get<string>(SOCKETDOCS_NAMESPACE, instance.constructor);
      
      if (nsName) {
        const ns = this.contract.namespace(nsName);
        
        this.metadataScanner.scanFromPrototype(instance, prototype, methodKey => {
          const method = instance[methodKey];
          const eventOptions = this.reflector.get<EventOptions>(SOCKETDOCS_EVENT, method);
          
          if (eventOptions) {
            // Register event in SocketDocs contract
            ns.event({
              name: eventOptions.name,
              direction: eventOptions.direction || 'client_to_server',
              summary: eventOptions.summary,
              description: eventOptions.description,
              authRequired: eventOptions.authRequired,
              roles: eventOptions.roles,
            });

            // Wrap the method for validation if needed
            // This is complex in NestJS as we'd need to intercept the message
            // Usually done via NestJS Interceptors or Guards
          }
        });
      }
    }
  }
}
