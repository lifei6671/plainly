import React from "react";
import {Menu, Dropdown} from "antd";
import {observer, inject} from "mobx-react";

import {RIGHT_SYMBOL} from "../../utils/constant";
import {getThemeList, themeRegistry} from "../../theme";
import {groupThemesForMenu, type IndexedTheme} from "./themeMenu";
import "./Theme.css";

@inject("content")
@inject("navbar")
@inject("view")
@observer
class Theme extends React.Component<any, any> {
  changeTemplate = (item) => {
    if (item.key === "view-css") {
      return;
    }
    const index = parseInt(item.key, 10);
    const themes = getThemeList();
    const {id} = themes[index];
    this.props.navbar.setTemplateNum(index);

    // 更新style编辑器
    if (id === "custom") {
      this.props.content.setCustomStyle();
      // 切换自定义自动打开css编辑
      this.props.view.setStyleEditorOpen(true);
    } else {
      this.props.content.setStyle(themeRegistry.resolveThemeCss(id));
    }
  };

  toggleStyleEditor = () => {
    const {isStyleEditorOpen} = this.props.view;
    this.props.view.setStyleEditorOpen(!isStyleEditorOpen);
  };

  renderThemeItem = ({theme, index}: IndexedTheme) => {
    const {templateNum} = this.props.navbar;
    return (
      <Menu.Item key={index}>
        <div id={`nice-menu-theme-${theme.id}`} className="nice-themeselect-theme-item">
          <span>
            <span className="nice-themeselect-theme-item-flag">{templateNum === index && <span>{RIGHT_SYMBOL}</span>}</span>
            <span className="nice-themeselect-theme-item-name">{theme.name}</span>
            {theme.isNew && <span className="nice-themeselect-theme-item-new">new</span>}
          </span>
          <span className="nice-themeselect-theme-item-author">{theme.author}</span>
        </div>
      </Menu.Item>
    );
  };

  render() {
    const {groups, custom} = groupThemesForMenu(getThemeList());
    const mdMenu = (
      <Menu className="nice-themeselect-root-menu" onClick={this.changeTemplate}>
        {groups.map((group) => (
          <Menu.SubMenu
            key={`theme-group-${group.key}`}
            popupClassName="nice-theme-submenu-popup"
            title={
              <div className="nice-themeselect-group-title">
                <span>{group.label}</span>
                <span className="nice-themeselect-group-count">{group.themes.length}</span>
              </div>
            }
          >
            {group.themes.map(this.renderThemeItem)}
          </Menu.SubMenu>
        ))}
        {custom && this.renderThemeItem(custom)}
        <Menu.Divider />
        <Menu.Item key="view-css" className="nice-themeselect-menu-item" onClick={this.toggleStyleEditor}>
          <div id="nice-menu-view-css" className="nice-themeselect-theme-item">
            <span>
              <span className="nice-themeselect-theme-item-flag">
                {this.props.view.isStyleEditorOpen && <span>{RIGHT_SYMBOL}</span>}
              </span>
              <span className="nice-themeselect-theme-item-name">查看主题 CSS</span>
            </span>
          </div>
        </Menu.Item>
      </Menu>
    );
    return (
      <Dropdown overlay={mdMenu} trigger={["click"]} overlayClassName="nice-overlay">
        <a id="nice-menu-theme" className="nice-menu-link" href="#">
          主题
        </a>
      </Dropdown>
    );
  }
}

export default Theme;
