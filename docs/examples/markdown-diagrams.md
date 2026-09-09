# Mermaid supplementary specimen

These examples complement the four diagrams in the
[main compatibility specimen](https://github.com/flc1125/mote/blob/main/docs/examples/markdown-compatibility.md).
Each section states the expected relationships, not just whether an SVG exists.

## D01 · Entity relationships

```mermaid
erDiagram
 CUSTOMER ||--o{ ORDER : places
 ORDER ||--|{ LINE_ITEM : contains
```

Expected: CUSTOMER, ORDER and LINE_ITEM are connected by two labeled relationships.
The cardinality symbols remain visible in both themes.

## D02 · Bars and lines

```mermaid
xychart-beta
 title "Monthly documents"
 x-axis [Jan, Feb, Mar]
 y-axis "Documents" 0 --> 100
 bar [20, 40, 80]
 line [30, 55, 90]
```

Expected: three bars and a line series, month labels, numeric ticks and a chart title.
The two series use distinct colors. Text and grid points remain visible in dark mode.

## D03 · Compact statements

```mermaid
flowchart LR; A-->B; B-.->C; C==>D
```

Expected: four nodes connected by solid, dashed and thick edges. Semicolons separate
statements, and whitespace around arrows is optional.

## D04 · Labels and groups

```mermaid
flowchart TD
 subgraph processing[Processing]
 A["Input; keep label text"]-->B{Valid?}
 end
 B-->|Yes|C[Done]
 B-->|No|D[Retry]
```

Expected: A and B share a group; C and D are outside it. The semicolon inside the
quoted label is text, not a statement separator. Yes and No label different edges.

Large diagrams scroll within their region on narrow screens. The source disclosure
below each diagram keeps the original source available for inspection.
