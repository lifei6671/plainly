export type PluginCenterState = Readonly<{
  mathjax: boolean;
  mermaid: boolean;
}>;

// 检测插件是否安装
const pluginCenter: PluginCenterState = {
  mathjax: false,
  mermaid: false,
};

export default pluginCenter;
