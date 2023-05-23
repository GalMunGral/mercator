import { MapRenderer } from "./Map";

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";

  document.body.style.margin = "0px";
  document.body.append(canvas);

  new MapRenderer(canvas);
});
