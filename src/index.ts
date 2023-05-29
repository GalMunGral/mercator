import { MapRenderer } from "./Map";
import { LonLat } from "./Mercator";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.createElement("div");
  container.style.width = "100vw";
  container.style.height = "100vh";

  document.body.style.margin = "0px";
  document.body.append(container);

  const renderer = new MapRenderer(
    container,
    new LonLat(-88.22732760995116, 40.110373226386486),
    12
  );
});
