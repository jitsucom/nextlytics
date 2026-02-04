export type IntegrationType = "backend" | "plugin";

export type IntegrationTag =
  | "stable"
  | "beta"
  | "coming-soon"
  | "client-side"
  | "server-side"
  | "hybrid";

export type IntegrationMeta = {
  name: string;
  slug: string;
  description: string;
  type: IntegrationType;
  tags: IntegrationTag[];
  logo: string;
  /** Inline SVG string for use in OG images and other places where fetch isn't available */
  logoSvg?: string;
  logoAlt?: string;
  officialDocs?: string;
  /** Full code snippet for integration-specific pages */
  snippet?: string;
  /** Backend import line for configSnippet() */
  backendImport?: string;
  /** Backend config (the array element inside backends: []) */
  backendConfig?: string;
};
