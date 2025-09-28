# Changelog
All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
# Releases 

## 2.0.0 (2025-09-28)
### BREAKING CHANGES
- **Publisher Validation**: `prevData` is now **required** for `updated` events
  - Publishing `updated` events without `prevData` will throw an error
  - Event type validation now checks that event type is one of: `created`, `read`, `updated`, `deleted`
- **EventBuilder API**: Updated `buildPayload` method signature
  - Parameter order changed: `buildPayload(entityType, data, prevData?, version?)`
  - `version` parameter now has default value of `'v1'`

### Added
- **Change Detection**: Added `prev_data` field to event payload structure
- **Enhanced Documentation**: Updated README and examples to reflect mandatory `prevData` requirement
- **Comprehensive Testing**: Added complete test coverage for new validation rules

### Changed
- **Validation Messages**: Updated JSDoc comments to reflect required `prevData` for non-created events
- **Error Handling**: Stricter validation with clear error messages for missing `prevData`

## 1.0.4 (2025-09-21)
### Fixed
- **Exports**: Added missing `NonRetryableError` export to main package index, making it importable as documented in README examples

## 1.0.3 (2025-08-05)
### Fixed
- **Environment Control**: Fixed `DISABLE_EVENT_BUS` environment variable to properly disable RabbitMQ module import in SubscriberModule, completing the event bus disable functionality

## 1.0.2 (2025-07-17)
### Changed
- **Documentation**: Updated README to properly document PublisherModule and SubscriberModule instead of EventBusModule, reflecting the actual modular architecture and providing clear examples for different usage scenarios (publish-only, subscribe-only, or both)

## 1.0.1 (2025-07-16)
### Fixed
- **Legacy Subscription**: Fixed `@LegacySubscribeTo` decorator to use the correct legacy exchange (`eventBusConfig.legacy.exchange`) instead of the standard exchange (`eventBusConfig.exchange`)

## 1.0.0 (2025-07-14)
### Initial Stable Release

## 0.2.0-beta.7 (2025-07-14)
### Changed
- **Configuration**: Removed default values for several configuration options
- **Documentation**: Added further reading section to README with link to Event Bus Architecture documentation

## 0.2.0-beta.6 (2025-07-14)
### Changed
- **Module Structure**: Removed EventBusModule and replaced with separate SubscriberModule and PublisherModule

## 0.2.0-beta.5 (2025-01-15)
### Improved
- **Test Environment**: RabbitMQ module is now completely excluded from imports in test environments (`NODE_ENV=test`) instead of just being disabled, improving test performance and preventing unnecessary connection attempts

## 0.2.0-beta.4 (2025-07-13)
### Fixed
- **Dependency Injection**: Fixed `EventBusMetricsService` dependency resolution issue in external modules by properly exporting required services from `SubscriberModule`

## 0.2.0-beta.3 (2025-07-13)
### Changed
- Updated peer dependencies to allow both v3 and v4 of `@vcita/oauth-client-nestjs`

## 0.2.0-beta.2 (2025-07-13)
### Fixed
- **TypeScript Declarations**: Fixed import paths in generated declaration files from absolute `src/` paths to relative paths, resolving `Cannot find module 'src/interfaces/event.interface'` errors when consuming the package

## 0.2.0-beta.1 (2025-07-13)
### Added
- **Subscriber Module**: Complete event subscription system with automatic retry and error handling
- **Publisher Module**: Reorganized publishing functionality into dedicated module
- **Metrics Integration**: Built-in Prometheus metrics for event processing monitoring
- **Advanced Retry Logic**: Configurable retry policies with dead letter queues
- **Event Processing Interceptor**: Automatic event processing with metrics tracking
- **Queue Management**: Automatic queue, exchange, and retry infrastructure setup
- **Configuration Support**: Comprehensive configuration options for both publisher and subscriber
- **Legacy Event Support**: Backward compatibility for non-structured events
- **Wildcard Subscriptions**: Support for wildcard patterns in domain/entity/action filters
- **Error Handling**: `NonRetryableError` class for preventing retries on validation errors
- `@SubscribeTo` decorator for modern event subscription with domain/entity/action structure
- `@LegacySubscribeTo` decorator for legacy event subscription with routing key patterns
- Full TypeScript support with proper event payload typing
- Enhanced logging with structured event processing information
- Better test support with automatic mocking in test environments

### Changed
- **Module Configuration**: Simplified to use direct import instead of `register()` method
- **Module Structure**: Reorganized into separate Publisher and Subscriber modules
- **EventBusModule**: Now includes both publisher and subscriber functionality automatically
- **Configuration**: Enhanced configuration options for retry policies and legacy events
- **Documentation**: Complete rewrite of README with subscriber examples and configuration
- **Error Handling**: Improved error handling with retry mechanisms

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
