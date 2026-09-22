import type {ElementMapThemeDefinition, ElementStyleMap} from "../types";
import {withPlainlyCompatibility} from "./themes";
import {theme as wechatDefault} from "./upstream/wechat-default";
import {theme as wechatFt} from "./upstream/wechat-ft";
import {theme as wechatTech} from "./upstream/wechat-tech";
import {theme as wechatElegant} from "./upstream/wechat-elegant";
import {theme as wechatDeepread} from "./upstream/wechat-deepread";
import {theme as wechatNyt} from "./upstream/wechat-nyt";
import {theme as wechatJonyive} from "./upstream/wechat-jonyive";
import {theme as wechatMedium} from "./upstream/wechat-medium";
import {theme as kenyaEmptiness} from "./upstream/kenya-emptiness";
import {theme as hischeEditorial} from "./upstream/hische-editorial";
import {theme as andoConcrete} from "./upstream/ando-concrete";
import {theme as gaudiOrganic} from "./upstream/gaudi-organic";
import {theme as guardian} from "./upstream/guardian";
import {theme as nikkei} from "./upstream/nikkei";
import {theme as lemonde} from "./upstream/lemonde";
import {theme as wechatPaperpress} from "./upstream/wechat-paperpress";

type RicoSourceTheme = Readonly<{name: string; styles: ElementStyleMap}>;

const elementTheme = (id: string, theme: RicoSourceTheme, sourceId: string): ElementMapThemeDefinition => ({
  id: `rico-${id}`,
  name: theme.name,
  category: "Rico MD",
  author: "Rico (ricoui.com)",
  source: `ricocc/rico-md@8c22fe5711365ffe646a0987b6d670d22511de58: assets/styles/themes/${sourceId}.js`,
  license: "MIT",
  isNew: true,
  mode: "element-map",
  styles: withPlainlyCompatibility(theme.styles),
});

/** Fixed Rico `STYLES` source objects, exported only for fidelity contracts. */
export const RICO_REMAINING_SOURCE_THEMES: readonly RicoSourceTheme[] = [
  wechatDefault, wechatFt, wechatTech, wechatElegant, wechatDeepread, wechatNyt, wechatJonyive, wechatMedium,
  kenyaEmptiness, hischeEditorial, andoConcrete, gaudiOrganic, guardian, nikkei, lemonde, wechatPaperpress,
];

/** Remaining root themes in the fixed Rico `assets/styles/themes/index.js` STYLES order. */
export const RICO_REMAINING_ELEMENT_THEMES: readonly ElementMapThemeDefinition[] = [
  elementTheme("wechat-default", RICO_REMAINING_SOURCE_THEMES[0], "wechat-default"),
  elementTheme("wechat-ft", wechatFt, "wechat-ft"),
  elementTheme("wechat-tech", wechatTech, "wechat-tech"),
  elementTheme("wechat-elegant", wechatElegant, "wechat-elegant"),
  elementTheme("wechat-deepread", wechatDeepread, "wechat-deepread"),
  elementTheme("wechat-nyt", wechatNyt, "wechat-nyt"),
  elementTheme("wechat-jonyive", wechatJonyive, "wechat-jonyive"),
  elementTheme("wechat-medium", wechatMedium, "wechat-medium"),
  elementTheme("kenya-emptiness", kenyaEmptiness, "kenya-emptiness"),
  elementTheme("hische-editorial", hischeEditorial, "hische-editorial"),
  elementTheme("ando-concrete", andoConcrete, "ando-concrete"),
  elementTheme("gaudi-organic", gaudiOrganic, "gaudi-organic"),
  elementTheme("guardian", guardian, "guardian"),
  elementTheme("nikkei", nikkei, "nikkei"),
  elementTheme("lemonde", lemonde, "lemonde"),
  elementTheme("wechat-paperpress", wechatPaperpress, "wechat-paperpress"),
];
