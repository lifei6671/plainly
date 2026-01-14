import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";

@inject("dialog")
@observer
class NewFile extends Component {
  handleClick = () => {
    this.props.dialog.setNewFileOpen(true);
  };

  render() {
    return (
      <div id="nice-menu-new-file" className="nice-menu-item" onClick={this.handleClick}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">新建文件</span>
        </span>
      </div>
    );
  }
}

export default NewFile;
