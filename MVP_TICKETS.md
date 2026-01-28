# Nexus MVP Tickets (Per Agent)

## Agent A — Routing + Model Gateway
- Ticket A1: Define routing inputs/outputs and scoring interface
  - Scope: request schema, subject labels, model metadata, scoring weights
  - Deliverable: API contract + JSON schema
  - Dependencies: none

- Ticket A2: Provider adapter abstraction
  - Scope: unified call interface, timeout/retry, streaming vs non-streaming
  - Deliverable: adapter interface + stub provider
  - Dependencies: A1

- Ticket A3: Subject detection baseline
  - Scope: heuristic classifier + fallback model classifier
  - Deliverable: subject detection service with tests
  - Dependencies: A1

- Ticket A4: Routing policy + fallback
  - Scope: weight-based routing, provider health fallback, Fast/Deep toggle support
  - Deliverable: routing engine with metrics hooks
  - Dependencies: A1, A2, A3

- Ticket A5: Telemetry hooks
  - Scope: request_id propagation, latency/error logging
  - Deliverable: tracing + metrics emitted per call
  - Dependencies: A2, A4

## Agent B — Studio Frontend
- Ticket B1: Studio shell + navigation
  - Scope: Studio route, layout, shared components skeleton
  - Deliverable: Studio page scaffold
  - Dependencies: none

- Ticket B2: Homework input panel
  - Scope: multi-part input, validation, submit state
  - Deliverable: input UI wired to API stub
  - Dependencies: B1

- Ticket B3: Answer rendering + attribution
  - Scope: structured answer, step-by-step for quant, model attribution card
  - Deliverable: answer UI with attribution
  - Dependencies: B2, A4

- Ticket B4: Fast/Deep toggle
  - Scope: toggle UI, request parameter wiring
  - Deliverable: toggle wired to API
  - Dependencies: B2, A4

## Agent C — Model Hub Frontend + Metrics
- Ticket C1: Model Hub shell + catalog
  - Scope: catalog list, model cards, strengths badges
  - Deliverable: Model Hub page scaffold
  - Dependencies: none

- Ticket C2: Comparison table
  - Scope: speed, accuracy, cost-efficiency, subject strengths
  - Deliverable: comparison UI wired to API
  - Dependencies: C1, A5

- Ticket C3: Status indicators
  - Scope: availability, latency, reliability badge states
  - Deliverable: status UI driven by telemetry
  - Dependencies: A5, C1

## Agent D — Laboratory Frontend
- Ticket D1: Laboratory shell + layout
  - Scope: parallel view layout, shared controls
  - Deliverable: Laboratory page scaffold
  - Dependencies: none

- Ticket D2: Parallel output view
  - Scope: side-by-side responses, synchronized scroll
  - Deliverable: parallel output UI wired to API
  - Dependencies: D1, A2

- Ticket D3: Save model pair
  - Scope: save flow, preset naming
  - Deliverable: save preset UI + API hook
  - Dependencies: D2, E2

## Agent E — Data + Platform Services
- Ticket E1: User profile storage
  - Scope: schema, CRUD endpoints
  - Deliverable: profile API + persistence
  - Dependencies: A1

- Ticket E2: History storage + search
  - Scope: store Q/A, indexing, query endpoints
  - Deliverable: searchable history API
  - Dependencies: A1

- Ticket E3: Presets storage
  - Scope: save/retrieve model pairs
  - Deliverable: presets API + persistence
  - Dependencies: A1

## Agent F — Observability + QA
- Ticket F1: Request tracing
  - Scope: trace IDs through gateway and UI
  - Deliverable: trace propagation + basic dashboards
  - Dependencies: A5

- Ticket F2: Integration test harness
  - Scope: routing + gateway + UI happy path
  - Deliverable: integration test suite
  - Dependencies: A2, A4, B3

---

## Cross-Agent Sync Points
- Contract review: A1 + E1/E2/E3 + B2/C1/D2
- Telemetry review: A5 + C3 + F1
- MVP E2E demo: B3 + D2 + A4 + E2
