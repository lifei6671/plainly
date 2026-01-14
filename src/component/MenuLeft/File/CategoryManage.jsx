import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";

@inject("dialog")
@observer
class CategoryManage extends Component {
  handleClick = () => {
    this.props.dialog.setCategoryManageOpen(true);
  };

  render() {
    return (
      <div id="nice-menu-category-manage" className="nice-menu-item" onClick={this.handleClick}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">目录管理</span>
        </span>
      </div>
    );
  }
}

export default CategoryManage;
