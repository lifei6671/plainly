import React, {Component} from "react";
import {message} from "antd";

import {download, dateFormat} from "../../../utils/helper";
import "../common.css";
import {getConfigSync, listConfigKeysSync} from "../../../utils/configStore";

class ExportConfig extends Component {
  handleClick = () => {
    const config = {};
    const keys = listConfigKeysSync();
    keys.forEach((key) => {
      config[key] = getConfigSync(key);
    });
    try {
      const content = JSON.stringify(config, null, 2);
      const filename = `markdown-nice-config-${dateFormat(new Date(), "yyyy-MM-dd")}.json`;
      download(content, filename);
      message.success("导出配置成功！");
    } catch (error) {
      message.error("导出配置失败！");
    }
  };

  render() {
    return (
      <div id="nice-menu-export-config" className="nice-menu-item" onClick={this.handleClick}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">导出配置</span>
        </span>
      </div>
    );
  }
}

export default ExportConfig;
