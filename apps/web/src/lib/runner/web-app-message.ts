export const WEB_APP_LINK_VARIABLE = "web_app_link";

export const DEFAULT_WEB_APP_MESSAGE =
  "Seu plano de corrida esta pronto. Abra aqui: {{web_app_link}}";
export const DEFAULT_WEB_APP_CTA_BODY =
  "Seu plano de corrida esta pronto. Toque no botao abaixo para abrir.";
export const DEFAULT_WEB_APP_CTA_BUTTON_TEXT = "Abrir meu plano";

export function interpolateWebAppMessageVariables(
  text: string,
  variables: Record<string, string>
) {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => variables[key] || `{{${key}}}`
  );
}

export function buildRunnerWebAppMessage(params: {
  template?: string | null;
  link: string;
  variables?: Record<string, string>;
}) {
  const variables = {
    ...(params.variables || {}),
    [WEB_APP_LINK_VARIABLE]: params.link,
  };
  const template = params.template?.trim() || DEFAULT_WEB_APP_MESSAGE;
  const withLink = template.includes(`{{${WEB_APP_LINK_VARIABLE}}}`)
    ? template
    : `${template}\n\n{{${WEB_APP_LINK_VARIABLE}}}`;

  return interpolateWebAppMessageVariables(withLink, variables);
}

export function buildRunnerWebAppCtaBodyText(params: {
  template?: string | null;
  variables?: Record<string, string>;
}) {
  const template = params.template?.trim();
  const source =
    !template || template === DEFAULT_WEB_APP_MESSAGE
      ? DEFAULT_WEB_APP_CTA_BODY
      : template;
  const withoutLinkPlaceholder = source
    .split(/\r?\n/)
    .map((line) => line.replace(/\{\{web_app_link\}\}/g, "").trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n")
    .trim();

  return interpolateWebAppMessageVariables(
    withoutLinkPlaceholder || DEFAULT_WEB_APP_CTA_BODY,
    params.variables || {}
  );
}
