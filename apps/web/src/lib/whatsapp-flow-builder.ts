import type { WhatsAppFlowScreen, WhatsAppFlowField } from "@/types/node-data";

/**
 * Convert BoraRun builder screens into the WhatsApp Flows JSON format
 * expected by the Meta Graph API (flow JSON v6.0).
 *
 * Reference: https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson
 */

type FlowJsonComponent = {
  type: string;
  name?: string;
  label?: string;
  required?: boolean;
  "input-type"?: string;
  "helper-text"?: string;
  "data-source"?: Array<{ id: string; title: string }>;
  "on-click-action"?: {
    name: string;
    next?: { type: string; name: string };
    payload?: Record<string, string>;
  };
};

type FlowJsonScreen = {
  id: string;
  title: string;
  data?: Record<string, unknown>;
  terminal?: boolean;
  layout: {
    type: "SingleColumnLayout";
    children: FlowJsonComponent[];
  };
};

type FlowJson = {
  version: string;
  screens: FlowJsonScreen[];
};

function mapFieldType(field: WhatsAppFlowField): string {
  switch (field.type) {
    case "TextInput":
      return "TextInput";
    case "TextArea":
      return "TextArea";
    case "Dropdown":
      return "Dropdown";
    case "RadioButtonsGroup":
      return "RadioButtonsGroup";
    case "CheckboxGroup":
      return "CheckboxGroup";
    case "DatePicker":
      return "DatePicker";
    case "OptIn":
      return "OptIn";
    default:
      return "TextInput";
  }
}

function mapInputType(
  field: WhatsAppFlowField
): string | undefined {
  if (field.type !== "TextInput") return undefined;
  return field.inputType || "text";
}

function buildFieldComponent(field: WhatsAppFlowField): FlowJsonComponent {
  const component: FlowJsonComponent = {
    type: mapFieldType(field),
    name: field.name || field.id,
    label: field.label || field.name || "Campo",
    required: field.required,
  };

  const inputType = mapInputType(field);
  if (inputType) {
    component["input-type"] = inputType;
  }

  if (field.helperText) {
    component["helper-text"] = field.helperText;
  }

  if (
    field.options &&
    field.options.length > 0 &&
    (field.type === "Dropdown" ||
      field.type === "RadioButtonsGroup" ||
      field.type === "CheckboxGroup")
  ) {
    component["data-source"] = field.options.map((opt) => ({
      id: opt.id,
      title: opt.title,
    }));
  }

  return component;
}

/**
 * Build the complete WhatsApp Flow JSON from builder screens.
 *
 * Each screen becomes a Flow screen. The last screen submits (complete action),
 * intermediate screens navigate to the next screen via a "Continue" footer.
 */
export function buildWhatsAppFlowJson(
  screens: WhatsAppFlowScreen[]
): FlowJson {
  if (screens.length === 0) {
    throw new Error("At least one screen is required");
  }

  const flowScreens: FlowJsonScreen[] = screens.map((screen, idx) => {
    const isLast = idx === screens.length - 1;
    const children: FlowJsonComponent[] = [];

    // Add field components
    for (const field of screen.fields) {
      children.push(buildFieldComponent(field));
    }

    // Build the payload — all field names from ALL screens up to and including this one
    const allFieldsSoFar = screens
      .slice(0, idx + 1)
      .flatMap((s) => s.fields);

    const payload: Record<string, string> = {};
    for (const f of allFieldsSoFar) {
      const name = f.name || f.id;
      payload[name] = `\${form.${name}}`;
    }

    if (isLast) {
      // Last screen — complete action submits the data
      children.push({
        type: "Footer",
        label: "Enviar",
        "on-click-action": {
          name: "complete",
          payload,
        },
      });
    } else {
      // Intermediate screen — navigate to next
      const nextScreen = screens[idx + 1]!;
      children.push({
        type: "Footer",
        label: "Continuar",
        "on-click-action": {
          name: "navigate",
          next: { type: "screen", name: nextScreen.id },
          payload,
        },
      });
    }

    return {
      id: screen.id,
      title: screen.title || `Tela ${idx + 1}`,
      ...(isLast ? { terminal: true } : {}),
      layout: {
        type: "SingleColumnLayout" as const,
        children,
      },
    };
  });

  // Add a SUCCESS_SCREEN for the completion confirmation
  flowScreens.push({
    id: "SUCCESS_SCREEN",
    title: "Obrigado!",
    terminal: true,
    layout: {
      type: "SingleColumnLayout",
      children: [
        {
          type: "TextHeading",
          label: "Recebemos suas respostas!",
        } as FlowJsonComponent,
        {
          type: "TextBody",
          label: "Suas informacoes foram salvas. Pode voltar ao chat.",
        } as FlowJsonComponent,
      ],
    },
  });

  return {
    version: "6.0",
    screens: flowScreens,
  };
}

/**
 * Create a deterministic hash of the screens config to detect changes.
 */
export function hashScreensConfig(screens: WhatsAppFlowScreen[]): string {
  const json = JSON.stringify(
    screens.map((s) => ({
      title: s.title,
      fields: s.fields.map((f) => ({
        name: f.name,
        type: f.type,
        label: f.label,
        required: f.required,
        options: f.options,
      })),
    }))
  );

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
