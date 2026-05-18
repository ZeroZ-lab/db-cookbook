---
tokens:
  node-border-radius: 8px
  node-default-width: 120
  node-default-height: 56
  node-border-width: 2px
  node-selected-border: 3px
  font-size-label: 14px
  font-size-subtitle: 12px
  edge-dash-array: "8 4"
  animation-duration: 2s
  colors:
    source: "#3b82f6"
    transport: "#8b5cf6"
    compute: "#f59e0b"
    storage: "#10b981"
    ai: "#ec4899"
    governance: "#6366f1"
    edge-default: "#94a3b8"
---

# Project Design Tokens

> Auto-generated from feature design documents. Do not edit manually.

## Design Tokens

Shared across all interactive components in the site.

### Node Sizing

| Token | Value | Usage |
|-------|-------|-------|
| `node-border-radius` | `8px` | All data flow nodes |
| `node-default-width` | `120` (SVG units) | Default node width |
| `node-default-height` | `56` (SVG units) | Default node height |
| `node-border-width` | `2px` | Default border |
| `node-selected-border` | `3px` | Selected/hover state |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `font-size-label` | `14px` | Node label (system name) |
| `font-size-subtitle` | `12px` | Node subtitle |

### Animation

| Token | Value | Usage |
|-------|-------|-------|
| `edge-dash-array` | `8 4` | Flow edge pattern |
| `animation-duration` | `2s` | Standard animation cycle |

### Colors (by system type)

| Token | Value | System type |
|-------|-------|-------------|
| `colors.source` | `#3b82f6` | Source systems (PostgreSQL) |
| `colors.transport` | `#8b5cf6` | Transport (Kafka) |
| `colors.compute` | `#f59e0b` | Compute (Spark, Flink) |
| `colors.storage` | `#10b981` | Storage (ClickHouse) |
| `colors.ai` | `#ec4899` | AI (vector, graph) |
| `colors.governance` | `#6366f1` | Governance |
| `colors.edge-default` | `#94a3b8` | Default edge color |

## Sync Log

| Date | Feature | Action |
|------|---------|--------|
| 2026-05-18 | learning-path-simulator | Initial creation from 02-design.md |
