import { LonLat } from "./Mercator";

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private lastRender: number = 0;
  private lastZ: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private location: LonLat = new LonLat(
      -88.22732760995116,
      40.110373226386486
    ),
    private zoomLevel: number = 10
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.lastZ = zoomLevel;

    this.canvas.onwheel = (e) => {
      const prevZoom = this.zoomLevel;
      this.zoomLevel = Math.min(
        24,
        Math.max(this.minZoomLevel, this.zoomLevel - 0.001 * e.deltaY)
      );
      this.draw(prevZoom);
    };

    window.addEventListener("resize", () => {
      this.resize();
      this.draw(this.zoomLevel);
    });

    this.resize();
    this.draw(this.zoomLevel);
  }

  private get minZoomLevel(): number {
    return Math.log2(Math.min(this.canvas.width, this.canvas.height) / 256);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  private get centerX(): number {
    return Math.floor((this.canvas.width - 1) / 2);
  }

  private get centerY(): number {
    return Math.floor((this.canvas.height - 1) / 2);
  }

  private get left(): number {
    return this.centerX;
  }

  private get right(): number {
    return this.canvas.width - 1 - this.centerX;
  }

  private get top(): number {
    return this.centerY;
  }

  private get bottom(): number {
    return this.canvas.height - 1 - this.centerY;
  }

  private drawTile(
    tile: HTMLImageElement,
    X: number,
    Y: number,
    Z: number,
    initiatedAt: number
  ) {
    if (initiatedAt != this.lastRender) return;
    const scale = 2 ** (this.zoomLevel - Z);
    const { x: locationX, y: locationY } = this.location.toMercator(
      this.zoomLevel
    );
    const tileX = (X << 8) * scale;
    const tileY = (Y << 8) * scale;
    const dx = Math.floor(this.centerX + tileX - locationX);
    const dy = Math.floor(this.centerY + tileY - locationY);
    const size = Math.ceil(256 * scale);
    this.ctx.drawImage(tile, dx, dy, size, size);
  }

  private scaleCurrentImage(prevZoomLevel: number) {
    const scale = 2 ** (this.zoomLevel - prevZoomLevel);
    const sw = this.canvas.width;
    const sh = this.canvas.height;
    const dx = Math.floor(this.centerX - this.left * scale);
    const dy = Math.floor(this.centerY - this.top * scale);
    const dw = Math.ceil(sw * scale);
    const dh = Math.ceil(sh * scale);
    this.ctx.drawImage(this.canvas, dx, dy, dw, dh);
  }

  private repeatImage() {
    const { x: locationX, y: locationY } = this.location.toMercator(
      this.zoomLevel
    );
    const mapSize = 256 * 2 ** this.zoomLevel;
    const originX = this.centerX - locationX;
    const originY = this.centerY - locationY;

    if (Math.floor(originX) > 0) {
      for (
        let nextOriginX = originX - mapSize;
        Math.floor(nextOriginX + mapSize) >= 0;
        nextOriginX -= mapSize
      ) {
        this.ctx.drawImage(
          this.canvas,
          Math.floor(originX),
          Math.floor(originY),
          Math.ceil(mapSize),
          Math.ceil(mapSize),
          Math.floor(nextOriginX),
          Math.floor(originY),
          Math.ceil(mapSize),
          Math.ceil(mapSize)
        );
      }
    }

    if (Math.ceil(originX + mapSize) < this.canvas.width - 1) {
    }
  }

  private draw(prevZoomLevel: number) {
    const initiatedAt = Date.now();
    if (initiatedAt - this.lastRender < 50) return;

    this.lastRender = initiatedAt;

    // Repaint current image at a new scale while waiting for new tiles to load
    // This is necessary in order to achieve a smooth transition
    this.scaleCurrentImage(prevZoomLevel);

    const Z = Math.ceil(this.zoomLevel);
    const scale = 2 ** (Z - this.zoomLevel);
    const { x: scaledX, y: scaledY } = this.location.toMercator(Z);

    const mapSizeAtZ = 256 << Z;
    const minX = Math.max(0, Math.floor(scaledX - this.left * scale)) >> 8;
    const maxX =
      Math.min(mapSizeAtZ - 1, Math.ceil(scaledX + this.right * scale)) >> 8;

    const minY = Math.max(0, Math.floor(scaledY - this.top * scale)) >> 8;
    const maxY =
      Math.min(mapSizeAtZ - 1, Math.ceil(scaledY + this.bottom * scale)) >> 8;

    const promises: Array<Promise<void>> = [];

    for (let X = minX; X <= maxX; ++X) {
      for (let Y = minY; Y <= maxY; ++Y) {
        const tile = new Image();
        tile.src = `https://mt3.google.com/vt/lyrs=s,h&x=${X}&y=${Y}&z=${Z}`;
        let _resolve: () => void;
        promises.push(
          new Promise((resolve) => {
            _resolve = resolve;
          })
        );
        tile.onload = () => {
          this.drawTile(tile, X, Y, Z, initiatedAt);
          _resolve();
        };
      }
    }

    Promise.all(promises).then(() => {
      this.repeatImage();
    });
  }
}
