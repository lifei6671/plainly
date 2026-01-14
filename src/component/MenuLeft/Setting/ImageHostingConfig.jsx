import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";

@inject("dialog")
@observer
class ImageHostingConfig extends Component {
  handleClick = () => {
    this.props.dialog.setImageOpen(true);
  };

  render() {
    return (
      <div id="nice-menu-image-hosting-config" className="nice-menu-item" onClick={this.handleClick}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">图床配置</span>
        </span>
      </div>
    );
  }
}

export default ImageHostingConfig;
