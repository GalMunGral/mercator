export class LonLat {
  private _cache = new Map<number, Mercator>();
  constructor(public longitude: number, public latitude: number) {}

  public toMercator(zoom: number): Mercator {
    if (!this._cache.has(zoom)) {
      const long = this.longitude * (Math.PI / 180);
      const lat = this.latitude * (Math.PI / 180);
      this._cache.set(
        zoom,
        new Mercator(
          (128 / Math.PI) * 2 ** zoom * (long + Math.PI),
          (128 / Math.PI) *
            2 ** zoom *
            (Math.PI - Math.log(Math.tan(Math.PI / 4 + lat / 2))),
          zoom
        )
      );
    }
    return this._cache.get(zoom)!;
  }
}

export class Mercator {
  private _cache: LonLat | null = null;
  constructor(public x: number, public y: number, public zoom: number) {}

  public toLonLat(): LonLat {
    if (!this._cache) {
      this._cache = new LonLat(
        (this.x / ((128 / Math.PI) * 2 ** this.zoom) - Math.PI) *
          (180 / Math.PI),
        (2 *
          Math.atan(
            Math.exp(Math.PI - this.y / ((128 / Math.PI) * 2 ** this.zoom))
          ) -
          Math.PI / 2) *
          (180 / Math.PI)
      );
    }
    return this._cache;
  }

  public translate(dx: number, dy: number) {
    const mapSize = 256 * 2 ** this.zoom;
    return new Mercator(
      mod(this.x + dx, mapSize),
      mod(this.y + dy, mapSize),
      this.zoom
    );
  }
}

function mod(x: number, n: number) {
  return ((x % n) + n) % n;
}
