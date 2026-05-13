import type {SVGProps} from "react";

export type BaseIconProps = SVGProps<SVGSVGElement>;

export type SvgIconName =
  | "close"
  | "copy"
  | "down"
  | "environment"
  | "fontCase"
  | "github"
  | "inbox"
  | "juejin"
  | "mobile"
  | "more"
  | "pc"
  | "rabbit"
  | "replace"
  | "replaceAll"
  | "smile"
  | "wechat"
  | "zhihu";

export type SvgIconProps = BaseIconProps & {
  name?: SvgIconName;
};
