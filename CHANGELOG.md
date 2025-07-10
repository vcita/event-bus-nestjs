# Changelog
All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
# Unreleased

## 0.2.0-beta.1 (2025-01-XX)
### Added
- **Subscriber Module**: Complete event subscription system with automatic retry and error handling
- `@SubscribeTo` decorator for modern event subscription with domain/entity/action structure
- `@LegacySubscribeTo` decorator for legacy event subscription with routing key patterns
- **Publisher Module**: Reorganized publishing functionality into dedicated module
- **Metrics Integration**: Built-in Prometheus metrics for event processing monitoring
- **Advanced Retry Logic**: Configurable retry policies with dead letter queues
- **Error Handling**: `NonRetryableError` class for preventing retries on validation errors
- **Event Processing Interceptor**: Automatic event processing with metrics tracking
- **Queue Management**: Automatic queue, exchange, and retry infrastructure setup
- **Configuration Support**: Comprehensive configuration options for both publisher and subscriber
- **Legacy Event Support**: Backward compatibility for non-structured events
- **Wildcard Subscriptions**: Support for wildcard patterns in domain/entity/action filters

### Changed
- **Module Structure**: Reorganized into separate Publisher and Subscriber modules
- **EventBusModule**: Now includes both publisher and subscriber functionality automatically
- **Configuration**: Enhanced configuration options for retry policies and legacy events
- **Documentation**: Complete rewrite of README with subscriber examples and configuration

### Enhanced
- **Type Safety**: Full TypeScript support with proper event payload typing
- **Error Handling**: Improved error handling with retry mechanisms
- **Logging**: Enhanced logging with structured event processing information
- **Testing**: Better test support with automatic mocking in test environments

---
# Releases 

## 0.1.0-beta.2 (2025-07-10)
### Changed
- Simplified module configuration to use direct import instead of `register()`
- Updated README to reflect the new recommended approach

## 0.1.0-beta.1 (2025-07-10) 
### Added
- Initial release of the Event Bus NestJS package
- Support for AMQP/RabbitMQ event publishing
- Dual configuration support (ConfigService and direct configuration)
- Standardized event structure with headers and payload
- Built-in distributed tracing support
- Automatic test environment mocking
- TypeScript declarations and full type safety
- Comprehensive documentation and examples
- `EventBusModule` with `register()` and `forRoot()` methods
- `EventBusPublisher` service for publishing events
- `EventBuilder` utility for manual event construction
- `TraceUtil` for distributed tracing
- Configurable routing key patterns
- Peer dependency support for NestJS and VCita packages
