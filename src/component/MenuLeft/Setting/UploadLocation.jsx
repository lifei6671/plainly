import React from "react";
import {Menu} from "antd";

import {RIGHT_SYMBOL, IMAGE_HOSTING_TYPE} from "../../../utils/constant";
import "../common.css";
import {setConfigSync} from "../../../utils/configStore";

const handleImageHostingChange = (imageHosting, type) => {
  if (!imageHosting) {
    return;
  }
  imageHosting.setType(type);
  setConfigSync(IMAGE_HOSTING_TYPE, type);
};

const renderImageHostingItems = (imageHosting) => {
  const hostingList = imageHosting ? imageHosting.hostingList : [];
  const type = imageHosting ? imageHosting.type : "";
  if (!hostingList.length) {
    return (
      <Menu.Item key="upload-location-empty" disabled>
        <div className="nice-menu-item">
          <span className="nice-menu-name">暂无可用图床</span>
        </div>
      </Menu.Item>
    );
  }

  return hostingList.map((option) => (
    <Menu.Item
      key={`upload-location-${option.value}`}
      onClick={() => handleImageHostingChange(imageHosting, option.value)}
    >
      <div id={`nice-menu-upload-location-${option.value}`} className="nice-menu-item">
        <span>
          <span className="nice-menu-flag">{type === option.value && <span>{RIGHT_SYMBOL}</span>}</span>
          <span className="nice-menu-name">{option.label}</span>
        </span>
      </div>
    </Menu.Item>
  ));
};

const renderUploadLocationSubMenu = (imageHosting) => {
  const type = imageHosting ? imageHosting.type : "";
  return (
    <Menu.SubMenu
      key="upload-location"
      title={
        <div id="nice-menu-upload-location" className="nice-menu-item nice-menu-submenu-title">
          <span className="nice-menu-name">上传图片位置</span>
          <span className="nice-menu-shortcut">{type || "未设置"}</span>
        </div>
      }
    >
      {renderImageHostingItems(imageHosting)}
    </Menu.SubMenu>
  );
};

export default renderUploadLocationSubMenu;
