import React, {Component} from "react";
import {observer} from "mobx-react";
import classnames from "classnames";
import {Button, Tooltip} from "antd";
import {FolderOpenOutlined} from "@ant-design/icons";
import {countVisibleChars} from "../utils/helper";
import {DEFAULT_CATEGORY_NAME} from "../utils/constant";

type StatusBarProps = {
  content: any;
  view: any;
  isRemoteMode: boolean;
  currentUser: {username?: string; account?: string} | null;
  onAuthOpen: () => void;
  onNavigatorOpen: () => void;
  onCategoryManageOpen: () => void;
  onDocumentSettingsOpen: () => void;
};

@observer
class StatusBar extends Component<StatusBarProps> {
  render() {
    const {
      content,
      view,
      isRemoteMode,
      currentUser,
      onAuthOpen,
      onNavigatorOpen,
      onCategoryManageOpen,
      onDocumentSettingsOpen,
    } = this.props;
    const categoryName = content.documentCategoryName || DEFAULT_CATEGORY_NAME;
    const lastSavedText = content.documentUpdatedAt ? new Date(content.documentUpdatedAt).toLocaleString() : "未保存";
    const className = classnames({"nice-status-bar": true, "nice-status-bar-hide": view.isImmersiveEditing});
    return (
      <div className={className}>
        <div className="nice-status-item nice-status-item-main">
          <Tooltip title="文档导航">
            <Button
              type="text"
              size="small"
              className="nice-document-navigator-trigger"
              icon={<FolderOpenOutlined />}
              onClick={onNavigatorOpen}
              aria-label="文档导航"
            />
          </Tooltip>
          {isRemoteMode ? (
            <Button type="link" size="small" onClick={onAuthOpen}>
              {currentUser ? `已登录：${currentUser.username || currentUser.account}` : "未登录"}
            </Button>
          ) : (
            <>
              <b>离线模式</b>&nbsp;
            </>
          )}
          <b>归属目录: </b>
          <button
            type="button"
            className="nice-status-category-trigger"
            onClick={onCategoryManageOpen}
            title="打开目录管理"
          >
            {categoryName}
          </button>
          &nbsp;
          <b>文件名: </b>
          <button
            type="button"
            className="nice-status-category-trigger"
            onClick={onDocumentSettingsOpen}
            title="打开文档设置"
          >
            {content.documentName || "未命名.md"}
          </button>
        </div>
        <div className="nice-status-item">
          <b>最后保存时间: </b>
          {lastSavedText}
        </div>
        <div className="nice-status-item">
          <b>字符数:</b>
          {countVisibleChars(content.content || "")}
        </div>
      </div>
    );
  }
}

export default StatusBar;
