import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";

@inject("dialog")
@observer
class RenameFile extends Component {
  handleClick = () => {
    this.props.dialog.setRenameFileOpen(true);
  };

  render() {
    return (
      <div id="nice-menu-rename-file" className="nice-menu-item" onClick={this.handleClick}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">重命名文档</span>
        </span>
      </div>
    );
  }
}

export default RenameFile;
