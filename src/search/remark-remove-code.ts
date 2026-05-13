/**
 * remark 插件：删除 fenced code block 与 inline code
 * 目标：代码块很多且不希望被索引
 */
export default function remarkRemoveCode() {
  return (tree) => {
    const walk = (node, parent) => {
      if (!node) return;

      // fenced code block: ``` ```
      if (node.type === "code" && parent?.children) {
        parent.children = parent.children.filter((n) => n !== node);
        return;
      }

      // inline code: `xxx`
      if (node.type === "inlineCode") {
        node.type = "text";
        node.value = "";
        delete node.children;
        return;
      }

      if (Array.isArray(node.children)) {
        // 复制数组，避免边遍历边修改的坑
        const children = [...node.children];
        for (const child of children) walk(child, node);
      }
    };

    walk(tree, null);
  };
}
