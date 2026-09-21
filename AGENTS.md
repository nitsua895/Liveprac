# Liveprac agent instructions

Before planning or changing product behavior, read `docs/PRODUCT_SOURCE_OF_TRUTH.md` in full.

Treat that document as the product authority and GitHub Issues as the executable backlog. Preserve the session invariants, especially the fixed appointment end time, automatic operation, recovery behavior, and dark-room/iPad accessibility. If a request conflicts with an invariant, surface the conflict rather than silently changing the rule.

When behavior changes, update the source-of-truth document in the same pull request if the underlying product decision changed.
