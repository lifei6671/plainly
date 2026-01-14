import React, {Component} from "react";
import ImageDialog from "../component/Dialog/ImageDialog";
import LinkDialog from "../component/Dialog/LinkDialog";
import AboutDialog from "../component/Dialog/AboutDialog";
import FormDialog from "../component/Dialog/FormDialog";
import HistoryDialog from "../component/Dialog/HistoryDialog";
import SitDownDialog from "../component/Dialog/SitDownDialog";
import NewFileDialog from "../component/Dialog/NewFileDialog";
import DocumentListDialog from "../component/Dialog/DocumentListDialog";
import RenameFileDialog from "../component/Dialog/RenameFileDialog";
import CategoryManageDialog from "../component/Dialog/CategoryManageDialog";

class Dialog extends Component {
  render() {
    return (
      <div>
        <ImageDialog />
        <LinkDialog />
        <AboutDialog />
        <FormDialog />
        <HistoryDialog />
        <SitDownDialog />
        <NewFileDialog />
        <DocumentListDialog />
        <RenameFileDialog />
        <CategoryManageDialog />
      </div>
    );
  }
}

export default Dialog;
