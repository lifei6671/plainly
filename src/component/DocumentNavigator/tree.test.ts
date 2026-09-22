import {buildDocumentTree} from "./tree";

declare const it: any;
declare const expect: any;

const categories = [
  {id: 1, category_id: "category-a", name: "目录 A", createdAt: 1, updatedAt: 1},
  {id: 2, category_id: "category-b", name: "目录 B", createdAt: 1, updatedAt: 1},
];

it("groups documents by category and keeps unknown categories under uncategorized", () => {
  const documents = [
    {document_id: "document-a", name: "A", category_id: "category-a", createdAt: 1, updatedAt: 1},
    {document_id: "document-b", name: "B", category_id: "missing", createdAt: 1, updatedAt: 1},
    {document_id: "document-c", name: "C", category_id: "category-b", createdAt: 1, updatedAt: 1},
    {document_id: "document-a", name: "A duplicate", category_id: "category-a", createdAt: 1, updatedAt: 1},
  ];

  const tree = buildDocumentTree(categories, documents);

  expect(tree.map((item) => item.category && item.category.category_id)).toEqual(["category-a", "category-b", null]);
  expect(tree[0].documents.map((item) => item.document_id)).toEqual(["document-a"]);
  expect(tree[1].documents.map((item) => item.document_id)).toEqual(["document-c"]);
  expect(tree[2].isUncategorized).toBe(true);
  expect(tree[2].documents.map((item) => item.document_id)).toEqual(["document-b"]);
  expect(tree.flatMap((item) => item.documents).map((item) => item.document_id)).toEqual([
    "document-a",
    "document-c",
    "document-b",
  ]);
});

it("keeps categories even when they have no documents", () => {
  const tree = buildDocumentTree(categories, []);

  expect(tree).toHaveLength(2);
  expect(tree.map((item) => item.documents)).toEqual([[], []]);
});
