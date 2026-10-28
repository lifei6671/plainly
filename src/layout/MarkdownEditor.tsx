import React, {Component} from "react";
import {observer} from "mobx-react";
import CodeMirror from "@uiw/react-codemirror";
import "codemirror/addon/search/searchcursor";
import "codemirror/keymap/sublime";
import "codemirror/mode/markdown/markdown";
import classnames from "classnames";
import SearchBox from "../component/SearchBox";
import bindHotkeys, {betterTab, rightClick} from "../utils/hotkey";
import {pasteImages} from "../utils/imagePaste";
import {uploadAdaptor} from "../utils/imageHosting";

type MarkdownEditorProps = {
  content: any;
  dialog: any;
  view: any;
  onTextChange?: (content: string) => void;
  onScroll: () => void;
  onBlur: () => void;
};

@observer
class MarkdownEditor extends Component<MarkdownEditorProps> {
  focus = false;

  getInstance = (instance: any) => {
    if (instance) {
      this.props.content.setMarkdownEditor(instance.editor);
    }
  };

  handleChange = (editor: any) => {
    if (this.focus) {
      const content = editor.getValue();
      this.props.content.setContent(content);
      this.props.onTextChange && this.props.onTextChange(content);
    }
  };

  handleFocus = () => {
    this.focus = true;
  };

  handleBlur = () => {
    this.focus = false;
    this.props.onBlur();
  };

  handleDrop = (_instance: any, e: any) => {
    if (!(e.dataTransfer && e.dataTransfer.files)) {
      return;
    }
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      uploadAdaptor({file: e.dataTransfer.files[i], content: this.props.content});
    }
  };

  handlePaste = (_instance: any, event: any) => pasteImages(this.props.content, event);

  render() {
    const {content, dialog, view, onScroll} = this.props;
    const className = classnames({
      "nice-md-editing": !view.isImmersiveEditing,
      "nice-md-editing-immersive": view.isImmersiveEditing,
      "nice-md-editing-hide": !view.isEditAreaOpen,
    });
    return (
      <div id="nice-md-editor" className={className}>
        {dialog.isSearchOpen && <SearchBox />}
        <CodeMirror
          value={content.content}
          options={{
            theme: "md-mirror",
            keyMap: "sublime",
            mode: "text/x-markdown",
            lineWrapping: true,
            lineNumbers: false,
            extraKeys: {...bindHotkeys(content, dialog), Tab: betterTab, RightClick: rightClick},
          }}
          onChange={this.handleChange}
          onScroll={onScroll}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          onDrop={this.handleDrop}
          onPaste={this.handlePaste}
          ref={this.getInstance}
        />
      </div>
    );
  }
}

export default MarkdownEditor;
