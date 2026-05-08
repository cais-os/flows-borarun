export const WEB_APP_LINK_VARIABLE = "web_app_link";

export const DEFAULT_WEB_APP_MESSAGE =
  "Seu plano de corrida esta pronto. Abra aqui: {{web_app_link}}";

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
