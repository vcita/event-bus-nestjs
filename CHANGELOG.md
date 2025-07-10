# Changelog
All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
# Unreleased

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
