import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";

@inject("dialog")
@observer
class RenameFile extends Component<any, any> {
  handleClick = () => {
    this.props.dialog.setRenameFileOpen(true);
  };

  render() {
    return (
      <div id="nice-menu-rename-file" className="nice-menu-item" onClick={this.handleClick}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">文档设置</span>
        </span>
      </div>
    );
  }
}

export default RenameFile;
