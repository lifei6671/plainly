import React, {Component} from "react";
import {Menu, Dropdown} from "antd";

import ExportMarkdown from "./File/ExportMarkdown";
import ExportPdf from "./File/ExportPdf";
import ImportFile from "./File/ImportFile";
import ImportConfig from "./File/ImportConfig";
import ExportConfig from "./File/ExportConfig";
import NewFile from "./File/NewFile";
import DocumentList from "./File/DocumentList";
import RenameFile from "./File/RenameFile";
import CategoryManage from "./File/CategoryManage";
import "./common.css";

const menu = (
  <Menu>
    <Menu.Item>
      <NewFile />
    </Menu.Item>
    <Menu.Item>
      <RenameFile />
    </Menu.Item>
    <Menu.Divider />
    <Menu.Item>
      <DocumentList />
    </Menu.Item>
    <Menu.Item>
      <CategoryManage />
    </Menu.Item>
    <Menu.Divider />
    <Menu.Item>
      <ExportMarkdown />
    </Menu.Item>
    <Menu.Item>
      <ExportPdf />
    </Menu.Item>
    <Menu.Item>
      <ImportFile />
    </Menu.Item>
    <Menu.Divider />
    <Menu.Item>
      <ImportConfig />
    </Menu.Item>
    <Menu.Item>
      <ExportConfig />
    </Menu.Item>
  </Menu>
);

class File extends Component {
  render() {
    return (
      <Dropdown overlay={menu} trigger={["click"]} overlayClassName="nice-overlay">
        <a id="nice-menu-file" className="nice-menu-link" href="#">
          文件
        </a>
      </Dropdown>
    );
  }
}

export default File;
