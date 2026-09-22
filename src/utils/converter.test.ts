import {BASIC_THEME_ID, BOX_ID, CODE_THEME_ID, FONT_THEME_ID, LAYOUT_ID, MARKDOWN_THEME_ID} from "./constant";
import {solveHtml} from "./converter";

declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

const addExportStyle = (id: string) => {
  const style = document.createElement("style");
  style.id = id;
  style.innerText = "";
  document.head.appendChild(style);
};

const rootLayoutStyles: Record<string, string> = {
  display: "block",
  position: "relative",
  left: "11px",
  width: "640px",
  height: "320px",
  "min-width": "640px",
  "min-height": "320px",
  "max-width": "640px",
  "max-height": "320px",
  margin: "24px",
  padding: "12px",
};

const descendantVisualStyles: Record<string, string> = {
  fill: "rgb(10, 20, 30)",
  stroke: "rgb(40, 50, 60)",
  "stroke-width": "2px",
  "font-family": "Arial",
  "font-size": "14px",
  "font-weight": "700",
};

describe("solveHtml Mermaid export", () => {
  it("keeps consecutive Mermaid root SVG layout responsive while inlining descendant visuals", () => {
    document.head.innerHTML = "";
    [BASIC_THEME_ID, MARKDOWN_THEME_ID, CODE_THEME_ID, FONT_THEME_ID].forEach(addExportStyle);
    document.body.innerHTML = `
      <div id="${BOX_ID}"><section id="${LAYOUT_ID}">
        <div class="mermaid"><svg viewBox="0 0 200 100" width="200" height="100" preserveAspectRatio="xMidYMid meet" style="color: teal"><g class="node"><text class="label">first</text></g></svg></div>
        <div class="mermaid"><svg viewBox="0 0 300 150" width="300" height="150" preserveAspectRatio="xMinYMin meet" style="color: purple"><g class="node"><text class="label">second</text></g></svg></div>
      </section></div>
    `;
    const computedStyleSpy = jest.spyOn(window, "getComputedStyle").mockImplementation((node: Element) => {
      const styles = node.matches(".mermaid svg") ? rootLayoutStyles : descendantVisualStyles;
      return {getPropertyValue: (property: string) => styles[property] || ""} as CSSStyleDeclaration;
    });

    try {
      const exported = document.createElement("div");
      exported.innerHTML = solveHtml();
      const svgs = Array.from(exported.querySelectorAll(".mermaid svg")) as SVGSVGElement[];

      expect(svgs).toHaveLength(2);
      expect(svgs.map((svg) => svg.getAttribute("viewBox"))).toEqual(["0 0 200 100", "0 0 300 150"]);
      expect(svgs.map((svg) => svg.getAttribute("width"))).toEqual(["200", "300"]);
      expect(svgs.map((svg) => svg.getAttribute("height"))).toEqual(["100", "150"]);
      expect(svgs.map((svg) => svg.getAttribute("preserveAspectRatio"))).toEqual(["xMidYMid meet", "xMinYMin meet"]);
      expect(svgs.map((svg) => svg.getAttribute("style"))).toEqual(["color: teal", "color: purple"]);
      svgs.forEach((svg) => {
        expect(svg.style.width).toBe("");
        expect(svg.style.height).toBe("");
        expect(svg.style.minWidth).toBe("");
        expect(svg.style.minHeight).toBe("");
        expect(svg.style.maxWidth).toBe("");
        expect(svg.style.maxHeight).toBe("");
        expect(svg.style.position).toBe("");
        expect(svg.style.margin).toBe("");
        expect(svg.style.padding).toBe("");
      });
      expect((svgs[0].querySelector(".node") as SVGElement).getAttribute("style")).toContain("fill:rgb(10, 20, 30)");
      expect((svgs[0].querySelector(".node") as SVGElement).getAttribute("style")).toContain("stroke:rgb(40, 50, 60)");
      expect((svgs[0].querySelector(".label") as SVGElement).getAttribute("style")).toContain("font-size:14px");
    } finally {
      computedStyleSpy.mockRestore();
    }
  });
});
