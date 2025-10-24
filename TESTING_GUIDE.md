# Phase 2 Testing Guide

## Quick Start

### Run All Tests
```bash
npm run test
```
**Result:** All 187 tests pass in ~3.1 seconds

### Watch Mode (Recommended for Development)
```bash
npm run test:watch
```
**Features:**
- Re-runs tests on file changes
- Fast feedback loop
- Perfect for TDD
- Press `q` to quit

### Generate Coverage Report
```bash
npm run test:coverage
```
**Output:** Coverage statistics across all test files

---

## Test File Organization

### Unit Tests (82 tests, ~50ms total)
**Location:** `src/__tests__/unit/`

| File | Tests | Purpose |
|------|-------|---------|
| `types.test.ts` | 12 | Type definitions & interfaces |
| `skills.test.ts` | 11 | Skill registry & loading |
| `orchestrator.test.ts` | 13 | Basic orchestration |
| `workflows.test.ts` | 24 | **NEW:** Workflow engine |
| `advanced-orchestrator.test.ts` | 22 | **NEW:** Advanced features |

**Run specific file:**
```bash
npm run test -- workflows.test.ts
npm run test -- advanced-orchestrator.test.ts
```

### Integration Tests (105 tests, ~2.5s total)
**Location:** `src/__tests__/integration/`

| File | Tests | Purpose |
|------|-------|---------|
| `skills.test.ts` | 21 | Skill execution |
| `api.test.ts` | 21 | API endpoints |
| `streaming.test.ts` | 28 | **NEW:** Real-time streaming |
| `workflows.test.ts` | 16 | **NEW:** Workflow execution |
| `performance.test.ts` | 19 | **NEW:** Performance & memory |

**Run specific file:**
```bash
npm run test -- streaming.test.ts
npm run test -- workflows.test.ts
npm run test -- performance.test.ts
```

---

## What Each Test File Covers

### Unit: workflows.test.ts (24 tests)
**Feature:** Workflow engine & DAG execution

**Test Categories:**
- Workflow parsing (3)
- Workflow validation (5)
- Execution order resolution (3)
- Variable templating (3)
- Next steps calculation (3)
- Workflow simulation (4)

**Run:**
```bash
npm run test -- workflows.test.ts
```

**Key Capabilities:**
- Validates YAML workflow structure
- Tests dependency resolution
- Verifies variable replacement
- Detects circular dependencies
- Simulates multi-step execution

---

### Unit: advanced-orchestrator.test.ts (22 tests)
**Feature:** Advanced orchestration with retry, caching, parallel execution

**Test Categories:**
- Skill execution with retry (6)
- Parallel skill execution (3)
- Schema generation & caching (5)
- Execution metrics (4)
- Tool calling simulation (3)
- Error recovery with backoff (1)

**Run:**
```bash
npm run test -- advanced-orchestrator.test.ts
```

**Key Capabilities:**
- Exponential backoff retry logic
- Result caching & validation
- Parallel skill execution
- Concurrent error handling
- Performance metrics tracking

---

### Integration: streaming.test.ts (28 tests)
**Feature:** Real-time streaming & SSE

**Test Categories:**
- Stream response handling (5)
- useChat hook behavior (7)
- Stream event handling (6)
- Error handling (3)
- Real-time updates (2)
- Connection management (3)

**Run:**
```bash
npm run test -- streaming.test.ts
```

**Key Capabilities:**
- SSE event ordering
- Message streaming
- Tool invocation tracking
- Connection resilience
- Timeout handling
- Error recovery

---

### Integration: workflows.test.ts (16 tests)
**Feature:** End-to-end workflow execution

**Test Categories:**
- Simple linear workflows (2)
- Context propagation (3)
- Parallel execution (1)
- Error handling (3)
- Timeouts (2)
- Execution tracking (3)
- Complex workflows (2)

**Run:**
```bash
npm run test -- workflows.test.ts --reporter=verbose
```

**Key Capabilities:**
- Multi-step sequential execution
- Step result context propagation
- Parallel independent steps
- Error handling strategies
- Timeout enforcement
- Progress callbacks

---

### Integration: performance.test.ts (19 tests)
**Feature:** Performance & memory management

**Test Categories:**
- Skill loading (3)
- Streaming latency (3)
- Concurrent execution (2)
- Memory management (3)
- Error performance (2)
- Metrics tracking (2)
- Throughput & scalability (2)

**Run:**
```bash
npm run test -- performance.test.ts
```

**Key Capabilities:**
- Latency measurement
- Throughput validation
- Memory tracking
- Scalability testing
- Resource cleanup
- Performance benchmarking

---

## Advanced Testing Commands

### Run Tests with Verbose Output
```bash
npm run test -- --reporter=verbose
```

### Run Specific Test by Name
```bash
npm run test -- -t "should execute workflow"
```

### Run Tests in Single Thread (Debugging)
```bash
npm run test -- --no-coverage --single-thread
```

### Update Snapshots
```bash
npm run test -- -u
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Watch Mode with UI
```bash
npm run test:watch
```

---

## Test Execution Flow

### Phase 1: Setup (6.2s)
```
✓ Environment initialization
✓ Mock configuration
✓ Test collection
```

### Phase 2: Execution (~3.1s)
```
1. Unit Tests (50ms)
   - types.test.ts: 12 tests ✓
   - skills.test.ts: 11 tests ✓
   - orchestrator.test.ts: 13 tests ✓
   - workflows.test.ts: 24 tests ✓
   - advanced-orchestrator.test.ts: 22 tests ✓

2. Integration Tests (2.5s)
   - skills.test.ts: 21 tests ✓
   - api.test.ts: 21 tests ✓
   - streaming.test.ts: 1.7s (28 tests) ✓
   - workflows.test.ts: 212ms (16 tests) ✓
   - performance.test.ts: 317ms (19 tests) ✓
```

### Phase 3: Reporting
```
✓ Test summary
✓ Pass/fail status
✓ Timing statistics
```

---

## Test Results Interpretation

### Success Output
```
Test Files  10 passed (10)
Tests       187 passed (187)
Duration    3.1s
```
✅ All tests passed

### Failure Output
```
FAIL  src/__tests__/unit/workflows.test.ts
Error: expected true to be false
```
❌ One or more tests failed
→ Check error details above

### Performance Warning
```
✓ Test completed (> 1s)
```
⚠️ Test is slow - may need optimization

---

## Debugging Failed Tests

### 1. Run Single Test File
```bash
npm run test -- workflows.test.ts
```

### 2. Run Tests Matching Pattern
```bash
npm run test -- -t "should execute"
```

### 3. Watch Mode with Filter
```bash
npm run test:watch -- -t "timeout"
```

### 4. Add Console Logging
```typescript
it('test name', () => {
  console.log('Debug info:', value);
  expect(value).toBe(expected);
});
```

### 5. Single Thread (Easier Debugging)
```bash
npm run test -- --single-thread
```

---

## Common Test Patterns

### Pattern 1: Unit Test
```typescript
describe('Feature', () => {
  let component;

  beforeEach(() => {
    component = new Component();
  });

  it('should do something', () => {
    const result = component.doSomething();
    expect(result).toBe(expected);
  });
});
```

### Pattern 2: Integration Test
```typescript
describe('Workflow Execution', () => {
  let engine;

  beforeEach(() => {
    engine = new WorkflowExecutionEngine();
  });

  it('should execute workflow', async () => {
    const result = await engine.executeWorkflow(workflow);
    expect(result.success).toBe(true);
  });
});
```

### Pattern 3: Performance Test
```typescript
it('should perform efficiently', async () => {
  const monitor = new PerformanceMonitor();
  const end = monitor.startMeasure('operation');
  
  // Do work
  
  const duration = end();
  expect(duration).toBeLessThan(100);
});
```

### Pattern 4: Error Handling Test
```typescript
it('should handle errors', async () => {
  await expect(operation()).rejects.toThrow('error message');
});
```

---

## Performance Targets

### Must Meet (Hard Targets)
- ✅ **Skill load:** < 10ms per skill
- ✅ **Stream start:** < 100ms
- ✅ **Error overhead:** < 50ms

### Should Meet (Soft Targets)
- ✅ **Event emission:** < 20ms average
- ✅ **Sequential ops:** > 1000/sec
- ✅ **Concurrent ops:** Scales linearly
- ✅ **Memory:** < 10MB per 100 ops

### All Targets Currently Met ✅

---

## Test Coverage Summary

### By Component
- ✅ Types: 12 tests
- ✅ Skills: 32 tests (11 + 21)
- ✅ Orchestration: 35 tests (13 + 22)
- ✅ Workflows: 40 tests (24 + 16)
- ✅ Streaming: 28 tests
- ✅ Performance: 19 tests
- ✅ API: 21 tests

### By Category
- ✅ Happy path: ~120 tests
- ✅ Error scenarios: ~30 tests
- ✅ Edge cases: ~15 tests
- ✅ Performance: ~19 tests
- ✅ Integration: ~5 tests

---

## Continuous Integration

### Local Development
```bash
npm run test:watch
```
Runs tests automatically on file save

### Before Commit
```bash
npm run test
```
Ensure all 187 tests pass

### Pre-Deployment
```bash
npm run test:coverage
```
Generate coverage report

---

## Troubleshooting

### Tests Slow to Start
```bash
# Clear cache
npm run test -- --clearCache
npm run test
```

### Flaky Tests
- Run again to verify
- Check for timing issues
- Look for shared state
- All tests should pass 100% of time

### Import Errors
```bash
# Clear node_modules and reinstall
rm -r node_modules
npm install
npm run test
```

### Memory Issues
```bash
# Run with higher memory limit
NODE_OPTIONS="--max_old_space_size=4096" npm run test
```

---

## Next Steps

### For Development
1. Run `npm run test:watch`
2. Make changes to code
3. Tests auto-run
4. Fix any failures
5. Commit when all pass

### For Phase 3
- Add E2E tests
- Add visual regression
- Add load testing
- Add security testing
- Add contract testing

---

## Support

### Get Help
1. Check test error messages
2. Review test documentation
3. Look at test patterns
4. Debug with console.log
5. Run single test to isolate

### Report Issues
- Check test output
- Include error message
- Share minimal reproduction
- Run `npm run test` before reporting

---

**Ready to test? Run: `npm run test:watch`** 🚀
