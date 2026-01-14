import React, {Component} from "react";
import {Menu, Dropdown} from "antd";
import {observer, inject} from "mobx-react";

import SyncScroll from "./Setting/SyncScroll";
import ContainImgName from "./Setting/ContainImgName";
import renderUploadLocationSubMenu from "./Setting/UploadLocation";
import ImageHostingConfig from "./Setting/ImageHostingConfig";

import "./common.css";

@inject("imageHosting")
@observer
class Setting extends Component {
  render() {
    const {imageHosting} = this.props;
    const menu = (
      <Menu>
        <Menu.Item>
          <SyncScroll />
        </Menu.Item>
        <Menu.Item>
          <ContainImgName />
        </Menu.Item>
        {renderUploadLocationSubMenu(imageHosting)}
        <Menu.Item>
          <ImageHostingConfig />
        </Menu.Item>
      </Menu>
    );

    return (
      <Dropdown overlay={menu} trigger={["click"]} overlayClassName="nice-overlay">
        <a id="nice-menu-setting" className="nice-menu-link" href="#">
          设置
        </a>
      </Dropdown>
    );
  }
}

export default Setting;
