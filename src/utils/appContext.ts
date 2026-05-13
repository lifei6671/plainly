import React from "react";

export type ImageHostingPreset = {
  url: string;
  name: string;
  isSmmsOpen: boolean;
  isR2Open: boolean;
  isQiniuyunOpen: boolean;
  isAliyunOpen: boolean;
};

export type AppContextValue = {
  defaultTitle: string;
  useImageHosting: ImageHostingPreset;
};

const appContext = React.createContext<AppContextValue | null>(null);

export default appContext;
