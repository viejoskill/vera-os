# @vera/services

The **brain** of VERA. "Apps show, Services think."

## Purpose

Holds all business logic. Apps consume Services; Services consume Repositories (for data)
and Providers (for integrations). No business rule lives in the UI.

## Responsibilities

- `PropertyService` — portfolio logic (filtering, portfolio value, ...).
- `AIService` — intelligence layer, built on the **Provider Pattern**.
- `ai/AIProvider` — vendor-agnostic LLM contract; `MockAIProvider` is the default impl.
- `service-container.ts` — the composition root that wires concrete impls (the single
  place coupling the system to mocks vs. real providers/repositories).

## Dependencies

- `@vera/types`, `@vera/repositories`

## Extension points

- Add `OpenAIProvider` / `AnthropicProvider` / `GeminiProvider implements AIProvider`
  and change one line in `service-container.ts`.
- Add new services (`OperationService`, `InsightService`, `StudioService`) here.
