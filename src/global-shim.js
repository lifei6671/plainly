import enquire from "enquire.js";
import "mutationobserver-shim";

if (typeof global === "undefined") {
  window.global = window;
}

function getGlobal() {
  // eslint-disable-next-line no-undef
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  return {};
}

const g = getGlobal();

if (typeof g.require === "undefined") {
  g.require = (id) => {
    switch (id) {
      case "enquire.js":
        return enquire;
      case "mutationobserver-shim":
        return {};
      default:
        return {};
    }
  };
}
