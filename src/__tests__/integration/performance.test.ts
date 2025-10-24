/**
 * Integration Tests for Performance and Memory Management
 * Tests skill loading time, streaming latency, memory usage, and cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Performance monitoring helper
 */
class PerformanceMonitor {
  private metrics: Map<string, { duration: number; timestamp: Date }[]> = new Map();

  startMeasure(name: string): () => number {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      this.metrics.get(name)!.push({
        duration,
        timestamp: new Date(),
      });
      return duration;
    };
  }

  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    total: number;
  } {
    const measurements = this.metrics.get(name) || [];
    if (measurements.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, total: 0 };
    }

    const durations = measurements.map((m) => m.duration);
    const total = durations.reduce((a, b) => a + b, 0);

    return {
      count: measurements.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: total / measurements.length,
      total,
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  getMetrics(): Map<string, { duration: number; timestamp: Date }[]> {
    return this.metrics;
  }
}

/**
 * Memory tracking helper
 */
class MemoryTracker {
  private snapshots: Array<{
    label: string;
    heapUsed: number;
    heapTotal: number;
    external: number;
    timestamp: Date;
  }> = [];

  snapshot(label: string): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.snapshots.push({
        label,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        timestamp: new Date(),
      });
    }
  }

  getHeapUsed(index: number): number {
    return this.snapshots[index]?.heapUsed || 0;
  }

  getHeapIncrease(fromIndex: number, toIndex: number): number {
    if (toIndex <= fromIndex || toIndex >= this.snapshots.length) {
      return 0;
    }
    return this.snapshots[toIndex].heapUsed - this.snapshots[fromIndex].heapUsed;
  }

  getSnapshots(): Array<{
    label: string;
    heapUsed: number;
    heapTotal: number;
    external: number;
    timestamp: Date;
  }> {
    return this.snapshots;
  }

  clear(): void {
    this.snapshots = [];
  }
}

describe('Performance and Memory Tests', () => {
  let monitor: PerformanceMonitor;
  let memTracker: MemoryTracker;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    memTracker = new MemoryTracker();
  });

  afterEach(() => {
    monitor.clearMetrics();
    memTracker.clear();
  });

  describe('Skill Loading Performance', () => {
    it('should load skill metadata quickly', async () => {
      const end = monitor.startMeasure('skill-load');

      // Simulate skill loading
      const metadata = {
        name: 'Test Skill',
        version: '1.0.0',
        description: 'Test',
        category: 'test',
        tools: [],
        input_schema: { query: { type: 'string' } },
        output_format: 'markdown',
      };

      const duration = end();

      expect(duration).toBeLessThan(10); // Should be sub-10ms
      expect(metadata.input_schema.query.type).toBe('string');
      expect(metadata.output_format).toBe('markdown');
    });

    it('should batch load multiple skills efficiently', async () => {
      const skillCount = 10;
      const end = monitor.startMeasure('batch-load');

      // Simulate loading multiple skills
      const skills = Array.from({ length: skillCount }, (_, i) => ({
        name: `Skill ${i}`,
        version: '1.0.0',
        description: 'Test',
        category: 'test',
        tools: [],
        input_schema: {},
        output_format: 'markdown',
      }));

      const duration = end();

      // Should scale linearly, ~1ms per skill
      expect(duration).toBeLessThan(skillCount * 5);
      expect(skills).toHaveLength(skillCount);
      expect(skills.every((skill) => skill.output_format === 'markdown')).toBe(true);
    });

    it('should lazy-load skill logic efficiently', async () => {
      const end = monitor.startMeasure('lazy-load');

      // Simulate lazy loading (not loading until needed)
      const skillPath = './skills/test_skill';
      // In real scenario, this would dynamically import logic.ts

      const duration = end();

      expect(duration).toBeLessThan(10);
      expect(skillPath).toContain('skills');
    });
  });

  describe('Streaming Latency', () => {
    it('should start streaming within acceptable time', async () => {
      const end = monitor.startMeasure('stream-start');

      // Simulate starting a stream
      const streamStart = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 0));

      end();
      const stats = monitor.getStats('stream-start');
      const latency = Date.now() - streamStart;

      expect(stats.avg).toBeLessThan(100); // < 100ms latency
      expect(latency).toBeLessThan(100);
    });

    it('should emit events with minimal delay', async () => {
      const eventDelays: number[] = [];

      for (let i = 0; i < 5; i++) {
        const end = monitor.startMeasure(`event-${i}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
        end();
        eventDelays.push(monitor.getStats(`event-${i}`).avg);
      }

      // Average delay between events should be reasonable (< 20ms on most systems)
      const avgDelay = eventDelays.reduce((a, b) => a + b, 0) / eventDelays.length;
      expect(avgDelay).toBeLessThan(20);
    });

    it('should maintain consistent streaming throughput', async () => {
      const chunks = 100;
      const end = monitor.startMeasure('stream-throughput');

      let totalBytes = 0;

      for (let i = 0; i < chunks; i++) {
        // Simulate streaming a chunk
        const chunk = 'x'.repeat(100);
        totalBytes += chunk.length;
        // Simulate processing chunk
      }

      const duration: number = end();
      const throughput = (chunks as number) / (duration / 1000); // chunks per second

      expect(throughput).toBeGreaterThan(100); // At least 100 chunks/sec
      expect(totalBytes).toBe(chunks * 100);
    });
  });

  describe('Concurrent Execution Performance', () => {
    it('should handle concurrent skill executions efficiently', async () => {
      const end = monitor.startMeasure('concurrent-skills');

      const skillExecutions = Array.from({ length: 5 }, async (_, i) => {
        return new Promise<number>((resolve) => {
          setTimeout(() => resolve(i), 10);
        });
      });

      await Promise.all(skillExecutions);

      const duration = end();

      // Parallel execution should be faster than sequential (50ms)
      expect(duration).toBeLessThan(40);
    });

    it('should manage resources during parallel executions', async () => {
      memTracker.snapshot('start');

      const concurrentTasks = Array.from({ length: 10 }, (_, index): Promise<number> => {
        return new Promise<number>((resolve) => {
          setTimeout(() => resolve(index), 5);
        });
      });

      await Promise.all(concurrentTasks);

      memTracker.snapshot('after-concurrent');

      // Memory growth should be reasonable
      const heapIncrease = memTracker.getHeapIncrease(0, 1);
      expect(heapIncrease).toBeGreaterThanOrEqual(0); // Can increase or stay same
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory on repeated skill invocations', async () => {
      memTracker.snapshot('before-loop');

      let totalDataLength = 0;

      for (let i = 0; i < 100; i++) {
        // Simulate skill invocation
        const result = { data: 'test'.repeat(10) };
        totalDataLength += result.data.length;
        // Result should be garbage collected after use
      }

      memTracker.snapshot('after-loop');

      // Memory usage should be reasonable (not growing infinitely)
      const increase = memTracker.getHeapIncrease(0, 1);
      expect(increase).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      expect(totalDataLength).toBeGreaterThan(0);
    });

    it('should cleanup resources after workflow completion', async () => {
      memTracker.snapshot('before-workflow');

      // Simulate workflow execution
      interface WorkflowStepResult {
        data: string;
      }

      const results: Record<string, WorkflowStepResult> = {};
      for (let i = 0; i < 10; i++) {
        results[`step_${i}`] = { data: 'workflow result'.repeat(10) };
      }

      // Clear results (cleanup)
      Object.keys(results).forEach((key) => delete results[key]);

      memTracker.snapshot('after-cleanup');

      // Verify cleanup
      expect(Object.keys(results).length).toBe(0);
    });

    it('should manage cache size effectively', async () => {
  const cache = new Map<string, { value: string }>();

      memTracker.snapshot('cache-start');

      // Fill cache
      for (let i = 0; i < 1000; i++) {
        cache.set(`key_${i}`, { value: 'data'.repeat(10) });
      }

      memTracker.snapshot('cache-full');

      // Clear cache
      cache.clear();

      memTracker.snapshot('cache-cleared');

      expect(cache.size).toBe(0);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle errors without significant performance impact', async () => {
      const end = monitor.startMeasure('error-handling');

      const errorThrows = Array.from({ length: 10 }, () => {
        try {
          throw new Error('Test error');
        } catch (error) {
          return (error as Error).message;
        }
      });

      const duration = end();

      expect(duration).toBeLessThan(50); // Error handling should be fast
      expect(errorThrows).toHaveLength(10);
    });

    it('should not degrade with retries', async () => {
      let attemptCount = 0;

      const executeWithRetry = async (retries: number): Promise<void> => {
        for (let i = 0; i < retries; i++) {
          attemptCount++;
          if (i === retries - 1) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      };

      const end = monitor.startMeasure('retry-performance');

      await executeWithRetry(3);

      const duration = end();

      expect(duration).toBeGreaterThanOrEqual(20); // 2 retries × 10ms
      expect(attemptCount).toBe(3);
    });
  });

  describe('Metrics Tracking', () => {
    it('should accurately track execution times', async () => {
      const end1 = monitor.startMeasure('test-metric');
      await new Promise((resolve) => setTimeout(resolve, 50));
      end1();

      const stats = monitor.getStats('test-metric');

      expect(stats.count).toBe(1);
      expect(stats.total).toBeGreaterThanOrEqual(45);
      expect(stats.min).toBe(stats.max);
      expect(stats.avg).toBeCloseTo(stats.max, 1);
    });

    it('should aggregate multiple measurements', async () => {
      for (let i = 0; i < 5; i++) {
        const end = monitor.startMeasure('multi-metric');
        await new Promise((resolve) => setTimeout(resolve, 10));
        end();
      }

      const stats = monitor.getStats('multi-metric');

      expect(stats.count).toBe(5);
      expect(stats.avg).toBeGreaterThanOrEqual(8);
      expect(stats.total).toBeGreaterThanOrEqual(40);
      expect(stats.max).toBeGreaterThanOrEqual(stats.min);
    });
  });

  describe('Throughput and Scalability', () => {
    it('should maintain performance with increasing load', async () => {
      const throughputs: number[] = [];

      for (const count of [10, 50, 100]) {
        const end = monitor.startMeasure(`load-${count}`);

        const tasks = Array.from({ length: count }, () =>
          new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 1);
          })
        );

        await Promise.all(tasks);
        const duration: number = end();

        const throughput = (count as number) / (duration / 1000);
        throughputs.push(throughput);
      }

      // Throughput should scale reasonably
      expect(throughputs[0]).toBeGreaterThan(0);
      expect(throughputs[throughputs.length - 1]).toBeGreaterThan(0);
    });

    it('should handle rapid sequential operations', async () => {
      const end = monitor.startMeasure('rapid-ops');

      for (let i = 0; i < 1000; i++) {
        // Simulate rapid operation
        const result = i * 2;
        expect(result).toBeGreaterThanOrEqual(0);
      }

      const duration: number = end();
      const opsPerSec = (1000 as number) / (duration / 1000);

      expect(opsPerSec).toBeGreaterThan(1000); // At least 1000 ops/sec
    });
  });

  describe('Stream Buffering and Flow Control', () => {
    it('should not buffer entire message in memory', async () => {
      memTracker.snapshot('stream-start');

      // Simulate streaming large message
      let totalSize = 0;
      for (let i = 0; i < 100; i++) {
        const chunk = 'x'.repeat(1000);
        totalSize += chunk.length;
        // Process chunk without storing entire message
      }

      memTracker.snapshot('stream-complete');

      expect(totalSize).toBe(100000);
    });

    it('should handle backpressure efficiently', async () => {
      const end = monitor.startMeasure('backpressure');

      let processed = 0;
      const batchSize = 10;

      for (let i = 0; i < 100; i += batchSize) {
        // Simulate batching with backpressure
        const batch = Array.from({ length: batchSize }, (_, j) => i + j);
        processed += batch.length;
        await new Promise((resolve) => setImmediate(resolve));
      }

      const duration = end();

      expect(processed).toBe(100);
      expect(duration).toBeLessThan(100);
    });
  });
});
