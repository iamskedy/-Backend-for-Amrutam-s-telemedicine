import client from 'prom-client';

export const registry = client.register;
client.collectDefaultMetrics({ prefix: 'amrutam_', register: registry });

export const httpRequestDuration = new client.Histogram({
  name: 'amrutam_http_request_duration_seconds',
  help: 'HTTP request duration in seconds, labeled by route/method/status',
  labelNames: ['method', 'route', 'status_code'],
  // Buckets tuned around the stated SLOs: p95 <200ms reads, <500ms writes
  buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
});

export const httpRequestsTotal = new client.Counter({
  name: 'amrutam_http_requests_total',
  help: 'Total HTTP requests, labeled by route/method/status',
  labelNames: ['method', 'route', 'status_code'],
});

export const bookingSagaOutcome = new client.Counter({
  name: 'amrutam_booking_saga_outcome_total',
  help: 'Booking saga outcomes (committed, slot_conflict, payment_failed, rolled_back)',
  labelNames: ['outcome'],
});

export const idempotencyReplayTotal = new client.Counter({
  name: 'amrutam_idempotency_replay_total',
  help: 'Count of requests short-circuited by idempotency-key replay',
  labelNames: ['route'],
});


