export type ComponentBlockTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "blockquote" | "ul" | "ol" | "hr" | "figure" | "table";

export type ComponentRenderContext = Readonly<{
  document: Document;
  blockIndex: number;
  tagIndex: number;
  /**
   * The 1-based index of the current H2. For every other block this is the
   * number of preceding top-level H2 blocks, so content before the first H2 is 0.
   */
  heading2Index: number;
}>;

export type ComponentBlockRenderer = (sourceElement: Element, context: ComponentRenderContext) => Node | void;

export type ComponentRendererMap = Partial<Record<ComponentBlockTag, ComponentBlockRenderer>>;
