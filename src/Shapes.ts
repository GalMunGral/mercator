import { LonLat } from "./Mercator";

export interface Shape {}

export class Polygon implements Shape {
  public vertices: Array<LonLat> = [];
  constructor(coordinates: Array<[number, number]>) {
    this.vertices = coordinates.map(([lon, lat]) => new LonLat(lon, lat));
  }
}
