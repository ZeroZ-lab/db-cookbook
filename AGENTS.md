# gstack

Use the `/browse` skill from gstack for all web browsing.

Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/office-hours`
- `/plan-ceo-review`
- `/plan-eng-review`
- `/plan-design-review`
- `/design-consultation`
- `/design-shotgun`
- `/design-html`
- `/review`
- `/ship`
- `/land-and-deploy`
- `/canary`
- `/benchmark`
- `/browse`
- `/connect-chrome`
- `/qa`
- `/qa-only`
- `/design-review`
- `/setup-browser-cookies`
- `/setup-deploy`
- `/retro`
- `/investigate`
- `/document-release`
- `/codex`
- `/cso`
- `/autoplan`
- `/plan-devex-review`
- `/devex-review`
- `/careful`
- `/freeze`
- `/guard`
- `/unfreeze`
- `/gstack-upgrade`
- `/learn`

# db-cookbook Writing Contract

This project is a systematic learning guide from PostgreSQL to intelligent data systems. It is not a generic database tutorial, SQL manual, or big-data tool catalog.

Use an evolutionary narrative:

1. Start with PostgreSQL to build database intuition: how data is organized, constrained, queried, and kept consistent.
2. Use SQL to build analytical capability: large tables, indexes, partitioning, materialized views, execution plans, and the boundary of a single-machine database.
3. Introduce the split between OLTP and OLAP: warehouse modeling, ETL/CDC, batch processing, real-time computation, OLAP databases, and lakehouse architecture.
4. Extend into AI-era data infrastructure: vector databases, graph databases, data governance, metadata, lineage, quality, and trust.

Every chapter should follow this structure:

1. Problem entry
2. Core judgment
3. Mechanism explanation
4. System position
5. Scenario case
6. Common misconceptions
7. Hands-on task
8. Summary that leads into the next chapter

Do not define concepts as isolated dictionary entries. For every concept, answer:

- What problem does it solve?
- What problem does it not solve?
- Why did it appear?
- How does it relate to the systems before and after it?
- How is it implemented in a real data platform?

Keep the style professional, systematic, clear, and mechanism-driven. Prefer structure, comparison, scenarios, and migration relationships over slogans or empty abstractions.

The final reader journey is:

- From: can query data
- To: can understand and build big data and AI data infrastructure
