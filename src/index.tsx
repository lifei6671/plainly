import "./global-shim";
import React from "react";
import {createRoot} from "react-dom/client";

import Lib from "./Lib";
import * as serviceWorker from "./serviceWorker";

// eslint-disable-next-line import/no-unresolved
import wasmUrl from "./assets/wasm/jieba_rs_wasm_bg.wasm?url";
import prewarmWasm from "./search/wasm-prewarm";

const root = createRoot(document.getElementById("root"));
root.render(
  <Lib
    useImageHosting={{
      url: "https://api.imgur.com/3/upload",
      name: "图壳",
      isSmmsOpen: true,
      isR2Open: true,
      isQiniuyunOpen: true,
      isAliyunOpen: true,
    }}
    defaultTitle="Plainly"
  />,
);

prewarmWasm(wasmUrl);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
