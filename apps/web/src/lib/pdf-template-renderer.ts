type TemplateScope = Record<string, unknown> & {
  this?: unknown;
  parent?: unknown;
  "@index"?: number;
};

const EACH_OPEN = "{{#each";
const EACH_CLOSE = "{{/each}}";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPathValue(source: unknown, path: string): unknown {
  if (!path) return source;

  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, source);
}

function resolveExpression(
  expression: string,
  scope: TemplateScope,
  rootScope: TemplateScope
): unknown {
  const trimmed = expression.trim();

  if (!trimmed) return "";
  if (trimmed === "." || trimmed === "this") return scope.this ?? scope;
  if (trimmed === "@index") return scope["@index"];

  if (trimmed.startsWith("this.")) {
    return getPathValue(scope.this, trimmed.slice("this.".length));
  }

  const localValue = getPathValue(scope, trimmed);
  if (localValue !== undefined) return localValue;

  return getPathValue(rootScope, trimmed);
}

function stringifyTemplateValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return escapeHtml(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return escapeHtml(JSON.stringify(value, null, 2));
}

function replacePlaceholders(
  template: string,
  scope: TemplateScope,
  rootScope: TemplateScope
): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (fullMatch, rawExpression) => {
    const expression = String(rawExpression).trim();

    if (!expression || expression.startsWith("#") || expression.startsWith("/")) {
      return fullMatch;
    }

    return stringifyTemplateValue(resolveExpression(expression, scope, rootScope));
  });
}

function findMatchingEachClose(template: string, startAt: number): number {
  let cursor = startAt;
  let depth = 1;

  while (cursor < template.length) {
    const nextOpen = template.indexOf(EACH_OPEN, cursor);
    const nextClose = template.indexOf(EACH_CLOSE, cursor);

    if (nextClose === -1) return -1;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + EACH_OPEN.length;
      continue;
    }

    depth -= 1;
    if (depth === 0) return nextClose;
    cursor = nextClose + EACH_CLOSE.length;
  }

  return -1;
}

function createLoopScope(
  item: unknown,
  index: number,
  parentScope: TemplateScope
): TemplateScope {
  const nextScope = isObjectRecord(item) ? { ...item } : { value: item };

  return {
    ...nextScope,
    this: item,
    parent: parentScope.this ?? parentScope,
    "@index": index + 1,
  };
}

function renderTemplateSection(
  template: string,
  scope: TemplateScope,
  rootScope: TemplateScope
): string {
  let cursor = 0;
  let output = "";

  while (cursor < template.length) {
    const eachStart = template.indexOf(EACH_OPEN, cursor);

    if (eachStart === -1) {
      output += replacePlaceholders(template.slice(cursor), scope, rootScope);
      break;
    }

    output += replacePlaceholders(template.slice(cursor, eachStart), scope, rootScope);

    const openTagEnd = template.indexOf("}}", eachStart);
    if (openTagEnd === -1) {
      output += template.slice(eachStart);
      break;
    }

    const expression = template
      .slice(eachStart + EACH_OPEN.length, openTagEnd)
      .trim();

    const closeTagStart = findMatchingEachClose(template, openTagEnd + 2);
    if (closeTagStart === -1) {
      output += template.slice(eachStart);
      break;
    }

    const innerTemplate = template.slice(openTagEnd + 2, closeTagStart);
    const collection = resolveExpression(expression, scope, rootScope);

    if (Array.isArray(collection)) {
      output += collection
        .map((item, index) =>
          renderTemplateSection(innerTemplate, createLoopScope(item, index, scope), rootScope)
        )
        .join("");
    }

    cursor = closeTagStart + EACH_CLOSE.length;
  }

  return output;
}

export function renderPdfTemplateHtml(params: {
  templateHtml: string;
  flowVariables: Record<string, string>;
  aiData: Record<string, unknown>;
}): string {
  const rootScope: TemplateScope = {
    ...params.flowVariables,
    ai: params.aiData,
    ai_json: JSON.stringify(params.aiData, null, 2),
    this: {
      ...params.flowVariables,
      ai: params.aiData,
    },
  };

  return renderTemplateSection(params.templateHtml, rootScope, rootScope);
}
