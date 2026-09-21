export const moveChildren = <T extends Node>(source: Node, target: T): T => {
  while (source.firstChild) {
    target.appendChild(source.firstChild);
  }
  return target;
};
