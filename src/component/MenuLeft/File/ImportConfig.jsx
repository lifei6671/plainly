import React, {Component} from "react";
import {message} from "antd";

import "../common.css";
import {removeConfigSync, setConfigSync} from "../../../utils/configStore";

class ImportConfig extends Component {
  handleChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      let parsed = null;
      try {
        parsed = JSON.parse(event.target.result);
      } catch (error) {
        message.error("配置文件解析失败！");
        return;
      }
      const data = parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.data ? parsed.data : parsed;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        message.error("配置文件格式不正确！");
        return;
      }
      Object.keys(data).forEach((key) => {
        const value = data[key];
        if (value === null || value === undefined) {
          removeConfigSync(key);
          return;
        }
        setConfigSync(key, value);
      });
      message.success("导入配置成功，即将刷新页面！");
      setTimeout(() => {
        window.location.reload();
      }, 800);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  render() {
    return (
      <label id="nice-menu-import-config" className="nice-menu-item" htmlFor="importConfig">
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">导入配置</span>
          <input
            style={{display: "none"}}
            type="file"
            id="importConfig"
            accept=".json"
            hidden=""
            onChange={this.handleChange}
          />
        </span>
      </label>
    );
  }
}

export default ImportConfig;
