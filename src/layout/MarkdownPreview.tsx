import React, {Component} from "react";
import {observer} from "mobx-react";
import classnames from "classnames";
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";
import Sidebar from "./Sidebar";
import {BOX_ID, LAYOUT_ID, MJX_DATA_FORMULA, MJX_DATA_FORMULA_TYPE} from "../utils/constant";
import {markdownParser, markdownParserWechat, updateMathjax} from "../utils/helper";
import {renderMarkdownWithHeadingAnchors} from "../utils/syncScroll";
import {resolveThemeHtmlForTemplate} from "../theme";
import pluginCenter from "../utils/pluginCenter";
import {PLAINLY_MERMAID_CONFIG} from "../utils/mermaidConfig";

const UNSAVED_MERMAID_CACHE_DOCUMENT_KEY = "__plainly_unsaved_mermaid_document__";

type MermaidNode = HTMLElement & {__plainlyMermaidCacheKey?: string};
type DebouncedMermaidUpdate = (() => void) & {cancel?: () => void; flush?: () => void};
type MarkdownPreviewProps = {
  content: any;
  navbar: any;
  view: any;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  onContainerRef?: (node: HTMLDivElement | null) => void;
  onRootRef?: (node: HTMLElement | null) => void;
};

@observer
class MarkdownPreview extends Component<MarkdownPreviewProps> {
  previewWrap: HTMLElement | null = null;

  mermaid: any = null;

  mermaidRenderSignature: string;

  mermaidCache = new Map<string, string>();

  mermaidCacheDocumentKey: string;

  handleUpdateMathjax: () => void;

  handleUpdateMermaid: DebouncedMermaidUpdate;

  constructor(props: MarkdownPreviewProps) {
    super(props);
    this.handleUpdateMathjax = throttle(updateMathjax, 1500);
    this.mermaidCacheDocumentKey = this.getMermaidDocumentKey();
    this.mermaidRenderSignature = this.getMermaidRenderSignature();
    this.handleUpdateMermaid = debounce(this.updateMermaid, 800, {leading: false, trailing: true});
  }

  componentDidMount() {
    try {
      const windowAny = window as any;
      windowAny.MathJax = {
        tex: {
          inlineMath: [["$", "$"]],
          displayMath: [["$$", "$$"]],
          tags: "ams",
        },
        svg: {
          fontCache: "none",
        },
        options: {
          renderActions: {
            addMenu: [0, "", ""],
            addContainer: [
              190,
              (doc) => {
                for (const math of doc.math) {
                  this.addContainer(math, doc);
                }
              },
              this.addContainer,
            ],
          },
        },
      };
      import("mathjax/es5/tex-svg-full")
        .then(() => {
          (pluginCenter as any).mathjax = true;
          this.handleUpdateMathjax();
        })
        .catch((error) => {
          console.log(error);
        });
    } catch (e) {
      console.log(e);
    }
    this.initMermaid();
  }

  componentDidUpdate() {
    this.syncMermaidCacheScope();
    if (pluginCenter.mathjax) {
      this.handleUpdateMathjax();
    }
    if (pluginCenter.mermaid) {
      const signature = this.getMermaidRenderSignature();
      if (signature !== this.mermaidRenderSignature) {
        this.mermaidRenderSignature = signature;
        const misses = this.restoreMermaidCache();
        if (misses.length) {
          this.handleUpdateMermaid();
        }
      }
    }
  }

  componentWillUnmount() {
    this.handleUpdateMermaid.cancel?.();
    this.mermaidCache.clear();
  }

  flushMermaid = () => this.handleUpdateMermaid.flush?.();

  initMermaid = () => {
    import("mermaid")
      .then((module) => {
        const mermaid: any = module.default || module;
        this.mermaid = mermaid;
        mermaid.initialize(PLAINLY_MERMAID_CONFIG);
        (pluginCenter as any).mermaid = true;
        this.syncMermaidCacheScope();
        this.mermaidRenderSignature = this.getMermaidRenderSignature();
        if (this.restoreMermaidCache().length) {
          this.handleUpdateMermaid();
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  getMermaidRenderSignature = () =>
    [
      this.getMermaidDocumentKey(),
      this.props.content.content || "",
      this.props.navbar.templateNum,
      this.props.navbar.codeNum,
    ].join("\u0000");

  getMermaidDocumentKey = () => this.props.content.documentUuid || UNSAVED_MERMAID_CACHE_DOCUMENT_KEY;

  syncMermaidCacheScope = () => {
    const documentKey = this.getMermaidDocumentKey();
    if (documentKey !== this.mermaidCacheDocumentKey) {
      this.mermaidCache.clear();
      this.mermaidCacheDocumentKey = documentKey;
    }
    return documentKey;
  };

  getMermaidCacheKey = (source: string, occurrence: number) => JSON.stringify([source, occurrence]);

  getMermaidSourceFromCacheKey = (key: string) => {
    try {
      const [source] = JSON.parse(key);
      return typeof source === "string" ? source : null;
    } catch (_error) {
      return null;
    }
  };

  restoreMermaidCache = (): MermaidNode[] => {
    this.syncMermaidCacheScope();
    if (!this.previewWrap) {
      return [];
    }
    const occurrences = new Map<string, number>();
    const presentKeys = new Set<string>();
    const misses: MermaidNode[] = [];
    const nodes = Array.from(this.previewWrap.querySelectorAll(".mermaid")) as MermaidNode[];

    nodes.forEach((node) => {
      if (node.getAttribute("data-processed")) {
        const cacheKey = node.__plainlyMermaidCacheKey;
        if (cacheKey) {
          presentKeys.add(cacheKey);
          const source = this.getMermaidSourceFromCacheKey(cacheKey);
          if (source !== null) {
            occurrences.set(source, (occurrences.get(source) || 0) + 1);
          }
        }
        return;
      }

      const source = node.textContent.trim();
      const occurrence = occurrences.get(source) || 0;
      occurrences.set(source, occurrence + 1);
      const cacheKey = this.getMermaidCacheKey(source, occurrence);
      node.__plainlyMermaidCacheKey = cacheKey;
      presentKeys.add(cacheKey);
      const cachedSvg = this.mermaidCache.get(cacheKey);
      if (cachedSvg === undefined) {
        misses.push(node);
        return;
      }
      node.innerHTML = cachedSvg;
      node.setAttribute("data-processed", "true");
    });

    this.mermaidCache.forEach((_svg, cacheKey) => {
      if (!presentKeys.has(cacheKey)) {
        this.mermaidCache.delete(cacheKey);
      }
    });

    return misses;
  };

  updateMermaid = () => {
    if (!this.mermaid || !this.previewWrap) {
      return;
    }
    const documentKey = this.syncMermaidCacheScope();
    const nodes = this.restoreMermaidCache().filter((node) => !node.getAttribute("data-processed"));
    if (!nodes.length) {
      return;
    }
    const cacheRenderedNodes = () => {
      if (this.mermaidCacheDocumentKey !== documentKey || this.getMermaidDocumentKey() !== documentKey) {
        return;
      }
      nodes.forEach((node) => {
        const cacheKey = node.__plainlyMermaidCacheKey;
        if (cacheKey && node.getAttribute("data-processed")) {
          this.mermaidCache.set(cacheKey, node.innerHTML);
        }
      });
    };
    try {
      const result = typeof this.mermaid.run === "function" ? this.mermaid.run({nodes}) : undefined;
      if (result && typeof result.then === "function") {
        Promise.resolve(result)
          .then(cacheRenderedNodes)
          .catch(console.error);
      } else {
        cacheRenderedNodes();
      }
    } catch (error) {
      console.error(error);
    }
  };

  addContainer(math, doc) {
    const tag = "span";
    const spanClass = math.display ? "span-block-equation" : "span-inline-equation";
    const cls = math.display ? "block-equation" : "inline-equation";
    math.typesetRoot.className = cls;
    math.typesetRoot.setAttribute(MJX_DATA_FORMULA, math.math);
    math.typesetRoot.setAttribute(MJX_DATA_FORMULA_TYPE, cls);
    math.typesetRoot = doc.adaptor.node(tag, {class: spanClass, style: "cursor:pointer"}, [math.typesetRoot]);
  }

  render() {
    const {content, navbar, view, onScroll, onContainerRef, onRootRef} = this.props;
    const activeParser = navbar.codeNum === 0 ? markdownParserWechat : markdownParser;
    const rawHtml = renderMarkdownWithHeadingAnchors(content.content, activeParser);
    const html = resolveThemeHtmlForTemplate(navbar.templateNum, rawHtml);
    const className = classnames({
      "nice-marked-text": true,
      "nice-marked-text-pc": navbar.previewType === "pc",
      "nice-marked-text-hide": view.isImmersiveEditing || !view.isPreviewAreaOpen,
    });
    const boxClass = classnames({"nice-wx-box": true, "nice-wx-box-pc": navbar.previewType === "pc"});
    return (
      <div id="nice-rich-text" className={className}>
        <Sidebar />
        <div id={BOX_ID} className={boxClass} onScroll={onScroll} ref={onContainerRef}>
          <section
            id={LAYOUT_ID}
            data-tool="mdnice编辑器"
            data-website="https://mdnice.disign.me"
            dangerouslySetInnerHTML={{__html: html}}
            ref={(node) => {
              this.previewWrap = node;
              onRootRef?.(node);
            }}
          />
        </div>
      </div>
    );
  }
}

export default MarkdownPreview;
