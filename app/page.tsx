"use client";

import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Method =
  | "all"
  | "exact"
  | "notExact"
  | "starts"
  | "notStarts"
  | "ends"
  | "notEnds"
  | "contains"
  | "notContains";
type InputLayout = "compact" | "multiline";
type DatasetMode = "local" | "remote";

const methods: { value: Method; label: string; group: string; hint: string }[] = [
  { value: "all", label: "All matches", group: "Match scope", hint: "Exact first, then partial matches" },
  { value: "exact", label: "Exact matches", group: "Match scope", hint: "Complete stored values only" },
  { value: "notExact", label: "Does not equal (!=)", group: "Match conditions", hint: "Exclude complete stored values" },
  { value: "starts", label: "Starts with", group: "Match by position", hint: "Values beginning with the text" },
  { value: "notStarts", label: "Does not start with", group: "Match by position", hint: "Exclude values beginning with the text" },
  { value: "ends", label: "Ends with", group: "Match by position", hint: "Values ending with the text" },
  { value: "notEnds", label: "Does not end with", group: "Match by position", hint: "Exclude values ending with the text" },
  { value: "contains", label: "Contains", group: "Match by position", hint: "Text can appear anywhere" },
  { value: "notContains", label: "Does not contain", group: "Match by position", hint: "Exclude values containing the text" },
];

const customers = [
  "05", "05-Customer-123", "05 Northwind", "Customer-05-East",
  "Customer-4051-India", "Customer-B05", "Northwind-05",
  "ACME", "acme", "Acme Corporation", "ACME-India", "Acme & Sons",
  "Account 0005", "Account-05-Enterprise", "CUST-00005",
  "CUST-10001", "CUST-10010", "CUST-10100", "EU-CUST-10001",
  "Northwind", "Northwind Traders", "Northwind Retail India", "The Northwind Company",
  "Customer Alpha", "Alpha Customer", "Enterprise Alpha Customer",
  "Customer A 01", "Customer-A-01", "Customer_A01", "customer-a01",
  "Sales—Enterprise", "Sales-Enterprise", "R&D Customer", "Customer+Plus",
  "user@example.com", "support+india@example.com", "#Priority Customer",
  "SKU*05", "Question?Mark Trading", "O'Connor Retail", "Smith & Co.",
  "A/B Test Customer", "Customer (Legacy)",
  "Café Central", "Cafe Central", "München Retail", "Munchen Retail",
  "São Paulo Distribution", "Sao Paulo Distribution", "Tokyo 東京 Customer",
  "ग्राहक भारत", "भारत ग्राहक", "شركة النور", "عميل شركة النور",
  "Customer", "Customers", "Customer Success", "CustomerSuccess",
  "Northwind Customer", "India Retail Customer", "Microsoft", "Micro Systems",
  ...Array.from({ length: 24 }, (_, i) => `Customer-A${String(i + 1).padStart(2, "0")}`),
  "Customer-105-West", "Customer-205-South", "Customer-305-North",
  "A", "X", "Global Enterprise Customer with an unusually long registered business name",
];

const testCases: { category: string; title: string; input: string; method: Method; caseSensitive?: boolean; expected: string }[] = [
  { category: "Discovery & ranking", title: "Rank strongest matches", input: "05", method: "all", expected: "Shows the exact value first, then prefix, contains, and suffix matches." },
  { category: "Discovery & ranking", title: "Exact value within All matches", input: "Northwind", method: "all", expected: "Keeps the exact Northwind record first while still discovering longer related values." },
  { category: "Discovery & ranking", title: "Word inside a long name", input: "Enterprise", method: "all", expected: "Finds the word across names and highlights only the characters that matched." },
  { category: "Discovery & ranking", title: "Similar values, no correction", input: "Customer", method: "all", expected: "Returns Customer and Customers as distinct records without stemming or correction." },

  { category: "Exact lookup", title: "Exact customer code", input: "CUST-10001", method: "exact", expected: "Returns only the complete identifier, not EU-CUST-10001 or nearby codes." },
  { category: "Exact lookup", title: "Exact value", input: "ACME", method: "exact", expected: "Matches the complete stored value only." },
  { category: "Exact lookup", title: "Case-sensitive exact", input: "ACME", method: "exact", caseSensitive: true, expected: "Matches ACME, but not the separately stored lowercase acme value." },
  { category: "Exact lookup", title: "Case-insensitive exact", input: "customer-a01", method: "exact", expected: "With case sensitivity off, matches the complete Customer-A01 value." },
  { category: "Exact lookup", title: "Punctuation is significant", input: "Customer_A01", method: "exact", expected: "Matches the underscore version only; hyphens and spaces are not silently normalized." },
  { category: "Exact lookup", title: "Inline quoted exact", input: "=\"Customer A 01\"", method: "all", expected: "Forces complete-value equality while All matches remains selected. Quotes preserve the phrase and are not part of the value." },
  { category: "Exact lookup", title: "Inline unquoted exact", input: "=Customer A 01", method: "all", expected: "Forces complete-value equality for a value containing spaces without changing the selected match method." },
  { category: "Exact lookup", title: "Multiple inline exact values", input: "=\"Customer A 01\", =Northwind", method: "all", expected: "Matches either complete value and highlights the matched value." },

  { category: "Partial search", title: "Starts with a customer series", input: "Customer-A", method: "starts", expected: "Replicates prefix search and returns the Customer-A01 through Customer-A24 series." },
  { category: "Partial search", title: "Contains a middle fragment", input: "4051", method: "contains", expected: "Replicates infix search and returns Customer-4051-India." },
  { category: "Partial search", title: "Ends with a code", input: "05", method: "ends", expected: "Replicates suffix search and returns values whose final characters are 05." },
  { category: "Partial search", title: "Contains a natural word", input: "Retail", method: "contains", expected: "Finds Retail anywhere in a customer name." },
  { category: "Partial search", title: "Starts with a long phrase", input: "Global Enterprise", method: "starts", expected: "Tests prefix matching against a long enterprise record." },
  { category: "Partial search", title: "Ends with a natural word", input: "Customer", method: "ends", expected: "Finds records such as Alpha Customer without requiring wildcard syntax." },
  { category: "Negative matching", title: "Does not equal", input: "ACME", method: "notExact", expected: "Returns every value except the complete ACME value; nearby and longer values remain." },
  { category: "Negative matching", title: "Does not start with", input: "Customer-A", method: "notStarts", expected: "Excludes the Customer-A series while retaining values where the fragment occurs elsewhere." },
  { category: "Negative matching", title: "Does not end with", input: "Customer", method: "notEnds", expected: "Excludes values whose final characters are Customer." },
  { category: "Negative matching", title: "Does not contain", input: "Retail", method: "notContains", expected: "Excludes every value containing Retail." },
  { category: "Negative matching", title: "Multiple excluded exact values", input: "ACME, Northwind, Customer-A01", method: "notExact", expected: "Uses AND NOT: a result remains only when it equals none of the entered values." },
  { category: "Negative matching", title: "Multiple excluded fragments", input: "Retail, Customer", method: "notContains", expected: "Uses AND NOT: excludes values containing either fragment." },

  { category: "Multi-value methods", title: "All matches with multiple values", input: "Northwind, 4051", method: "all", expected: "Uses OR: returns values broadly matching Northwind or 4051, with exact and partial results ranked per input." },
  { category: "Multi-value methods", title: "Exact matches with multiple values", input: "ACME, Northwind, Customer-A01", method: "exact", expected: "Uses OR: returns a value when it completely equals any entered value." },
  { category: "Multi-value methods", title: "Does not equal multiple values", input: "ACME, Northwind, Customer-A01", method: "notExact", expected: "Uses AND NOT: excludes all three complete values. Similar or longer values remain because they are not equal." },
  { category: "Multi-value methods", title: "Starts with multiple values", input: "Customer-A, Northwind", method: "starts", expected: "Uses OR: returns values starting with Customer-A or Northwind." },
  { category: "Multi-value methods", title: "Does not start with multiple values", input: "Customer-A, Northwind", method: "notStarts", expected: "Uses AND NOT: excludes values starting with either Customer-A or Northwind." },
  { category: "Multi-value methods", title: "Ends with multiple values", input: "Customer, 05", method: "ends", expected: "Uses OR: returns values ending with Customer or 05." },
  { category: "Multi-value methods", title: "Does not end with multiple values", input: "Customer, 05", method: "notEnds", expected: "Uses AND NOT: excludes values ending with either Customer or 05." },
  { category: "Multi-value methods", title: "Contains multiple values", input: "Retail, Microsoft", method: "contains", expected: "Uses OR: returns a value when it contains Retail or Microsoft anywhere in the stored text." },
  { category: "Multi-value methods", title: "Does not contain multiple values", input: "Retail, Customer", method: "notContains", expected: "Uses AND NOT: returns only values containing neither Retail nor Customer." },
  { category: "Multi-value methods", title: "Mixed inline exact values in All matches", input: "=\"Customer A 01\", =Northwind, Retail", method: "all", expected: "Uses OR: the first two entries require complete equality, while Retail keeps broad All matches behavior." },

  { category: "Wildcard shortcuts", title: "Triggered wildcard prefix", input: ":Customer-A0*", method: "all", expected: "The leading : activates wildcard matching; * matches any remaining characters after Customer-A0." },
  { category: "Wildcard shortcuts", title: "Triggered wildcard contains", input: ":*05*", method: "all", expected: "The leading : activates wildcard matching; the surrounding * characters find 05 anywhere in a value." },
  { category: "Wildcard shortcuts", title: "Triggered wildcard suffix", input: ":*Customer", method: "all", expected: "The leading : activates wildcard matching; the leading * finds values ending with Customer." },
  { category: "Wildcard shortcuts", title: "Exactly one unknown character", input: ":Customer-A0?", method: "all", expected: "The leading : activates wildcard matching; ? matches exactly one character and returns A01 through A09." },
  { category: "Wildcard shortcuts", title: "Two unknown characters", input: ":CUST-100??", method: "all", expected: "The leading : activates wildcard matching; two ? characters match exactly two trailing characters." },
  { category: "Wildcard shortcuts", title: "Asterisk without trigger", input: "SKU*05", method: "all", expected: "Without a leading :, * remains literal text and finds the stored SKU*05 value." },
  { category: "Wildcard limitations", title: "Multiple wildcard values are blocked", input: ":*Customer-A01*, :*Customer-A02*", method: "all", expected: "Wildcard search supports only one value. The comma and second pattern are rejected with an inline explanation." },
  { category: "Wildcard limitations", title: "Wildcard and plain value are blocked", input: ":*Customer-A01*, Customer-A02", method: "all", expected: "Wildcard and non-wildcard values cannot be combined. The search keeps the single wildcard pattern and explains the limitation." },
  { category: "Wildcard limitations", title: "Line break after wildcard is blocked", input: ":*Customer-A01*\nCustomer-A02", method: "all", expected: "Enter and Shift+Enter cannot create another value while wildcard mode is active." },

  { category: "Multiple values", title: "Pasted blank rows", input: "Customer-A01\n\nCustomer-A02", method: "exact", expected: "Ignores the empty line, detects exactly 2 values, and highlights both matches." },
  { category: "Multiple values", title: "Whitespace-only pasted rows", input: "Customer-A01\n   \n\nCustomer-A03", method: "exact", expected: "Discards whitespace-only rows instead of creating empty search values." },
  { category: "Multiple values", title: "Comma-separated exact values", input: "Customer-A01, Customer-A02, Northwind-05", method: "exact", expected: "Finds three complete values and highlights the matching input for each result." },
  { category: "Multiple values", title: "Multiple partial values", input: "4051, Northwind", method: "all", expected: "Finds results matching either fragment and highlights the responsible fragment." },
  { category: "Multiple values", title: "Mixed commas and new lines", input: "ACME,\nCustomer-A04,\n\nNorthwind-05", method: "all", expected: "Treats commas and line breaks as separators while ignoring blank entries." },
  { category: "Multiple values", title: "Duplicate pasted values", input: "Customer-A01,\nCustomer-A01,\nCustomer-A02", method: "exact", expected: "Demonstrates repeated input while returning each matching dataset record only once." },

  { category: "Enterprise data", title: "Apostrophe", input: "O'Connor", method: "contains", expected: "Treats the apostrophe as searchable text." },
  { category: "Enterprise data", title: "Email fragment", input: "@example.com", method: "ends", expected: "Searches structured email data without stripping @ or punctuation." },
  { category: "Enterprise data", title: "Plus character", input: "Customer+Plus", method: "exact", expected: "Performs strict equality on a value containing +." },
  { category: "Enterprise data", title: "Ampersand", input: "&", method: "contains", expected: "Finds company names containing an ampersand." },
  { category: "Enterprise data", title: "Literal asterisk in stored data", input: "SKU*05", method: "exact", expected: "Exact mode treats * literally and returns the stored SKU*05 value." },
  { category: "Enterprise data", title: "Literal question mark", input: "Question?Mark Trading", method: "exact", expected: "Exact mode treats ? literally and returns the complete stored value." },

  { category: "Languages & accents", title: "Accented value", input: "Café", method: "contains", expected: "Finds the accented value without silently converting it to Cafe." },
  { category: "Languages & accents", title: "Unaccented value", input: "Cafe", method: "exact", expected: "Shows that Cafe and Café remain separately searchable stored values." },
  { category: "Languages & accents", title: "Japanese characters", input: "東京", method: "contains", expected: "Finds partial matches using Japanese characters." },
  { category: "Languages & accents", title: "Hindi prefix", input: "ग्राहक", method: "starts", expected: "Finds values beginning with the Hindi term." },
  { category: "Languages & accents", title: "Arabic suffix", input: "شركة النور", method: "ends", expected: "Tests right-to-left text when the phrase appears at the end of a value." },

  { category: "Boundaries & empty states", title: "No typo tolerance", input: "Custmer-A01", method: "all", expected: "Returns no results; Arvo does not autocorrect the misspelling." },
  { category: "Boundaries & empty states", title: "Strict no result", input: "ZZZ-999", method: "exact", expected: "Shows the strict empty state without relaxing the query." },
  { category: "Boundaries & empty states", title: "One-character query", input: "A", method: "exact", expected: "Tests the default minimum-character threshold of 1." },
  { category: "Boundaries & empty states", title: "Very long stored value", input: "Global Enterprise", method: "starts", expected: "Tests highlighting, truncation, and selection with unusually long data." },
];

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.7"/><path d="m15.5 15.5 5 5"/></svg>;
}

function TuneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7M15 7h5M4 17h5M13 17h7M11 4v6M9 14v6"/></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

function ResultsSkeleton() {
  return (
    <div className="results-skeleton" role="status" aria-live="polite" aria-label="Loading customer results">
      <span className="sr-only">Loading customer results</span>
      {Array.from({ length: 7 }, (_, index) => (
        <div className="skeleton-row" aria-hidden="true" key={index}>
          <span className="skeleton-checkbox" />
          <span className={`skeleton-label skeleton-label-${(index % 4) + 1}`} />
        </div>
      ))}
    </div>
  );
}

function comparable(value: string, isCaseSensitive: boolean) {
  return isCaseSensitive ? value : value.toLocaleLowerCase();
}

function parseEntry(raw: string) {
  const trimmed = raw.trim();
  const forceExact = trimmed.startsWith("=");
  let value = forceExact ? trimmed.slice(1).trim() : trimmed;
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    value = value.slice(1, -1);
  }
  return { value, forceExact };
}

function isNegativeMethod(method: Method) {
  return method === "notExact" || method === "notStarts" || method === "notEnds" || method === "notContains";
}

function matchesCondition(value: string, rawEntry: string, method: Method, isCaseSensitive: boolean) {
  const parsed = parseEntry(rawEntry);
  const isWildcard = method === "all" && parsed.value.startsWith(":") && /[*?]/.test(parsed.value.slice(1));
  const searchValue = isWildcard ? parsed.value.slice(1) : parsed.value;
  const v = comparable(value, isCaseSensitive);
  const q = comparable(searchValue, isCaseSensitive);
  if (!q) return false;
  if (method === "all" && parsed.forceExact) return v === q;
  if (isWildcard) return wildcardMatch(value, searchValue, isCaseSensitive);
  if (method === "exact" || method === "notExact") return v === q;
  if (method === "starts" || method === "notStarts") return v.startsWith(q);
  if (method === "ends" || method === "notEnds") return v.endsWith(q);
  return v.includes(q);
}

function rank(value: string, query: string, isCaseSensitive: boolean) {
  const v = comparable(value, isCaseSensitive);
  const q = comparable(query, isCaseSensitive);
  if (v === q) return 0;
  if (v.startsWith(q)) return 1;
  if (v.includes(q) && !v.endsWith(q)) return 2;
  if (v.endsWith(q)) return 3;
  return 4;
}

function wildcardMatch(value: string, pattern: string, isCaseSensitive: boolean) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, isCaseSensitive ? "" : "i").test(value);
}

function getWildcardMeaning(query: string) {
  const pattern = query.startsWith(":") ? query.slice(1) : query;
  if (!/[*?]/.test(pattern)) return "";
  if (pattern.startsWith("*") && pattern.endsWith("*") && pattern.length > 2) return `Contains “${pattern.slice(1, -1)}”`;
  if (pattern.endsWith("*") && !pattern.startsWith("*")) return `Starts with “${pattern.slice(0, -1)}”`;
  if (pattern.startsWith("*") && !pattern.endsWith("*")) return `Ends with “${pattern.slice(1)}”`;
  return "Wildcard pattern";
}

function normalizeMultilineInput(value: string, keepTrailingRow = false) {
  const hasTrailingSeparator = /(?:,\s*|(?:\r?\n)\s*)$/.test(value);
  const values = value
    .split(/[,\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!values.length) return "";
  return `${values.join("\n")}${keepTrailingRow && hasTrailingSeparator ? "\n" : ""}`;
}

function Highlight({ value, queries, isCaseSensitive }: { value: string; queries: string[]; isCaseSensitive: boolean }) {
  const clean = queries
    .map((query) => query.replace(/^:/, "").replace(/[*?]/g, "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const match = clean
    .map((query) => ({ query, index: comparable(value, isCaseSensitive).indexOf(comparable(query, isCaseSensitive)) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index || b.query.length - a.query.length)[0];
  if (!match) return <>{value}</>;
  return <>{value.slice(0, match.index)}<mark>{value.slice(match.index, match.index + match.query.length)}</mark>{value.slice(match.index + match.query.length)}</>;
}

export default function Home() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [method, setMethod] = useState<Method>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(true);
  const [hasMultiValue, setHasMultiValue] = useState(true);
  const [inputLayout, setInputLayout] = useState<InputLayout>("multiline");
  const [maxInputRows, setMaxInputRows] = useState(7);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [datasetMode, setDatasetMode] = useState<DatasetMode>("local");
  const [minSearchCharacters, setMinSearchCharacters] = useState(1);
  const [debounceMs, setDebounceMs] = useState(0);
  const [doesSearchPersist, setDoesSearchPersist] = useState(true);
  const [executedQuery, setExecutedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [copiedTest, setCopiedTest] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [wildcardInputError, setWildcardInputError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const current = methods.find((item) => item.value === method)!;
  const methodTooltip = `Match method: ${current.label}`;
  const multipleValues = query.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
  const hasWildcard = multipleValues.some((entry) => {
    const value = parseEntry(entry).value;
    return value.startsWith(":") && /[*?]/.test(value.slice(1));
  });
  const hasIncompleteWildcard = multipleValues.some((entry) => parseEntry(entry).value === ":");
  const searchableValues = multipleValues.filter((item) => parseEntry(item).value.replace(/[*?]/g, "").length >= minSearchCharacters);
  const needsMoreCharacters = query.trim().length > 0 && searchableValues.length === 0;
  const supportsMultiple = hasMultiValue;
  const inputError = wildcardInputError || (multipleValues.length > 1 && !supportsMultiple
    ? "Multi-value input is disabled for this search."
    : hasIncompleteWildcard
      ? "Add a wildcard pattern after : using * or ?."
    : hasWildcard && method !== "all"
      ? "Wildcards are available only with All matches."
      : "");

  useEffect(() => {
    if (!query.trim() || inputError || needsMoreCharacters) {
      setExecutedQuery("");
      setIsSearching(false);
      return;
    }

    const wait = datasetMode === "local" ? debounceMs : Math.max(0, debounceMs);
    setIsSearching(wait > 0);
    const timer = window.setTimeout(() => {
      setExecutedQuery(query);
      setIsSearching(false);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [query, inputError, needsMoreCharacters, datasetMode, debounceMs]);

  const results = useMemo(() => {
    if (!query.trim()) return customers;
    if (!executedQuery.trim() || inputError || needsMoreCharacters) return [];
    const executedValues = executedQuery.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
    const entries = (supportsMultiple ? executedValues : [executedQuery.trim()])
      .filter((item) => parseEntry(item).value.replace(/[*?]/g, "").length >= minSearchCharacters);
    const negative = isNegativeMethod(method);
    return customers
      .filter((value) => negative
        ? entries.every((entry) => !matchesCondition(value, entry, method, isCaseSensitive))
        : entries.some((entry) => matchesCondition(value, entry, method, isCaseSensitive)))
      .sort((a, b) => rank(a, parseEntry(entries[0]).value, isCaseSensitive) - rank(b, parseEntry(entries[0]).value, isCaseSensitive) || a.localeCompare(b));
  }, [query, executedQuery, method, inputError, supportsMultiple, isCaseSensitive, needsMoreCharacters, minSearchCharacters]);

  function chooseMethod(next: Method) {
    setMethod(next);
    setMenuOpen(false);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closePanel() {
    setPanelOpen(false);
    setMenuOpen(false);
    if (!doesSearchPersist) {
      setQuery("");
      setExecutedQuery("");
    }
  }

  const compactValue = multipleValues.length > 1
    ? `${multipleValues[0]}, +${multipleValues.length - 1}`
    : query;
  const visibleInputValue = !inputFocused && multipleValues.length > 1 ? compactValue : query;
  const inputRows = inputLayout === "multiline" && inputFocused
    ? Math.min(maxInputRows, Math.max(1, query.split("\n").length))
    : 1;
  const exactResults = query && method === "all"
    ? results.filter((value) => multipleValues.some((entry) => comparable(value, isCaseSensitive) === comparable(parseEntry(entry).value, isCaseSensitive)))
    : [];
  const otherResults = exactResults.length
    ? results.filter((value) => !exactResults.includes(value))
    : results;

  function updateQuery(nextValue: string) {
    const activatesWildcard = nextValue.trimStart().startsWith(":") && /[*?]/.test(nextValue.trimStart().slice(1));
    if (activatesWildcard && /[,\n\r]/.test(nextValue)) {
      setWildcardInputError("Wildcard search supports one value at a time. Remove the comma or line break, then search one wildcard pattern.");
      return;
    }

    setWildcardInputError("");
    if (!hasMultiValue || inputLayout === "compact") {
      setQuery(nextValue.replace(/\n+/g, ", "));
      return;
    }

    setQuery(normalizeMultilineInput(nextValue, true));
  }

  function pasteValues(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    const values = pasted.split(/[,\r\n]+/).map((value) => value.trim()).filter(Boolean);
    const containsSeparators = /[,\r\n]/.test(pasted);
    const combinedValue = `${query}${pasted}`.trimStart();
    const activatesWildcard = combinedValue.startsWith(":") && /[*?]/.test(combinedValue.slice(1));
    if (activatesWildcard && (containsSeparators || values.length > 1)) {
      event.preventDefault();
      setWildcardInputError("Wildcard search supports one value at a time. Remove the comma or line break, then search one wildcard pattern.");
      return;
    }
    if (!containsSeparators || !hasMultiValue) return;

    event.preventDefault();
    setWildcardInputError("");
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? query.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const before = query.slice(0, selectionStart);
    const after = query.slice(selectionEnd);
    const inserted = values.join(inputLayout === "multiline" ? "\n" : ", ");
    const next = `${before}${inserted}${after}`;

    setQuery(inputLayout === "multiline"
      ? normalizeMultilineInput(next)
      : next.replace(/\n+/g, ", "));

    requestAnimationFrame(() => {
      const nextInput = inputRef.current;
      if (nextInput) {
        const nextCaret = inputLayout === "multiline"
          ? normalizeMultilineInput(`${before}${inserted}`).length
          : `${before}${inserted}`.replace(/\n+/g, ", ").length;
        nextInput.selectionStart = nextInput.selectionEnd = nextCaret;
      }
    });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    const activeValue = query.trimStart();
    const isWildcardActive = activeValue.startsWith(":") && /[*?]/.test(activeValue.slice(1));
    if (!isWildcardActive) return;

    event.preventDefault();
    setWildcardInputError("Wildcard search supports one value at a time. Remove the comma or line break, then search one wildcard pattern.");
  }

  function tryTestCase(test: (typeof testCases)[number]) {
    setMethod(test.method);
    setIsCaseSensitive(Boolean(test.caseSensitive));
    const normalized = test.input
      .split(/[,\r\n]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const isMultiValueWildcard = normalized.length > 1 && normalized.some((value) => value.startsWith(":") && /[*?]/.test(value.slice(1)));
    setQuery(isMultiValueWildcard
      ? normalized[0] ?? ""
      : hasMultiValue
        ? normalized.join(inputLayout === "multiline" ? "\n" : ", ")
        : normalized[0] ?? "");
    setWildcardInputError(isMultiValueWildcard
      ? "Wildcard search supports one value at a time. Remove the comma or line break, then search one wildcard pattern."
      : "");
    setMenuOpen(false);
    setPanelOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function chooseDatasetMode(next: DatasetMode) {
    setDatasetMode(next);
    setDebounceMs(next === "local" ? 0 : 200);
  }

  async function copyTestCase(test: (typeof testCases)[number]) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(test.input);
        setCopiedTest(test.title);
        window.setTimeout(() => setCopiedTest(""), 1400);
      }
    } catch {
      // Clipboard access can be unavailable in non-secure preview contexts.
    } finally {
      setMethod(test.method);
      setIsCaseSensitive(Boolean(test.caseSensitive));
      setQuery("");
      setExecutedQuery("");
      setMenuOpen(false);
      setPanelOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <main className="playground">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">A</span><span>ARVO</span></div>
        <div className="page-title"><strong>Advance Search</strong><span>Interactive playground</span></div>
        <div className="status"><span></span>Prototype</div>
      </header>

      <section className="hero" aria-labelledby="demo-title">
        <div className="eyebrow">ARVO ADVANCE SEARCH</div>
        <h1 id="demo-title">Find the right record, your way.</h1>
        <p>Try strict discovery with no typo tolerance, exact matching, positional matching, wildcards, and multiple values.</p>

        <div className="search-stage">
          <div className={`hero-search ${panelOpen ? "is-active" : ""}`}>
            <SearchIcon />
            <button className="search-launch" onClick={() => setPanelOpen(true)}>
              {query || "Search records"}
            </button>
            <span className="search-divider" />
            <button className={`icon-button ${method !== "all" ? "is-modified" : ""}`} aria-label={methodTooltip} title={methodTooltip} onClick={() => { setPanelOpen(true); setMenuOpen(!menuOpen); }}>
              <TuneIcon />
              <span className="control-tooltip" role="tooltip">{methodTooltip}</span>
              {method !== "all" && <span className="method-dot" />}
            </button>
          </div>
          <div className="stage-note">Select the search field to open the Customer member panel</div>
        </div>
      </section>

      <section className="rules" aria-label="Supported search behaviors">
        <article><span>01</span><div><strong>All matches</strong><p>Broad discovery with strongest matches ranked first.</p></div></article>
        <article><span>02</span><div><strong>Exact matches</strong><p>Strict lookup for IDs, SKUs, and complete values.</p></div></article>
        <article><span>03</span><div><strong>Position matching</strong><p>Contains, starts with, or ends with one value.</p></div></article>
      </section>

      <section className="configurator" aria-labelledby="configurator-title">
        <div>
          <div className="eyebrow">PLAYGROUND SETTINGS</div>
          <h2 id="configurator-title">Configurator</h2>
          <p>Developer-facing controls for testing the search component. These settings are not shown to end users.</p>
        </div>
        <div className="multi-value-settings" role="group" aria-labelledby="multi-value-heading">
        <div className="config-field">
          <strong>Multi-value input</strong>
          <span>Applies to every positive and negative match method</span>
          <button
            className="switch-row"
            role="switch"
            aria-checked={hasMultiValue}
            onClick={() => setHasMultiValue(!hasMultiValue)}
          >
            <span className="switch-track"><span /></span>
            <span>{hasMultiValue ? "On" : "Off"}</span>
          </button>
        </div>
        <div className="config-field">
          <strong id="multi-value-heading">Multi-value mode</strong>
          <span>Controls how multiple values are displayed while editing</span>
          <div className="segmented" aria-label="Multi-value input layout">
            <button disabled={!hasMultiValue} aria-pressed={inputLayout === "compact"} onClick={() => setInputLayout("compact")}>Compact</button>
            <button disabled={!hasMultiValue} aria-pressed={inputLayout === "multiline"} onClick={() => setInputLayout("multiline")}>Non-compact</button>
          </div>
        </div>
        <label className="config-number">
          <strong>Maximum expanded rows</strong>
          <span>Scroll begins after this row</span>
          <input
            type="number"
            min="3"
            max="12"
            value={maxInputRows}
            disabled={!hasMultiValue || inputLayout === "compact"}
            onChange={(event) => setMaxInputRows(Math.min(12, Math.max(3, Number(event.target.value) || 3)))}
          />
        </label>
        </div>
        <div className="config-field">
          <strong>Case-sensitive matching</strong>
          <span>Applies independently to every match method</span>
          <button
            className="switch-row"
            role="switch"
            aria-checked={isCaseSensitive}
            onClick={() => setIsCaseSensitive(!isCaseSensitive)}
          >
            <span className="switch-track"><span /></span>
            <span>{isCaseSensitive ? "On · ACME ≠ Acme" : "Off · ACME = Acme"}</span>
          </button>
        </div>
        <div className="config-field search-execution">
          <strong>Search execution</strong>
          <span>Local or remote/high-cardinality data</span>
          <div className="segmented" aria-label="Dataset mode">
            <button aria-pressed={datasetMode === "local"} onClick={() => chooseDatasetMode("local")}>Local</button>
            <button aria-pressed={datasetMode === "remote"} onClick={() => chooseDatasetMode("remote")}>Remote</button>
          </div>
        </div>
        <div className="config-field">
          <strong>Search persists</strong>
          <span>Restores the last uncleared search during this session</span>
          <button
            className="switch-row"
            role="switch"
            aria-checked={doesSearchPersist}
            onClick={() => setDoesSearchPersist(!doesSearchPersist)}
          >
            <span className="switch-track"><span /></span>
            <span>{doesSearchPersist ? "On · Restore on reopen" : "Off · Start empty"}</span>
          </button>
        </div>
        <label className="config-number">
          <strong>Minimum characters</strong>
          <span>Required before search begins</span>
          <input
            type="number"
            min="1"
            max="10"
            value={minSearchCharacters}
            onChange={(event) => setMinSearchCharacters(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
        <label className="config-number">
          <strong>Debounce</strong>
          <span>Delay before execution (ms)</span>
          <input
            type="number"
            min="0"
            max="1000"
            step="50"
            value={debounceMs}
            onChange={(event) => setDebounceMs(Math.min(1000, Math.max(0, Number(event.target.value) || 0)))}
          />
        </label>
      </section>

      <section className="test-cases" aria-labelledby="test-cases-title">
        <div className="test-heading">
          <div>
            <div className="eyebrow">TEST DATA</div>
          <h2 id="test-cases-title">Advance Search test cases</h2>
          </div>
          <p>Copy an input or open it directly in the Customer panel. “Try” also selects the required match method and case setting.</p>
        </div>
        <div className="test-grid">
          {testCases.map((test) => <article className="test-card" key={test.title}>
            <div className="test-card-head">
              <div>
                <span className="test-category">{test.category}</span>
                <strong>{test.title}</strong>
              </div>
              <span className="test-method">{methods.find((item) => item.value === test.method)?.label}</span>
            </div>
            <pre>{test.input.replace(/\n/g, "\n")}</pre>
            <p>{test.expected}</p>
            <div className="test-actions">
              <button onClick={() => copyTestCase(test)}>{copiedTest === test.title ? "Copied" : "Copy"}</button>
              <button className="try" onClick={() => tryTestCase(test)}>Try in panel</button>
            </div>
          </article>)}
        </div>
      </section>

      {panelOpen && <aside className="member-panel" role="complementary" aria-labelledby="panel-title">
          <div className="panel-header">
            <div><span className="panel-kicker">DIMENSION</span><h2 id="panel-title">Customer</h2></div>
            <button className="plain-icon" aria-label="Close customer search" onClick={closePanel}><CloseIcon /></button>
          </div>

          {showHelp && <div className="help">
            <span className="info">i</span>
            <p>Hold <kbd>⌥</kbd> + Return or click to exclude members. Excluded members are filtered out.</p>
            <button aria-label="Dismiss search help" onClick={() => setShowHelp(false)}><CloseIcon /></button>
          </div>}

          <div className="panel-search-wrap">
            <div className={`panel-search ${query ? "has-query" : ""} ${!hasMultiValue || inputLayout === "compact" ? "is-compact" : ""} ${inputError ? "has-error" : ""}`}>
              <SearchIcon />
              <textarea
                ref={inputRef}
                autoFocus
                rows={inputRows}
                style={{ maxHeight: hasMultiValue && inputLayout === "multiline" ? `${maxInputRows * 24 + 24}px` : "50px" }}
                value={visibleInputValue}
                onChange={(e) => updateQuery(e.target.value)}
                onPaste={pasteValues}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={method === "all" ? "Search or enter values" : `Search with ${current.label.toLowerCase()}`}
                aria-label={`Search customers using ${current.label}`}
                aria-describedby={inputError ? "search-error" : undefined}
              />
              {query && <button aria-label="Clear search" onClick={() => { setQuery(""); setWildcardInputError(""); }}>×</button>}
              {query.trim() && results.length > 0 && !isSearching && !needsMoreCharacters && !inputError && <span
                  className="selection-counter"
                  aria-label={`${results.length} matching results out of ${customers.length} total values`}
                  title={`${results.length} matching results / ${customers.length} total values`}
                >
                  <span className="selection-counter-current">{results.length}</span>
                  <span aria-hidden="true">/</span>
                  <span>{customers.length}</span>
                </span>}
              <button className={`tune-small ${menuOpen ? "is-open" : ""}`} aria-label={methodTooltip} title={methodTooltip} onClick={() => setMenuOpen(!menuOpen)}>
                <TuneIcon />
                <span className="control-tooltip" role="tooltip">{methodTooltip}</span>
              </button>
            </div>

            {menuOpen && <div className="method-menu" role="menu" aria-label="Match method">
              <div className="menu-title">Match method</div>
              {["Match scope", "Match conditions", "Match by position"].map((group) => <div className="menu-group" key={group}>
                <div className="group-label">{group}</div>
                {methods.filter((item) => item.group === group).map((item) => <button role="menuitemradio" aria-checked={method === item.value} key={item.value} onClick={() => chooseMethod(item.value)}>
                  <span className={`radio ${method === item.value ? "checked" : ""}`} />
                  <span><strong>{item.label}</strong><small>{item.hint}</small></span>
                </button>)}
              </div>)}
              <div className="menu-foot">Match method applies to this Customer search.</div>
            </div>}

            {inputError ? <div className="input-message error" id="search-error">{inputError}</div> :
              query && hasWildcard && method === "all" ? <div className="input-message"><span className="spark">✦</span> Interpreted as: {getWildcardMeaning(query)}</div> :
              query && multipleValues.length > 1 ? <div className="input-message">{multipleValues.length} values detected · {isNegativeMethod(method) ? "All exclusions apply" : "Matches any value"}</div> :
              <div className="input-message muted">{method === "all" ? "No typo tolerance · Use =value for inline exact · Type : to use * or ? wildcards" : isNegativeMethod(method) ? "Negative match · No typo tolerance · Supports multiple values" : "No typo tolerance · Supports multiple values"}</div>}
          </div>

          <div className="result-meta">
            <span>{isSearching ? "Searching…" : query ? `${results.length} matching customer${results.length === 1 ? "" : "s"}` : `${customers.length} customers`}</span>
            {query && <span className="method-label">{current.label}</span>}
          </div>

          <div className="results" role="listbox" aria-multiselectable="true" aria-busy={datasetMode === "remote" && isSearching}>
            {datasetMode === "remote" && isSearching ? <ResultsSkeleton /> :
            isSearching ? <div className="empty" role="status"><SearchIcon /><strong>Searching customers…</strong><p>Keeping your input while the latest results load.</p></div> :
            needsMoreCharacters ? <div className="empty" role="status"><SearchIcon /><strong>Keep typing</strong><p>Enter at least {minSearchCharacters} character{minSearchCharacters === 1 ? "" : "s"} to search.</p></div> :
            results.length ? <>
              {exactResults.length > 0 && <div className="result-group-label">Exact match</div>}
              {[...exactResults, ...otherResults].map((customer, index) => {
              const checked = selected.includes(customer);
              const startsOthers = exactResults.length > 0 && index === exactResults.length;
              return <button className={`result-row ${checked ? "selected" : ""} ${startsOthers ? "starts-others" : ""}`} role="option" aria-selected={checked} key={customer} onClick={(e) => {
                if (e.altKey) return;
                setSelected(checked ? selected.filter((v) => v !== customer) : [...selected, customer]);
              }} onContextMenu={(e) => e.preventDefault()}>
                <span className="checkbox">{checked && "✓"}</span>
                <span><Highlight value={customer} queries={isNegativeMethod(method) ? [] : (supportsMultiple ? multipleValues.map((entry) => parseEntry(entry).value) : [parseEntry(query).value])} isCaseSensitive={isCaseSensitive} /></span>
              </button>;
            })}</> : <div className="empty"><SearchIcon /><strong>No matching customers</strong><p>No value matches this spelling. Check the query or choose a broader match method.</p><button onClick={() => { setMethod("all"); setQuery(""); }}>Clear search</button></div>}
          </div>

          <footer className="panel-footer">
            <div><strong>{selected.length}</strong> selected</div>
            <button className="reset" disabled={!selected.length} onClick={() => setSelected([])}>↶ Reset</button>
            <button className="apply" disabled={!selected.length} onClick={closePanel}>Apply selection</button>
          </footer>
      </aside>}
    </main>
  );
}
