import { createRoot } from "react-dom/client";
import App, { Logo } from "./App";
import { Root } from "./auth";

createRoot(document.getElementById("root")!).render(<Root app={<App />} logo={<Logo size={76} />} />);
