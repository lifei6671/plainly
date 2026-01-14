import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";

@inject("dialog")
@observer
class DocumentList extends Component {
  handleClick = () => {
    this.props.dialog.setDocumentListOpen(true);
  };

  render() {
    return (
      <div id="nice-menu-document-list" className="nice-menu-item" onClick={this.handleClick}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">文档列表</span>
        </span>
      </div>
    );
  }
}

export default DocumentList;
