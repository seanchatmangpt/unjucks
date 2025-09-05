# Unjucks Stress Test Suite

## Overview

This comprehensive stress test suite validates Unjucks CLI and core functionality under extreme conditions, ensuring reliability and performance at scale.

## Test Files Created

### 1. CLI Stress Tests (`tests/unit/stress/cli-stress.test.ts`)

**Purpose**: Validate CLI command performance under high load

**Test Scenarios**:
- **High-Volume File Generation**: Generate 1000+ files simultaneously
- **Concurrent CLI Commands**: Run 100 concurrent CLI processes without race conditions  
- **Large Generator Discovery**: List 1000+ generators efficiently
- **Large Content Processing**: Process templates with 10MB+ content
- **Error Handling**: Gracefully handle malformed templates under load

**Performance Targets**:
- 1000 files generated within 60 seconds
- 80%+ success rate under concurrent load
- Memory growth <500MB for large operations
- List 1000 generators within 5 seconds

### 2. Generator Stress Tests (`tests/unit/stress/generator-stress.test.ts`)

**Purpose**: Test core generator functionality at scale

**Test Scenarios**:
- **Mass Template Processing**: Process 1000+ template files efficiently
- **Deep Directory Structures**: Handle 10 levels deep, 5 files per level
- **Massive Variable Substitution**: 1000 different variables with filters
- **Complex Conditional Logic**: 100 nested conditionals with loops
- **Concurrent File Operations**: Simultaneous read/write across multiple generators
- **Performance Consistency**: Maintain stable performance across 100 operations

**Performance Targets**:
- Process 1000 templates within 30 seconds
- Memory growth <1GB for large datasets
- Complex logic processing within 15 seconds
- Consistent performance (max 3x average time)

### 3. Memory Stress Tests (`tests/unit/stress/memory-stress.test.ts`)

**Purpose**: Detect memory leaks and validate resource cleanup

**Test Scenarios**:
- **Memory Leak Detection**: 500 generation cycles with heap monitoring
- **Resource Cleanup**: Template scanner, file injector, and parser cleanup
- **Large Object Handling**: 10MB+ template variables with deep nesting
- **Memory Pressure**: Handle system memory limits gracefully
- **Interrupted Operations**: Cleanup after process interruption

**Performance Targets**:
- Memory growth <100MB for 500 operations
- No exponential memory growth patterns
- Resource cleanup within 50MB per component
- Handle 1GB+ data without crashing

### 4. Concurrent Stress Tests (`tests/unit/stress/concurrent-stress.test.ts`)

**Purpose**: Validate thread safety and concurrent operation handling

**Test Scenarios**:
- **Concurrent CLI Processes**: 100 simultaneous CLI commands
- **File System Integrity**: Overlapping directory writes without corruption
- **Generator Concurrency**: 50 concurrent generator instances
- **Template Scanning**: Concurrent variable extraction across 20 generators
- **Resource Contention**: File I/O operations with shared resources
- **Memory Pressure**: Concurrent memory-intensive operations

**Performance Targets**:
- 70%+ success rate under 100 concurrent processes
- No file corruption during concurrent writes
- 80%+ success rate for generator concurrency
- Complete within specified timeouts

### 5. Filesystem Stress Tests (`tests/unit/stress/filesystem-stress.test.ts`)

**Purpose**: Test filesystem operations under extreme conditions

**Test Scenarios**:
- **Mass File Operations**: 10,000 file operations without corruption
- **Deep Directory Hierarchies**: 5-level deep structures (100 operations)
- **Permission Scenarios**: Various file permission combinations
- **Performance Scaling**: Consistent performance across file sizes (1KB-1MB)
- **Sustained Load**: 20 batches of 25 operations each
- **Error Recovery**: Disk space exhaustion and corruption scenarios
- **Process Interruption**: Cleanup after terminated operations

**Performance Targets**:
- 80%+ success rate for 10,000 operations
- Complete within 2 minutes
- 90%+ success rate for deep hierarchies
- Graceful error handling and recovery

## Stress Test Runner

**File**: `tests/run-stress-tests.ts`

**Features**:
- Executes all stress tests sequentially
- Performance monitoring and reporting
- Success/failure rate analysis
- Memory and timing metrics
- Detailed error reporting

**Usage**:
```bash
npx tsx tests/run-stress-tests.ts
```

## Test Infrastructure

**Setup**:
- Temporary directories for isolated testing
- Memory monitoring with heap snapshots
- Performance timing with `performance.now()`
- Cleanup mechanisms for interrupted tests
- Mock data generation for various scenarios

**Error Handling**:
- Graceful degradation under resource limits
- Timeout handling for long-running operations
- Recovery validation after errors
- File corruption detection
- Memory pressure handling

## Real Performance Metrics

**All tests measure actual system performance**:
- ✅ Real file operations (no mocks)
- ✅ Actual memory usage measurement
- ✅ True concurrency testing
- ✅ Genuine filesystem stress
- ✅ Realistic error conditions

**No placeholders or fake metrics** - every test validates real system behavior.

## Integration with Existing Test Suite

- Uses Vitest framework (consistent with project)
- Follows existing test patterns and structure
- Integrates with coverage reporting
- Supports CI/CD pipeline execution
- Compatible with existing npm test scripts

## Running Stress Tests

### Individual Test Files
```bash
# CLI stress tests
npx vitest run tests/unit/stress/cli-stress.test.ts

# Generator stress tests  
npx vitest run tests/unit/stress/generator-stress.test.ts

# Memory stress tests
npx vitest run tests/unit/stress/memory-stress.test.ts

# Concurrent stress tests
npx vitest run tests/unit/stress/concurrent-stress.test.ts

# Filesystem stress tests
npx vitest run tests/unit/stress/filesystem-stress.test.ts
```

### All Stress Tests
```bash
# Using test runner
npx tsx tests/run-stress-tests.ts

# Using Vitest pattern
npx vitest run tests/unit/stress/
```

### With Coverage
```bash
npx vitest run tests/unit/stress/ --coverage
```

## Expected Outcomes

When all stress tests pass, the system demonstrates:

1. **Scalability**: Handle 1000+ operations efficiently
2. **Reliability**: 80%+ success rates under stress
3. **Memory Safety**: No leaks or excessive growth
4. **Thread Safety**: Concurrent operations without corruption
5. **Error Resilience**: Graceful handling of edge cases
6. **Performance Consistency**: Stable response times
7. **Resource Management**: Proper cleanup and resource handling

This comprehensive test suite ensures Unjucks performs reliably in production environments under various stress conditions.