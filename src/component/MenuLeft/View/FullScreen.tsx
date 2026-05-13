import React, {Component} from "react";
import {observer, inject} from "mobx-react";

import "../common.css";

type FullScreenElement = HTMLElement & {
  mozRequestFullScreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullScreenDocument = Document & {
  mozCancelFullScreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  mozFullScreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

@inject("navbar")
@observer
class FullScreen extends Component<any, any> {
  // fullScreen or !fullScreen
  toggleFullScreen = () => {
    const doc = window.document as FullScreenDocument;
    const docEl = doc.documentElement as FullScreenElement;

    const requestFullScreen =
      docEl.requestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.webkitRequestFullScreen ||
      docEl.msRequestFullscreen;
    const cancelFullScreen =
      doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (
      !doc.fullscreenElement &&
      !doc.mozFullScreenElement &&
      !doc.webkitFullscreenElement &&
      !doc.msFullscreenElement
    ) {
      requestFullScreen.call(docEl);
    } else {
      cancelFullScreen.call(doc);
    }
  };

  render() {
    return (
      <div id="nice-menu-full-screen" className="nice-menu-item" onClick={this.toggleFullScreen}>
        <span>
          <span className="nice-menu-flag" />
          <span className="nice-menu-name">全屏</span>
        </span>
      </div>
    );
  }
}

export default FullScreen;

