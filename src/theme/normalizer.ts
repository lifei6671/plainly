const normalizeHeading = (heading: Element) => {
  const children = Array.from(heading.children);
  if (
    heading.childNodes.length !== 3 ||
    children.length !== 3 ||
    !children[0].classList.contains("prefix") ||
    !children[1].classList.contains("content") ||
    !children[2].classList.contains("suffix")
  ) {
    return;
  }

  const content = children[1];
  const inlineNodes = Array.from(content.childNodes);
  while (heading.firstChild) {
    heading.removeChild(heading.firstChild);
  }
  inlineNodes.forEach((node) => heading.appendChild(node));
};

const unwrapListItemSections = (listItem: Element) => {
  const children = Array.from(listItem.children);
  const section = children.length === 1 && children[0].tagName === "SECTION" ? children[0] : undefined;
  if (!section) {
    return;
  }

  const hasUnexpectedChild = Array.from(listItem.childNodes).some(
    (node) =>
      node !== section &&
      node.nodeType !== Node.COMMENT_NODE &&
      !(node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()),
  );
  if (hasUnexpectedChild) {
    return;
  }

  while (section.firstChild) {
    listItem.insertBefore(section.firstChild, section);
  }
  listItem.removeChild(section);
};

export const normalizePlainlyDom = (root: Element) => {
  Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).forEach(normalizeHeading);
  Array.from(root.querySelectorAll("li")).forEach(unwrapListItemSections);
  return root;
};

export const normalizePlainlyHtml = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  normalizePlainlyDom(root);
  return root.innerHTML;
};
