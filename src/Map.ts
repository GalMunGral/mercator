import { LonLat } from "./Mercator";

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private lastRender = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private isMoving = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private focus: LonLat = new LonLat(-88.22732760995116, 40.110373226386486),
    private zoomLevel: number = 10
  ) {
    this.ctx = canvas.getContext("2d")!;

    this.canvas.onwheel = (e) => {
      const prevZoom = this.zoomLevel;
      this.zoomLevel = Math.min(
        22,
        Math.max(this.minZoomLevel, this.zoomLevel - 0.001 * e.deltaY)
      );
      this.draw(prevZoom);
    };

    window.addEventListener("resize", () => {
      this.resize();
      this.draw(this.zoomLevel);
    });

    canvas.onmousedown = (e) => {
      this.lastMouseX = e.offsetX;
      this.lastMouseY = e.offsetY;
      this.isMoving = true;
    };

    canvas.onmouseup = () => {
      this.isMoving = false;
    };

    canvas.onmousemove = (e) => {
      if (!this.isMoving) return;
      this.focus = this.focus
        .toMercator(this.zoomLevel)
        .translate(this.lastMouseX - e.offsetX, this.lastMouseY - e.offsetY)
        .toLonLat();
      this.lastMouseX = e.offsetX;
      this.lastMouseY = e.offsetY;
      this.draw(this.zoomLevel);
    };

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

  private get width(): number {
    return this.canvas.width;
  }

  private get height(): number {
    return this.canvas.height;
  }

  private get left(): number {
    return this.centerX;
  }

  private get top(): number {
    return this.centerY;
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

  private draw(prevZoomLevel: number) {
    const initiatedAt = Date.now();
    if (initiatedAt - this.lastRender < 50) return;

    this.lastRender = initiatedAt;

    // Repaint current image at a new scale while waiting for new tiles to load
    // This is necessary in order to achieve a smooth transition
    this.scaleCurrentImage(prevZoomLevel);

    const Z = Math.round(this.zoomLevel);
    const scale = 2 ** (this.zoomLevel - Z);
    const { x, y } = this.focus.toMercator(this.zoomLevel);
    const tileSize = 256 * scale;

    const centerTileX = Math.floor(x / tileSize);
    const centerTileY = Math.floor(y / tileSize);
    const centerTileCanvasX = this.centerX - (x % tileSize);
    const centerTileCanvasY = this.centerY - (y % tileSize);

    const startX = centerTileX - Math.ceil(centerTileCanvasX / tileSize);
    const endX =
      centerTileX + Math.ceil((this.width - centerTileCanvasX) / tileSize) - 1;

    const startY = centerTileY - Math.ceil(centerTileCanvasY / tileSize);
    const endY =
      centerTileY + Math.ceil((this.height - centerTileCanvasY) / tileSize) - 1;

    const size = 1 << Z;
    const mod = (v: number) => ((v % size) + size) % size;

    for (let X = startX; X <= endX; ++X) {
      for (let Y = startY; Y <= endY; ++Y) {
        const dx = centerTileCanvasX + (X - centerTileX) * tileSize;
        const dy = centerTileCanvasY + (Y - centerTileY) * tileSize;
        const tile = new Image();
        tile.src = `https://mt3.google.com/vt/lyrs=s,h&x=${mod(X)}&y=${mod(
          Y
        )}&z=${mod(Z)}`;
        tile.onload = () => {
          if (initiatedAt != this.lastRender) return;
          this.ctx.drawImage(
            tile,
            Math.floor(dx),
            Math.floor(dy),
            Math.ceil(tileSize),
            Math.ceil(tileSize)
          );
        };
      }
    }
  }
}
