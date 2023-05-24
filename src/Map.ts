import { LonLat } from "./Mercator";
import { Polygon, Shape } from "./Shapes";

export class MapRenderer {
  private lastRender = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private isMoving = false;
  private shapes: Array<Shape> = [];

  private baseLayer = new OffscreenCanvas(0, 0);
  private baseCtx = this.baseLayer.getContext("2d")!;
  private shapeLayer = new OffscreenCanvas(0, 0);
  private shapeCtx = this.shapeLayer.getContext("2d")!;
  private compositeCtx: CanvasRenderingContext2D;

  constructor(
    private canvas: HTMLCanvasElement,
    private focus: LonLat,
    private zoomLevel: number
  ) {
    this.compositeCtx = canvas.getContext("2d")!;

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
      this.draw();
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
      this.draw();
    };

    this.resize();
    this.draw();
  }

  private get minZoomLevel(): number {
    return 0;
    // return Math.log2(Math.min(this.canvas.width, this.canvas.height) / 256);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.shapeLayer.width = rect.width;
    this.shapeLayer.height = rect.height;
    this.baseLayer.width = rect.width;
    this.baseLayer.height = rect.height;
  }

  private get centerX(): number {
    return (this.canvas.width - 1) / 2;
  }

  private get centerY(): number {
    return (this.canvas.height - 1) / 2;
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
    const dx = this.centerX - this.left * scale;
    const dy = this.centerY - this.top * scale;
    const dw = sw * scale;
    const dh = sh * scale;
    this.baseCtx.drawImage(this.canvas, dx, dy, dw, dh);
  }

  private draw(prevZoomLevel: number = this.zoomLevel) {
    const initiatedAt = Date.now();
    if (initiatedAt - this.lastRender < 50) return;

    this.lastRender = initiatedAt;

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

    const drawTileTasks: Array<Promise<void>> = [];

    for (let X = startX; X <= endX; ++X) {
      for (let Y = startY; Y <= endY; ++Y) {
        let done: () => void;
        let abort: () => void;
        drawTileTasks.push(
          new Promise<void>((resolve, reject) => {
            done = resolve;
            abort = reject;
          })
        );

        const tile = new Image();
        tile.src = `https://mt3.google.com/vt/lyrs=s,h&x=${mod(X)}&y=${mod(
          Y
        )}&z=${mod(Z)}`;

        tile.onload = () => {
          if (initiatedAt != this.lastRender) {
            abort();
            return;
          }
          // FIX: must recompute tileSize
          const scale = 2 ** (this.zoomLevel - Z);
          const { x, y } = this.focus.toMercator(this.zoomLevel);
          const dx = this.centerX + X * 256 * scale - x;
          const dy = this.centerY + Y * 256 * scale - y;
          const size = 256 * scale;
          this.baseCtx.drawImage(tile, dx, dy, size, size);
          done();
        };
      }
    }

    Promise.all(drawTileTasks).then(() => {
      this.compose();
    });
  }

  public compose(): void {
    this.compositeCtx.drawImage(this.baseLayer, 0, 0);
    this.compositeCtx.drawImage(this.shapeLayer, 0, 0);
  }

  public add(shape: Shape): void {
    this.shapes.push(shape);
    // this.draw();
    this.drawShape(shape);
    this.compose();
  }

  private toCanvasPosition(location: LonLat): { x: number; y: number } {
    const loc = location.toMercator(this.zoomLevel);
    const center = this.focus.toMercator(this.zoomLevel);
    const x = this.centerX + loc.x - center.x;
    const y = this.centerY + loc.y - center.y;
    return { x, y };
  }

  private drawShapes(): void {
    this.shapeCtx.clearRect(0, 0, this.width, this.height);
    for (const shape of this.shapes) {
      this.drawShape(shape);
    }
  }

  private drawShape(shape: Shape): void {
    if (shape instanceof Polygon) {
      this.shapeCtx.beginPath(); // FIX

      const start = shape.vertices[0];
      const { x: startX, y: startY } = this.toCanvasPosition(start);
      this.shapeCtx.moveTo(startX, startY);

      shape.vertices.slice(1).forEach((vertex) => {
        const { x, y } = this.toCanvasPosition(vertex);
        this.shapeCtx.lineTo(x, y);
      });

      this.shapeCtx.fillStyle = "rgba(255, 95, 5, 0.5)";
      this.shapeCtx.closePath();
      this.shapeCtx.fill();
    }
  }
}
