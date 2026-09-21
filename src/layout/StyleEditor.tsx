import React, {Component} from "react";
import {Modal} from "antd";

import CodeMirror from "@uiw/react-codemirror";
import "codemirror/keymap/sublime";
import "codemirror/addon/edit/closebrackets";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/hint/css-hint";
import "codemirror/mode/css/css";
import "antd/dist/antd.css";
import {observer, inject} from "mobx-react";

import "../utils/styleMirror.css";
import {getThemeList, themeRegistry} from "../theme";

const CodeMirrorAny = CodeMirror as any;
const CUSTOM_STYLE_PREFIX = "/*自定义样式，实时生效*/\n\n";

export const getCustomStyleFromThemeIndex = (templateNum: number) => {
  const theme = getThemeList()[templateNum];
  if (!theme || theme.id === "custom") return undefined;

  const css = themeRegistry.resolveThemeCss(theme.id);
  return css === undefined ? undefined : `${CUSTOM_STYLE_PREFIX}${css}`;
};

@inject("content")
@inject("navbar")
@observer
class StyleEditor extends Component<any, any> {
  focus = false;

  styleEditor: any = null;

  getStyleInstance = (instance) => {
    if (instance) {
      this.styleEditor = instance.editor;
      this.styleEditor.on("keyup", (cm, event) => {
        if ((event.keyCode >= 65 && event.keyCode <= 90) || event.keyCode === 189) {
          cm.showHint({completeSingle: false});
        }
      });
    }
  };

  showConfirm = () => {
    Modal.confirm({
      title: "是否想使用该模板？",
      content: "确定后将复制当前内容和样式并切换为自定义",
      cancelText: "取消",
      okText: "确定",
      onOk: () => {
        const {templateNum} = this.props.navbar;
        const style = getCustomStyleFromThemeIndex(templateNum);
        if (style === undefined) return;

        this.props.content.setCustomStyle(style);
        this.props.navbar.setTemplateNum(getThemeList().findIndex((theme) => theme.id === "custom"));
      },
      onCancel: () => {},
    });
  };

  changeStyle = (editor) => {
    const {templateNum} = this.props.navbar;
    const theme = getThemeList()[templateNum];
    // focus状态很重要，初始化时被调用则不会进入条件
    if (this.focus && theme && theme.id !== "custom") {
      this.showConfirm();
    } else if (this.focus && theme && theme.id === "custom") {
      const style = editor.getValue();
      this.props.content.setCustomStyle(style);
    }
  };

  handleFocus = () => {
    this.focus = true;
  };

  handleBlur = () => {
    this.focus = false;
  };

  render() {
    return (
      <CodeMirrorAny
        value={this.props.content.style}
        options={{
          theme: "style-mirror",
          keyMap: "sublime",
          mode: "text/css",
          lineWrapping: true,
          lineNumbers: false,
        }}
        id="css-editor"
        onChange={this.changeStyle}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
        ref={this.getStyleInstance}
      />
    );
  }
}

export default StyleEditor;
