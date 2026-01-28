# Nexus PRD (Implementation-Focused)

## 1. Overview
Nexus is a homework workspace that automatically routes student questions to the best AI model by subject and performance, while showing model attribution and giving users control and transparency. The product balances speed, accuracy, and academic integrity.

## 2. Goals
- Deliver a trustworthy homework workspace with automatic subject detection and model routing.
- Make model choice transparent with clear attribution, performance signals, and comparisons.
- Enable power users to run multiple models in parallel and save preferred stacks.
- Build a scalable foundation for V1/V2 features without rework.

## 3. Non-Goals (MVP)
- Real-time collaboration features.
- Instructor dashboards or institution integrations.
- Fully personalized rankings or adaptive tutoring.

## 4. Target Users
- High school and college students seeking accurate homework help.
- Power users who want to compare and experiment with models.

## 5. Key Use Cases
- Student pastes a multi-part question, gets a structured answer with steps.
- Student sees which model answered and why it was chosen.
- Student retries with a different model to compare results.
- Power user runs 2+ models side-by-side and saves a preset.

## 6. MVP Scope (Must-Have)
### Studio
- Homework input (multi-part).
- Subject detection.
- Auto model selection (based on scores: accuracy, reasoning depth, latency).
- Structured final answer with step-by-step for quant subjects.
- Model attribution (model + short rationale).

### Model Hub
- Model catalog.
- Basic comparison: speed, accuracy, cost-efficiency, strengths.
- Use-case badges.
- Live status indicators (availability, latency, reliability).

### Laboratory
- Model pairing (2+ models).
- Parallel outputs view.
- Save model pair.

### Platform
- User profiles (preferences, subject focus).
- Homework history (searchable).
- Fast/Deep mode toggle.

## 7. V1 Scope (Should-Have)
- Confidence score per answer.
- Follow-up question threading.
- Reasoning toggle for citations/steps.
- Retry with alternate model.
- Side-by-side comparison view (same question, multiple models).
- Historical performance metrics by subject.
- Student rating system for models.
- Named presets and voting/best-answer selection.
- Academic integrity controls (explanation depth sliders).
- Export options (copy/PDF/LaTeX/Markdown).
- Usage insights.

## 8. V2 Scope (Nice-to-Have)
- Assignment mode and teacher-safe mode.
- Concept breakdown view.
- Personalized model rankings and explain-the-difference.
- Instructor-recommended models.
- Auto-consensus mode and per-subject presets.
- Experiment history.
- Course mapping, progress tracking, collaboration mode.

## 9. Success Metrics (KPIs)
- Homework accuracy rate (proxy: user ratings + retry rate).
- Time-to-answer (median, p95).
- Retry rate due to dissatisfaction.
- Saved model preset usage rate.
- Student retention per course and weekly active rate.

## 10. Requirements
### Functional
- Subject detection service (multi-label capable).
- Model routing engine with configurable scoring weights.
- Model execution layer with parallel fan-out support.
- Answer formatting layer with step-by-step output for quant subjects.
- Attribution layer with model rationale.
- Searchable history with question/answer indexing.
- Preset storage and recall.

### Non-Functional
- Latency targets: p50 < 6s, p95 < 15s for single-model answers.
- Parallel outputs should not exceed 2x single-model latency.
- Reliability: 99.5% API success for model calls.
- Privacy: store user questions securely; allow deletion.
- Observability: trace each request from input to output.

## 11. Product Decisions
- Default to automatic routing; allow manual overrides later (V1+).
- Reasoning visibility is opt-in (to support academic integrity).
- Separate Studio, Model Hub, Laboratory as top-level navigation.

## 12. UX Notes
- Primary flow emphasizes speed and clarity.
- Model attribution is concise and human-readable.
- Laboratory presents side-by-side output with synchronized scrolling.

## 13. System Architecture (High-Level)
- Frontend: Studio, Model Hub, Laboratory UI.
- Backend API: question intake, subject detection, routing, model execution.
- Model gateway: integrates with multiple model providers.
- Data store: user profiles, history, presets, model metrics.
- Metrics/telemetry: request tracing, performance stats, feedback.

## 14. Risks and Mitigations
- Model accuracy variance: add routing weights and confidence signals.
- Academic integrity concerns: reasoning toggle and depth controls.
- Latency from multi-model calls: parallel execution and caching.
- Provider outages: fallback routing and status indicators.

## 15. Open Questions
- What initial models are supported and which providers?
- What data retention policies should be enforced by default?
- How is accuracy measured (user rating vs. benchmark data)?

---

# Implementation Plan by Release (MVP / V1 / V2)

## MVP Plan (Foundation + Core Features)
**Goal:** ship Studio + Model Hub + Laboratory MVP with platform basics.

Parallel workstreams (multi-agent friendly):
1) Contracts + Data
- Define data models: user, question, answer, model, preset, history.
- Define API endpoints for intake, routing, execution, history, presets.
- Define telemetry schema (request_id, model_id, latency, outcome).

2) Routing + Model Gateway
- Provider abstraction and call adapters.
- Subject detection (baseline heuristic + classifier).
- Routing policy (weights, fallback, manual override hooks).

3) Studio + Shared UI
- App shell/navigation.
- Input panel, answer rendering, model attribution.
- Step-by-step output formatting for quant subjects.

4) Model Hub MVP
- Catalog, comparison tables, use-case badges.
- Status indicators from telemetry.

5) Laboratory MVP
- Parallel execution UI for 2+ models.
- Save model pair.

6) Platform MVP
- User profiles, history storage, search.
- Fast/Deep toggle.

7) Observability + QA
- Request tracing, latency dashboards.
- Integration tests for routing and gateway.

Dependencies:
- Contracts unblock routing, storage, and all UI work.
- Telemetry unlocks Model Hub status and comparison.

Solo path (serial, lowest context switching):
1) Contracts + data models
2) Routing + model gateway (include subject detection)
3) Platform storage + history search
4) Studio core flow (input → routed answer → attribution)
5) Laboratory parallel view + save pair
6) Model Hub catalog + status
7) Observability + QA

MVP exit criteria:
- User can enter a question and receive a structured answer.
- Subject detected and routing applied with visible attribution.
- Model Hub lists models with live status and basic comparison.
- Laboratory shows parallel responses and allows saving a model pair.
- History is searchable and Fast/Deep toggle is available.

## V1 Plan (Quality, Transparency, Integrity)
**Goal:** deepen quality signals, comparison, and integrity controls.

Parallel workstreams:
1) Answer Quality
- Confidence scoring.
- Retry with alternate model.
- Follow-up threading.

2) Model Hub V1
- Side-by-side comparison for same prompt.
- Historical performance metrics.
- Student ratings system.

3) Laboratory V1
- Named presets.
- Voting/best-answer selector.
- Performance notes.

4) Platform V1
- Integrity controls (explanation depth).
- Export options.
- Usage insights.

Solo path:
1) Confidence scoring + retry flow
2) Follow-up threading
3) Model Hub comparison + metrics
4) Ratings + usage insights
5) Laboratory presets + voting
6) Export options + integrity controls

V1 exit criteria:
- Users can see confidence and retry with an alternate model.
- Side-by-side comparison works in Model Hub.
- Presets and voting work in Laboratory.
- Integrity controls and exports are available.

## V2 Plan (Personalization + Advanced Modes)
**Goal:** advanced personalization and collaboration.

Parallel workstreams:
1) Studio V2
- Assignment mode, teacher-safe mode.
- Concept breakdown view.

2) Model Hub V2
- Personalized rankings.
- Explain-the-difference view.
- Instructor-recommended models.

3) Laboratory V2
- Auto-consensus mode.
- Per-subject presets.
- Experiment history.

4) Platform V2
- Course mapping.
- Progress tracking.
- Collaboration mode.

Solo path:
1) Assignment mode + teacher-safe mode
2) Concept breakdown view
3) Personalized rankings + explain-the-difference
4) Auto-consensus + per-subject presets
5) Experiment history + course mapping
6) Progress tracking + collaboration mode

V2 exit criteria:
- Assignment mode and teacher-safe mode are usable.
- Personalization is visible in Model Hub.
- Laboratory supports auto-consensus and experiment history.
- Progress tracking and collaboration are available.

---

# Agent Map (If You Parallelize)

## Agent A: Routing + Model Gateway
- Provider adapters, subject detection, routing policy, telemetry hooks.

## Agent B: Studio Frontend
- Input panel, answer rendering, attribution, confidence display, follow-ups.

## Agent C: Model Hub Frontend + Metrics
- Catalog, comparisons, status indicators, historical metrics, ratings.

## Agent D: Laboratory Frontend
- Parallel output view, save presets, voting/selector, consensus mode.

## Agent E: Data + Platform Services
- User profiles, history indexing/search, exports, course mapping.

## Agent F: Observability + QA
- Tracing, dashboards, integration tests for model calls.

---

# Milestones (Suggested)
- M0: Contracts and gateway complete.
- M1: MVP end-to-end (Studio + History + Attribution).
- M2: Model Hub + Laboratory MVP complete.
- M3: V1 quality, integrity, and insights shipped.
- M4: V2 personalization and collaboration.
