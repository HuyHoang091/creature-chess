import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const container = document.createElement("div");
document.body.style.margin = "0";
document.body.appendChild(container);

createRoot(container).render(<App />);
