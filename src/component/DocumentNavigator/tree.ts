import {Category, DocumentMeta} from "../../data/store";

export type DocumentTreeCategory = {
  category: Category | null;
  documents: DocumentMeta[];
  isUncategorized: boolean;
};

export const buildDocumentTree = (categories: Category[], documents: DocumentMeta[]): DocumentTreeCategory[] => {
  const categoryIds = new Set(categories.map((category) => category.category_id));
  const documentsByCategory = new Map<string, DocumentMeta[]>();
  const uncategorized: DocumentMeta[] = [];
  const seenDocumentIds = new Set<string>();

  documents.forEach((document) => {
    if (!document || !document.document_id || seenDocumentIds.has(document.document_id)) return;
    seenDocumentIds.add(document.document_id);
    if (!categoryIds.has(document.category_id)) {
      uncategorized.push(document);
      return;
    }
    const items = documentsByCategory.get(document.category_id) || [];
    items.push(document);
    documentsByCategory.set(document.category_id, items);
  });

  const tree = categories.map((category) => ({
    category,
    documents: documentsByCategory.get(category.category_id) || [],
    isUncategorized: false,
  }));

  if (uncategorized.length) {
    tree.push({category: null, documents: uncategorized, isUncategorized: true});
  }

  return tree;
};
