import { LonLat } from "./Mercator";
import { Polygon } from "./Shapes";

export class MapRenderer {
  private renderId = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private isMoving = false;
  private shapes: Array<Polygon> = [];

  private baseLayer: CanvasRenderingContext2D;
  private shapeLayer: CanvasRenderingContext2D;

  private cache = new Map<string, Promise<HTMLImageElement>>();

  constructor(
    private containerEl: HTMLElement,
    private focus: LonLat,
    private zoomLevel: number
  ) {
    const rect = containerEl.getBoundingClientRect();
    const baseCanvas = document.createElement("canvas");
    const shapeCanvas = document.createElement("canvas");
    this.baseLayer = baseCanvas.getContext("2d")!;
    this.shapeLayer = shapeCanvas.getContext("2d")!;

    baseCanvas.width = shapeCanvas.width = rect.width;
    baseCanvas.height = shapeCanvas.height = rect.height;
    baseCanvas.style.left = shapeCanvas.style.left = "0px";
    baseCanvas.style.top = shapeCanvas.style.top = "0px";
    baseCanvas.style.position = shapeCanvas.style.position = "absolute";

    containerEl.append(baseCanvas);
    containerEl.append(shapeCanvas);

    containerEl.addEventListener(
      "wheel",
      (e) => {
        const prevZoom = this.zoomLevel;
        this.zoomLevel = Math.min(
          22,
          Math.max(this.minZoomLevel, this.zoomLevel - 0.001 * e.deltaY)
        );
        this.draw(prevZoom);
      },
      { passive: true }
    );

    window.addEventListener("resize", () => {
      this.resize();
      this.draw();
    });

    containerEl.onmousedown = (e) => {
      this.lastMouseX = e.offsetX;
      this.lastMouseY = e.offsetY;
      this.isMoving = true;
    };

    containerEl.onmouseup = () => {
      this.isMoving = false;
    };

    containerEl.onmousemove = (e) => {
      if (!this.isMoving) return;
      this.focus = this.focus
        .toMercator(this.zoomLevel)
        .translate(this.lastMouseX - e.offsetX, this.lastMouseY - e.offsetY)
        .toLonLat();
      this.lastMouseX = e.offsetX;
      this.lastMouseY = e.offsetY;
      this.draw();
    };

    containerEl.onclick = (e) => {
      if (e.metaKey) {
        const polygon = this.shapes.length ? this.shapes.pop()! : new Polygon();
        polygon.vertices.push(
          this.focus
            .toMercator(this.zoomLevel)
            .translate(e.offsetX - this.centerX, e.offsetY - this.centerY)
            .toLonLat()
        );
        this.shapes.push(polygon);
        this.drawShapes();
      } else {
        this.shapes.push(new Polygon());
      }
    };

    this.resize();
    this.draw();
  }

  private get minZoomLevel(): number {
    return 0;
    // return Math.log2(Math.min(this.canvas.width, this.canvas.height) / 256);
  }

  private resize() {
    const rect = this.containerEl.getBoundingClientRect();
    this.baseLayer.canvas.width = this.shapeLayer.canvas.width = rect.width;
    this.baseLayer.canvas.height = this.shapeLayer.canvas.height = rect.height;
  }

  private get centerX(): number {
    return (this.baseLayer.canvas.width - 1) / 2;
  }

  private get centerY(): number {
    return (this.baseLayer.canvas.height - 1) / 2;
  }

  private get width(): number {
    return this.baseLayer.canvas.width;
  }

  private get height(): number {
    return this.baseLayer.canvas.height;
  }

  private get left(): number {
    return this.centerX;
  }

  private get top(): number {
    return this.centerY;
  }

  private scaleCurrentImage(prevZoomLevel: number) {
    const scale = 2 ** (this.zoomLevel - prevZoomLevel);
    const sw = this.width;
    const sh = this.height;
    const dx = this.centerX - this.left * scale;
    const dy = this.centerY - this.top * scale;
    const dw = sw * scale;
    const dh = sh * scale;
    this.baseLayer.drawImage(this.baseLayer.canvas, dx, dy, dw, dh);
  }

  private draw(prevZoomLevel: number = this.zoomLevel) {
    this.renderId++;

    // Repaint current image at a new scale while waiting for new tiles to load
    // This is necessary in order to achieve a smooth transition
    this.scaleCurrentImage(prevZoomLevel);
    this.drawShapes();

    const Z = Math.round(this.zoomLevel);
    const scale = 2 ** (this.zoomLevel - Z);
    const { x, y } = this.focus.toMercator(this.zoomLevel);
    const currentTileSize = 256 * scale;

    const centerTileX = Math.floor(x / currentTileSize);
    const centerTileY = Math.floor(y / currentTileSize);
    const centerTileCanvasX = this.centerX - (x % currentTileSize);
    const centerTileCanvasY = this.centerY - (y % currentTileSize);

    const startX = centerTileX - Math.ceil(centerTileCanvasX / currentTileSize);
    const endX =
      centerTileX +
      Math.ceil((this.width - centerTileCanvasX) / currentTileSize) -
      1;

    const startY = centerTileY - Math.ceil(centerTileCanvasY / currentTileSize);
    const endY =
      centerTileY +
      Math.ceil((this.height - centerTileCanvasY) / currentTileSize) -
      1;

    const size = 1 << Z;
    const mod = (v: number) => ((v % size) + size) % size;

    for (let X = startX; X <= endX; ++X) {
      for (let Y = startY; Y <= endY; ++Y) {
        const key = `${mod(X)}-${mod(Y)}-${Z}`;
        if (!this.cache.has(key)) {
          this.cache.set(key, this.loadTile(mod(X), mod(Y), Z));
        }
        this.cache.get(key)!.then((tile) => {
          this.drawTile(tile, X, Y, Z, this.renderId);
        });
      }
    }
  }

  private loadTile(X: number, Y: number, Z: number): Promise<HTMLImageElement> {
    const tile = new Image();
    tile.src = `https://mt3.google.com/vt/lyrs=s,h&x=${X}&y=${Y}&z=${Z}`;
    tile.onload = () => _resolve(tile);
    let _resolve: (el: HTMLImageElement) => void;
    return new Promise((resolve) => (_resolve = resolve));
  }

  private drawTile(
    tile: HTMLImageElement,
    X: number,
    Y: number,
    Z: number,
    requestedBy: number
  ): void {
    // Cancel this task if a newer render has started.
    if (this.renderId > requestedBy) return;
    // FIX: scale might have changed, must recompute tileSize!
    const scale = 2 ** (this.zoomLevel - Z);
    const { x, y } = this.focus.toMercator(this.zoomLevel);
    const dx = Math.floor(this.centerX + X * 256 * scale - x);
    const dy = Math.floor(this.centerY + Y * 256 * scale - y);
    const size = 256 * scale;
    this.baseLayer.drawImage(tile, dx, dy, size, size);
  }

  private toCanvasPosition(location: LonLat): { x: number; y: number } {
    const loc = location.toMercator(this.zoomLevel);
    const center = this.focus.toMercator(this.zoomLevel);
    const x = this.centerX + loc.x - center.x;
    const y = this.centerY + loc.y - center.y;
    return { x, y };
  }

  private drawShapes(): void {
    this.shapeLayer.clearRect(0, 0, this.width, this.height);
    for (const shape of this.shapes) {
      this.drawShape(shape);
    }
  }

  private drawShape(shape: Polygon): void {
    if (shape.vertices.length) {
      this.shapeLayer.beginPath(); // FIX

      const start = shape.vertices[0];
      const { x: startX, y: startY } = this.toCanvasPosition(start);
      this.shapeLayer.moveTo(startX, startY);

      shape.vertices.slice(1).forEach((vertex) => {
        const { x, y } = this.toCanvasPosition(vertex);
        this.shapeLayer.lineTo(x, y);
      });

      this.shapeLayer.fillStyle = "rgba(255, 95, 5, 0.2)";
      this.shapeLayer.strokeStyle = "rgba(255, 95, 5, 1)";
      this.shapeLayer.lineWidth = 2;
      this.shapeLayer.closePath();
      this.shapeLayer.fill();
      this.shapeLayer.stroke();
    }
  }
}
