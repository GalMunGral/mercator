import { MapRenderer } from "./Map";
import { LonLat } from "./Mercator";
import { Polygon } from "./Shapes";

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

  renderer.add(
    new Polygon([
      [-88.33512499498896, 40.098815524231895],
      [-88.32544078091173, 40.064484100730425],
      [-88.29477410300132, 40.05806047381586],
      [-88.29606533154482, 40.02494448586481],
      [-88.24215653984939, 40.02568606459303],
      [-88.23182671150062, 40.07658852061675],
      [-88.1601635273306, 40.079552540429034],
      [-88.16080914160256, 40.1420139192098],
      [-88.29186883877836, 40.16298609296277],
      [-88.33512499498896, 40.098815524231895],
    ])
  );
});
