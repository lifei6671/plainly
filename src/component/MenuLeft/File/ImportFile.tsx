import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";
import {message} from "antd";

@inject("content")
@observer
class ImportFile extends Component<any, any> {
  handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = typeof event.target?.result === "string" ? event.target.result : "";
      this.props.content.setContent(result);
      message.success("导入文件成功！");
    };
    reader.readAsText(file);
  };

  render() {
    return (
      <label id="nice-menu-import-file" className="nice-menu-item" htmlFor="importFile">
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">导入</span>
          <input
            style={{display: "none"}}
            type="file"
            id="importFile"
            accept=".txt,.md"
            hidden
            onChange={this.handleChange}
          />
        </span>
      </label>
    );
  }
}

export default ImportFile;
