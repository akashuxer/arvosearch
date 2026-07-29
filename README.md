# Arvo Advance Search Playground

An interactive reference implementation for Arvo Advance Search. The playground demonstrates strict discovery, exact-value matching, positional matching, wildcards, multi-value input, result highlighting, and high-cardinality search configuration.

## Panel behaviour

The Customer member panel is a **modeless side panel**:

- It stays fixed to the right side of the viewport.
- It does not display a mask, backdrop, or page-dimming overlay.
- The playground content on the left remains visible and interactive while the panel is open.
- Users can change configurator settings, copy test values, and use test-case actions without closing the panel.
- The panel does not trap focus or expose `aria-modal="true"`.
- It closes only through an explicit panel action, such as Close or Apply selection; clicking the surrounding page does not dismiss it.

Use this model when users must compare, configure, or act on the underlying page while searching and selecting members. A modal panel should be reserved for workflows that must temporarily block page interaction.

## Search toolbar

The member-panel search toolbar uses this fixed order:

```text
Search icon → Search value → Clear → Matching/total counter → Match method
```

| Element | Behaviour |
|---|---|
| Search icon | Identifies the field as search. It is decorative and does not receive focus. |
| Search value | Accepts typed, comma-separated, or pasted values according to the configured multi-value mode. |
| Clear | Appears when the input has a value and clears the current query. |
| Matching/total counter | Appears only after a non-empty search returns one or more results. It displays matching results against the complete available dataset, for example `12/92`. It is informational and not interactive. |
| Match method | The tune icon remains pinned to the extreme right and opens the Match method menu. |

The Clear column is created only when a query exists. When the field is empty,
the counter is hidden and the Match method control remains flush to the extreme
right; no unused trailing grid column or gap is reserved.

The counter communicates the current search scope:

- `12/92`: 12 values match the current query out of 92 total values.
- Empty search: counter hidden.
- No results, loading, minimum-character guidance, or invalid input: counter hidden.

Selection remains communicated separately in the panel footer, for example `2 selected`. The counter uses tabular numerals to prevent layout movement and has an accessible label such as `12 matching results out of 92 total values`.

## Test-case actions

Each test case provides two distinct actions:

- **Copy:** Copies the original sample value, applies the test case’s required match method and case-sensitivity setting, opens the Customer panel, focuses the search field, and leaves the field empty so the user can paste manually.
- **Try in panel:** Applies the required configuration and loads the normalized sample directly into the focused search field. Empty and whitespace-only pasted rows are removed.

Copy must never prefill the search field. This keeps clipboard testing realistic and ensures the user can verify paste parsing, blank-row cleanup, and multiline behavior.

## Core definitions

| Term | Definition | Example |
|---|---|---|
| Partial search | Matches a fragment of a stored value instead of requiring complete equality. It is an umbrella term for starts-with, contains, ends-with, and wildcard matching. | `Customer` may find `Customer-A01`, `Northwind Customer`, and `Enterprise Customer East`. |
| All matches | Broad discovery mode. It returns exact and partial matches in relevance order: complete exact value, starts with, contains, then ends with. | `05` ranks `05` before `05-Customer`, `Customer-4051`, and `Northwind-05`. |
| Exact matches | Complete stored-value equality after configured normalization. It does not perform prefix, contains, suffix, wildcard, stemming, synonym, or typo matching. | `Customer-A01` matches only the complete `Customer-A01` value. |
| Exact phrase | Words must remain together and in the entered order. This does not necessarily mean that the entire stored value is equal. | `"Customer A"` can be a phrase inside `Preferred Customer A East`. |
| Exact token | Matches a complete indexed word or token rather than a substring inside a larger token. | `Customer` does not match the token `Customers` or `Customer123`. |

Arvo’s **Exact matches** menu option means **exact value**, not merely exact phrase or exact token.

### Match-method menu

| Method | Positive/negative | Single value | Multiple values |
|---|---|---|---|
| All matches | Positive | Exact and partial discovery | OR: match any entered value |
| Exact matches | Positive | Complete value equality | OR: equal any entered value |
| Does not equal (`!=`) | Negative | Exclude one complete value | AND NOT: equal none of the entered values |
| Starts with | Positive | Prefix match | OR: start with any entered value |
| Does not start with | Negative | Exclude a prefix | AND NOT: start with none of the entered values |
| Ends with | Positive | Suffix match | OR: end with any entered value |
| Does not end with | Negative | Exclude a suffix | AND NOT: end with none of the entered values |
| Contains | Positive | Infix match | OR: contain any entered value |
| Does not contain | Negative | Exclude an infix | AND NOT: contain none of the entered values |

All positive methods highlight the responsible typed or pasted value. Negative methods do not highlight excluded text because every returned record is, by definition, a non-match.

### Inline exact-value syntax in All matches

Users may force exact-value equality without leaving **All matches**:

| Input | Interpretation |
|---|---|
| `="Customer01"` | Exact value `Customer01` |
| `=Customer 01` | Exact value `Customer 01`; spaces are preserved |
| `="Customer A 01", =Northwind` | Match either complete value |

The leading `=` is an operator. Optional surrounding quotation marks preserve a phrase and are removed before comparison. They are not part of the stored value.

### Normalization and strictness

Default Exact matches behavior:

- Case-insensitive unless the attribute-level **Case-sensitive matching** configuration is enabled.
- Trim leading and trailing whitespace.
- Ignore blank and whitespace-only pasted rows.
- Preserve meaningful internal spaces, punctuation, hyphens, and underscores.
- No typo tolerance. A misspelling returns no result.
- No stemming, synonyms, automatic pluralization, or silent query relaxation.
- No wildcard interpretation in Exact matches; `*` and `?` are literal characters.

For identifiers such as SKUs and account codes, case sensitivity can be enabled at the attribute configuration level.

## Why Arvo does not use a Partial search toggle

The legacy o9 Classic filter shows **Partial Search** only after users paste multiple values. That makes a fundamental matching rule appear conditionally and ties it to the input method rather than the user’s intent.

Arvo keeps matching explicit and consistent:

- The same Match method menu is available before typing, while typing, and after pasting.
- **All matches** is the broad discovery default.
- **Exact matches**, Starts with, Ends with, Contains, and their negative forms are direct methods.
- Multi-value is an input capability, not a separate search meaning.
- A pasted list follows the currently selected method; users do not need to discover an additional toggle.

This avoids a hidden mode change, makes typed and pasted searches behave the same way, and gives the user a clear explanation of what will match before execution.

## Playground configuration

The developer-facing configurator is intentionally outside the end-user panel:

- Multi-value input: On or Off
- Multi-value mode: Compact or Non-compact
- Maximum expanded rows: 3–12, default 7
- Case-sensitive matching
- Dataset mode: Local or Remote/high-cardinality
- Minimum characters: default 1
- Debounce: Local default 0 ms; Remote default 200 ms; configurable
- Search persists: On or Off; default On

### Remote loading

When the dataset mode is **Remote**, the results area displays a skeleton loader
while the debounced request is in progress:

- The search input, entered value, panel header, and footer remain stable.
- Skeleton rows replace only the bottom result-list content.
- The inline matching/total counter stays hidden while loading.
- Previous remote responses cannot replace a newer query result.
- The results container exposes `aria-busy="true"` and announces one concise
  `Loading customer results` status instead of announcing every placeholder.
- Skeleton shimmer is removed when reduced motion is requested.

Local mode does not use the results skeleton during normal synchronous search.

### Session persistence

When **Search persists** is On, closing and reopening the member panel restores
the last query, selected match method, and corresponding results, provided the
user did not clear the query. The setting applies only to the current page
session and does not write the query to durable storage.

When Search persists is Off, closing the panel clears the query and reopening
starts with an empty search field. The Clear action always removes the current
query immediately, regardless of the persistence setting.

## Multi-value behaviour

- Commas and line breaks delimit values.
- Empty and whitespace-only pasted rows are ignored.
- Multi-value applies to every match method when enabled.
- Positive methods use OR: a record may match any entered value.
- Negative methods use AND NOT: a record must match none of the entered values.
- In Non-compact mode, entering a comma commits the current value and moves the caret to the next row.
- The field grows until the configured maximum row count and then scrolls.
- On blur, multiple values collapse to `First value, +N`.

## Accessibility

- The tune control is labelled dynamically, such as `Match method: All matches`.
- Clear and close controls have explicit accessible names.
- Results use listbox/option semantics with `aria-selected`.
- Match highlighting does not fragment the spoken result value.
- Focus indicators do not rely on color alone.
- The modeless panel uses a labelled complementary landmark and does not trap focus, allowing a logical focus path between the panel and the playground.
- Reduced-motion preferences are respected.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm run dev
```
