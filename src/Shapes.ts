import { LonLat } from "./Mercator";

export interface Shape {}

export class Polygon implements Shape {
  constructor(public vertices: Array<LonLat> = []) {}
}
