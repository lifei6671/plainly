export type TemplateSection = Readonly<Record<string, string>>;

export type TemplateRegistry = Readonly<{
  basic: string;
  style: TemplateSection;
  code: TemplateSection;
  content: string;
}>;
