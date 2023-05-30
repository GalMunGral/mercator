import { MapRenderer } from "./Map";
import { LonLat } from "./Mercator";

document.addEventListener("DOMContentLoaded", () => {
  const queryParams = new URLSearchParams(location.search);

  const container = document.createElement("div");
  container.style.width = "100vw";
  container.style.height = "100vh";

  document.body.style.margin = "0px";
  document.body.append(container);

  const renderer = new MapRenderer(
    container,
    new LonLat(
      Number(queryParams.get("lon")) || 0,
      Number(queryParams.get("lat")) || 0
    ),
    2
  );
});
