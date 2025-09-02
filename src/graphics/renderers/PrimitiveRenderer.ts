// PrimitiveRenderer.ts - Handles all primitive and shape drawing operations

import { BaseRenderer } from "./IRenderer";
import { Color } from "../Color";
import { QuadRenderer } from "./QuadRenderer";

/**
 * Specialized renderer for primitive shapes and geometric drawing.
 * 
 * Handles:
 * - Rectangle drawing (outline and filled)
 * - Circle and oval drawing (outline and filled)
 * - Triangle drawing (outline and filled)
 * - Line drawing with various widths
 * - Point/pixel drawing
 * - Equilateral triangle utilities
 */
export class PrimitiveRenderer extends BaseRenderer {
  private quadRenderer!: QuadRenderer;

  /**
   * Initialize with quad renderer dependency for texture-based primitives
   */
  initializeWithQuadRenderer(quadRenderer: QuadRenderer): void {
    this.quadRenderer = quadRenderer;
  }

  /**
   * Draw a rectangle outline
   * @param x - X position
   * @param y - Y position
   * @param width - Rectangle width
   * @param height - Rectangle height
   * @param color - Rectangle color
   * @param lineWidth - Line width (default: 1)
   */
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    lineWidth: number = 1
  ): void {
    this.ensureInitialized();
    const halfLine = lineWidth / 2;

    // Top edge
    this.quadRenderer.drawQuadInternal(
      this.whiteTexture,
      x - halfLine,
      y - halfLine,
      width + lineWidth,
      lineWidth,
      0,
      0,
      undefined,
      color,
      0
    );
    // Bottom edge
    this.quadRenderer.drawQuadInternal(
      this.whiteTexture,
      x - halfLine,
      y + height - halfLine,
      width + lineWidth,
      lineWidth,
      0,
      0,
      undefined,
      color,
      0
    );
    // Left edge
    this.quadRenderer.drawQuadInternal(
      this.whiteTexture,
      x - halfLine,
      y + halfLine,
      lineWidth,
      height - lineWidth,
      0,
      0,
      undefined,
      color,
      0
    );
    // Right edge
    this.quadRenderer.drawQuadInternal(
      this.whiteTexture,
      x + width - halfLine,
      y + halfLine,
      lineWidth,
      height - lineWidth,
      0,
      0,
      undefined,
      color,
      0
    );
  }

  /**
   * Draw a filled rectangle
   * @param x - X position
   * @param y - Y position
   * @param width - Rectangle width
   * @param height - Rectangle height
   * @param color - Rectangle color
   */
  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color
  ): void {
    this.ensureInitialized();
    this.quadRenderer.drawQuadInternal(
      this.whiteTexture,
      x,
      y,
      width,
      height,
      0,
      0,
      undefined,
      color,
      0,
      1.0,
      1.0
    );
  }

  /**
   * Draw a filled rectangle with transform support
   * @param x - X position
   * @param y - Y position
   * @param width - Rectangle width
   * @param height - Rectangle height
   * @param color - Rectangle color
   * @param rotation - Optional rotation in radians (default: 0)
   * @param scaleX - Optional horizontal scale factor (default: 1.0)
   * @param scaleY - Optional vertical scale factor (default: 1.0)
   */
  fillRectEx(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.ensureInitialized();
    this.quadRenderer.drawQuadInternal(
      this.whiteTexture,
      x,
      y,
      width,
      height,
      0,
      0,
      undefined,
      color,
      rotation || 0,
      scaleX || 1.0,
      scaleY || 1.0
    );
  }

  /**
   * Draw a circle outline using high-quality segment approximation
   * @param x - Center X position
   * @param y - Center Y position
   * @param radius - Circle radius
   * @param color - Circle color
   * @param lineWidth - Line width (default: 1)
   * @param segments - Number of segments to approximate circle (default: auto-calculated for quality)
   */
  drawCircle(
    x: number,
    y: number,
    radius: number,
    color: Color,
    lineWidth: number = 1,
    segments?: number
  ): void {
    this.ensureInitialized();
    // Auto-calculate segments based on radius for optimal quality
    // Use more segments for larger circles, fewer for smaller ones
    const calculatedSegments =
      segments || Math.max(8, Math.min(128, Math.ceil(radius * 2)));

    const angleStep = (2 * Math.PI) / calculatedSegments;

    // For better circle rendering without gaps, use rotated rectangles
    for (let i = 0; i < calculatedSegments; i++) {
      const angle1 = i * angleStep;
      const angle2 = (i + 1) * angleStep;

      const x1 = x + Math.cos(angle1) * radius;
      const y1 = y + Math.sin(angle1) * radius;
      const x2 = x + Math.cos(angle2) * radius;
      const y2 = y + Math.sin(angle2) * radius;

      // Calculate segment length and center
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const angle = Math.atan2(dy, dx);

        // Draw segment as a rotated rectangle with sub-pixel precision
        this.quadRenderer.drawQuadInternal(
          this.whiteTexture,
          centerX,
          centerY,
          length + 0.1, // Slight overlap to eliminate gaps
          lineWidth,
          0.5, // pivot at center X
          0.5, // pivot at center Y
          undefined,
          color,
          angle
        );
      }
    }
  }

  /**
   * Draw a filled circle using horizontal scanline approach
   * @param x - Center X position
   * @param y - Center Y position
   * @param radius - Circle radius
   * @param color - Circle color
   */
  fillCircle(x: number, y: number, radius: number, color: Color): void {
    this.ensureInitialized();
    const radiusSquared = radius * radius;
    const centerX = Math.round(x);
    const centerY = Math.round(y);
    const intRadius = Math.ceil(radius);

    // Use scanline approach for efficient circle filling
    for (let dy = -intRadius; dy <= intRadius; dy++) {
      const currentY = centerY + dy;

      // Calculate the half-width of the circle at this Y position
      const distanceFromCenterY = dy * dy;
      if (distanceFromCenterY > radiusSquared) continue;

      const halfWidth = Math.sqrt(radiusSquared - distanceFromCenterY);
      const leftX = Math.ceil(centerX - halfWidth);
      const rightX = Math.floor(centerX + halfWidth);
      const width = rightX - leftX + 1;

      if (width > 0) {
        // Draw a horizontal line using fillRect for efficiency
        this.fillRect(leftX, currentY, width, 1, color);
      }
    }
  }

  /**
   * Draw a filled circle with transform support
   * @param x - Center X position
   * @param y - Center Y position  
   * @param radius - Circle radius
   * @param color - Circle color
   * @param rotation - Optional rotation in radians (default: 0)
   * @param scaleX - Optional horizontal scale factor (default: 1.0)
   * @param scaleY - Optional vertical scale factor (default: 1.0)
   */
  fillCircleEx(
    x: number,
    y: number,
    radius: number,
    color: Color,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    this.ensureInitialized();
    
    // For circles with minimal or no transforms, use the proper circle rendering
    const finalScaleX = scaleX || 1.0;
    const finalScaleY = scaleY || 1.0;
    const finalRotation = rotation || 0;
    
    // If it's a perfect circle (even if rotating), use fast circle rendering
    // Rotation of a perfect circle is not visible, so we can optimize this case
    if (Math.abs(finalScaleX - finalScaleY) < 0.001 && 
        Math.abs(finalScaleX - 1.0) < 0.001) {
      this.fillCircle(x, y, radius, color);
      return;
    }
    
    // If it's a uniformly scaled circle (scaleX == scaleY), also use fast circle rendering
    // because rotation of a uniformly scaled circle is also not visible
    if (Math.abs(finalScaleX - finalScaleY) < 0.001) {
      this.fillCircle(x, y, radius * finalScaleX, color);
      return;
    }
    
    // For scaled/rotated circles, render as a rotated ellipse using triangle fan
    const scaledRadiusX = radius * finalScaleX;
    const scaledRadiusY = radius * finalScaleY;
    const centerX = x;
    const centerY = y;
    
    // Calculate rotation
    const cos = Math.cos(finalRotation);
    const sin = Math.sin(finalRotation);
    
    // Use triangle fan approach with good quality
    const segments = Math.max(16, Math.min(32, Math.ceil(Math.max(scaledRadiusX, scaledRadiusY))));
    
    for (let i = 0; i < segments; i++) {
      const angle1 = (i * 2 * Math.PI) / segments;
      const angle2 = ((i + 1) * 2 * Math.PI) / segments;
      
      // Calculate ellipse points in local space
      const localX1 = scaledRadiusX * Math.cos(angle1);
      const localY1 = scaledRadiusY * Math.sin(angle1);
      const localX2 = scaledRadiusX * Math.cos(angle2);
      const localY2 = scaledRadiusY * Math.sin(angle2);
      
      // Apply rotation and translation
      const worldX1 = localX1 * cos - localY1 * sin + centerX;
      const worldY1 = localX1 * sin + localY1 * cos + centerY;
      const worldX2 = localX2 * cos - localY2 * sin + centerX;
      const worldY2 = localX2 * sin + localY2 * cos + centerY;
      
      // Draw triangle with consistent winding order (counter-clockwise)
      this.fillTriangle(centerX, centerY, worldX1, worldY1, worldX2, worldY2, color);
    }
  }

  /**
   * Draw a circle outline with transform support
   * @param x - Center X position
   * @param y - Center Y position
   * @param radius - Circle radius
   * @param color - Stroke color
   * @param strokeWidth - Line width (default: 1)
   * @param rotation - Optional rotation in radians (default: 0)
   * @param scaleX - Optional horizontal scale factor (default: 1.0)
   * @param scaleY - Optional vertical scale factor (default: 1.0)
   */
  drawCircleEx(
    x: number,
    y: number,
    radius: number,
    color: Color,
    strokeWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    // For circles with minimal transforms, use the basic method
    const finalScaleX = scaleX || 1.0;
    const finalScaleY = scaleY || 1.0;
    const finalRotation = rotation || 0;
    
    // If it's a perfect circle (even if rotating), use fast circle rendering
    // Rotation of a perfect circle is not visible, so we can optimize this case
    if (Math.abs(finalScaleX - finalScaleY) < 0.001 && 
        Math.abs(finalScaleX - 1.0) < 0.001) {
      this.drawCircle(x, y, radius, color, strokeWidth);
      return;
    }
    
    // If it's a uniformly scaled circle (scaleX == scaleY), also use fast circle rendering
    // because rotation of a uniformly scaled circle is also not visible
    if (Math.abs(finalScaleX - finalScaleY) < 0.001) {
      this.drawCircle(x, y, radius * finalScaleX, color, strokeWidth);
      return;
    }
    
    // For scaled/rotated circles, draw a rotated ellipse outline
    const scaledRadiusX = radius * finalScaleX;
    const scaledRadiusY = radius * finalScaleY;
    
    // Calculate the number of segments based on the ellipse size
    const maxRadius = Math.max(scaledRadiusX, scaledRadiusY);
    const segments = Math.max(16, Math.min(32, Math.ceil(maxRadius)));
    
    const cos = Math.cos(finalRotation);
    const sin = Math.sin(finalRotation);
    const centerX = x;
    const centerY = y;
    
    // Draw the ellipse outline as a series of rotated line segments
    for (let i = 0; i < segments; i++) {
      const angle1 = (i * 2 * Math.PI) / segments;
      const angle2 = ((i + 1) * 2 * Math.PI) / segments;
      
      // Calculate unrotated ellipse points
      const x1 = scaledRadiusX * Math.cos(angle1);
      const y1 = scaledRadiusY * Math.sin(angle1);
      const x2 = scaledRadiusX * Math.cos(angle2);
      const y2 = scaledRadiusY * Math.sin(angle2);
      
      // Apply rotation
      const rx1 = x1 * cos - y1 * sin + centerX;
      const ry1 = x1 * sin + y1 * cos + centerY;
      const rx2 = x2 * cos - y2 * sin + centerX;
      const ry2 = x2 * sin + y2 * cos + centerY;
      
      // Draw line segment
      this.drawLine(rx1, ry1, rx2, ry2, color, strokeWidth);
    }
  }

  /**
   * Draw a rectangle outline with transform support
   * @param x - Top-left X position
   * @param y - Top-left Y position
   * @param width - Rectangle width
   * @param height - Rectangle height
   * @param color - Stroke color
   * @param strokeWidth - Line width (default: 1)
   * @param rotation - Optional rotation in radians (default: 0)
   * @param scaleX - Optional horizontal scale factor (default: 1.0)
   * @param scaleY - Optional vertical scale factor (default: 1.0)
   */
  drawRectEx(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
    strokeWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    // For rectangles with minimal transforms, use the basic method
    const finalScaleX = scaleX || 1.0;
    const finalScaleY = scaleY || 1.0;
    const finalRotation = rotation || 0;
    
    if (Math.abs(finalScaleX - 1.0) < 0.001 && 
        Math.abs(finalScaleY - 1.0) < 0.001 && 
        Math.abs(finalRotation) < 0.001) {
      this.drawRect(x, y, width, height, color, strokeWidth);
      return;
    }
    
    // For transformed rectangles, draw the four sides as lines with proper transformation
    const scaledWidth = width * finalScaleX;
    const scaledHeight = height * finalScaleY;
    
    // Rotate around the top-left corner (x, y) to match fillRectEx behavior
    const cos = Math.cos(finalRotation);
    const sin = Math.sin(finalRotation);
    
    // Calculate rotated corners directly without allocating objects
    // Top-left (0, 0 relative to x,y)
    const x1 = x;
    const y1 = y;
    
    // Top-right (scaledWidth, 0 relative to x,y)
    const tx2 = scaledWidth;
    const ty2 = 0;
    const x2 = tx2 * cos - ty2 * sin + x;
    const y2 = tx2 * sin + ty2 * cos + y;
    
    // Bottom-right (scaledWidth, scaledHeight relative to x,y)
    const tx3 = scaledWidth;
    const ty3 = scaledHeight;
    const x3 = tx3 * cos - ty3 * sin + x;
    const y3 = tx3 * sin + ty3 * cos + y;
    
    // Bottom-left (0, scaledHeight relative to x,y)
    const tx4 = 0;
    const ty4 = scaledHeight;
    const x4 = tx4 * cos - ty4 * sin + x;
    const y4 = tx4 * sin + ty4 * cos + y;
    
    // Draw the four edges using the calculated coordinates
    this.drawLine(x1, y1, x2, y2, color, strokeWidth); // Top
    this.drawLine(x2, y2, x3, y3, color, strokeWidth); // Right
    this.drawLine(x3, y3, x4, y4, color, strokeWidth); // Bottom
    this.drawLine(x4, y4, x1, y1, color, strokeWidth); // Left
  }

  /**
   * Draw an oval outline using high-quality segment approximation
   * @param x - Center X position
   * @param y - Center Y position
   * @param radiusX - Horizontal radius
   * @param radiusY - Vertical radius
   * @param color - Oval color
   * @param lineWidth - Line width (default: 1)
   * @param segments - Number of segments to approximate oval (default: auto-calculated for quality)
   */
  drawOval(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    color: Color,
    lineWidth: number = 1,
    segments?: number
  ): void {
    this.ensureInitialized();
    // Auto-calculate segments based on larger radius for optimal quality
    const maxRadius = Math.max(radiusX, radiusY);
    const calculatedSegments =
      segments || Math.max(8, Math.min(64, Math.ceil(maxRadius * 0.5)));

    const angleStep = (2 * Math.PI) / calculatedSegments;

    // For better oval rendering without gaps, use rotated rectangles
    for (let i = 0; i < calculatedSegments; i++) {
      const angle1 = i * angleStep;
      const angle2 = (i + 1) * angleStep;

      const x1 = x + Math.cos(angle1) * radiusX;
      const y1 = y + Math.sin(angle1) * radiusY;
      const x2 = x + Math.cos(angle2) * radiusX;
      const y2 = y + Math.sin(angle2) * radiusY;

      // Calculate segment length and center
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const angle = Math.atan2(dy, dx);

        // Draw segment as a rotated rectangle with sub-pixel precision
        this.quadRenderer.drawQuadInternal(
          this.whiteTexture,
          centerX,
          centerY,
          length + 0.1, // Slight overlap to eliminate gaps
          lineWidth,
          0.5, // pivot at center X
          0.5, // pivot at center Y
          undefined,
          color,
          angle
        );
      }
    }
  }

  /**
   * Draw a filled oval using horizontal scanline approach
   * @param x - Center X position
   * @param y - Center Y position
   * @param radiusX - Horizontal radius
   * @param radiusY - Vertical radius
   * @param color - Oval color
   */
  fillOval(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    color: Color
  ): void {
    this.ensureInitialized();
    const centerX = Math.round(x);
    const centerY = Math.round(y);
    const intRadiusY = Math.ceil(radiusY);

    // Use scanline approach for efficient oval filling
    for (let dy = -intRadiusY; dy <= intRadiusY; dy++) {
      const currentY = centerY + dy;

      // Calculate the half-width of the oval at this Y position using ellipse equation
      const normalizedY = dy / radiusY;
      const normalizedYSquared = normalizedY * normalizedY;

      if (normalizedYSquared > 1) continue;

      const halfWidth = radiusX * Math.sqrt(1 - normalizedYSquared);
      const leftX = Math.ceil(centerX - halfWidth);
      const rightX = Math.floor(centerX + halfWidth);
      const width = rightX - leftX + 1;

      if (width > 0) {
        // Draw a horizontal line using fillRect for efficiency
        this.fillRect(leftX, currentY, width, 1, color);
      }
    }
  }

  /**
   * Draw a triangle outline
   * @param x1 - First vertex X
   * @param y1 - First vertex Y
   * @param x2 - Second vertex X
   * @param y2 - Second vertex Y
   * @param x3 - Third vertex X
   * @param y3 - Third vertex Y
   * @param color - Triangle color
   * @param lineWidth - Line width (default: 1)
   */
  drawTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color,
    lineWidth: number = 1
  ): void {
    this.drawLine(x1, y1, x2, y2, color, lineWidth);
    this.drawLine(x2, y2, x3, y3, color, lineWidth);
    this.drawLine(x3, y3, x1, y1, color, lineWidth);
  }

  /**
   * Draw a filled triangle using scanline algorithm
   * @param x1 - First vertex X
   * @param y1 - First vertex Y
   * @param x2 - Second vertex X
   * @param y2 - Second vertex Y
   * @param x3 - Third vertex X
   * @param y3 - Third vertex Y
   * @param color - Triangle color
   */
  fillTriangle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color
  ): void {
    this.ensureInitialized();
    // Sort vertices by Y coordinate (bubble sort for only 3 elements)
    let vertices = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y3 },
    ];

    if (vertices[0].y > vertices[1].y)
      [vertices[0], vertices[1]] = [vertices[1], vertices[0]];
    if (vertices[1].y > vertices[2].y)
      [vertices[1], vertices[2]] = [vertices[2], vertices[1]];
    if (vertices[0].y > vertices[1].y)
      [vertices[0], vertices[1]] = [vertices[1], vertices[0]];

    const v0 = vertices[0];
    const v1 = vertices[1];
    const v2 = vertices[2];

    // Check for degenerate triangle
    if (Math.abs(v2.y - v0.y) < 0.001) return;

    const minY = Math.ceil(v0.y);
    const maxY = Math.floor(v2.y);

    // Scanline fill
    for (let y = minY; y <= maxY; y++) {
      let leftX: number, rightX: number;

      // Find intersection points with triangle edges
      if (y <= v1.y) {
        // Upper part of triangle (from v0 to v1)
        leftX = this.interpolateX(v0, v2, y);
        rightX = this.interpolateX(v0, v1, y);
      } else {
        // Lower part of triangle (from v1 to v2)
        leftX = this.interpolateX(v0, v2, y);
        rightX = this.interpolateX(v1, v2, y);
      }

      // Ensure leftX <= rightX
      if (leftX > rightX) [leftX, rightX] = [rightX, leftX];

      const startX = Math.ceil(leftX);
      const endX = Math.floor(rightX);
      const width = endX - startX + 1;

      if (width > 0) {
        this.fillRect(startX, y, width, 1, color);
      }
    }
  }

  /**
   * Helper function to interpolate X coordinate along an edge
   * @param p1 - First point
   * @param p2 - Second point
   * @param y - Y coordinate to interpolate at
   * @returns Interpolated X coordinate
   */
  private interpolateX(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    y: number
  ): number {
    if (Math.abs(p2.y - p1.y) < 0.001) {
      return p1.x; // Horizontal edge
    }
    const t = (y - p1.y) / (p2.y - p1.y);
    return p1.x + t * (p2.x - p1.x);
  }

  /**
   * Draw a line using Bresenham's algorithm
   * @param x1 - Start X position
   * @param y1 - Start Y position
   * @param x2 - End X position
   * @param y2 - End Y position
   * @param color - Line color
   * @param lineWidth - Line width (default: 1)
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: Color,
    lineWidth: number = 1
  ): void {
    this.ensureInitialized();

    if (!this.whiteTexture) {
      this.logger.error(
        "PrimitiveRenderer drawLine: white texture not available! Renderer may not be properly initialized."
      );
      return; // Don't throw, just return so scene can continue
    }

    // Handle line width
    if (lineWidth <= 1) {
      this.drawLinePrimitive(
        Math.round(x1),
        Math.round(y1),
        Math.round(x2),
        Math.round(y2),
        color
      );
    } else {
      // For thick lines, draw as a single rotated rectangle
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length > 0) {
        // Calculate center point and rotation angle
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const angle = Math.atan2(dy, dx);

        // Draw a rotated rectangle using drawQuadInternal
        this.quadRenderer.drawQuadInternal(
          this.whiteTexture,
          centerX,
          centerY,
          length,
          lineWidth,
          0.5, // pivot at center X
          0.5, // pivot at center Y
          undefined,
          color,
          angle
        );
      }
    }
  }

  /**
   * Draw a single pixel line using optimized scanline approach
   * @param x1 - Start X position
   * @param y1 - Start Y position
   * @param x2 - End X position
   * @param y2 - End Y position
   * @param color - Line color
   */
  private drawLinePrimitive(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: Color
  ): void {
    // Handle horizontal and vertical lines efficiently
    if (y1 === y2) {
      // Horizontal line
      const startX = Math.min(x1, x2);
      const width = Math.abs(x2 - x1) + 1;
      this.fillRect(startX, y1, width, 1, color);
      return;
    }

    if (x1 === x2) {
      // Vertical line
      const startY = Math.min(y1, y2);
      const height = Math.abs(y2 - y1) + 1;
      this.fillRect(x1, startY, 1, height, color);
      return;
    }

    // For diagonal lines, use Bresenham's algorithm but collect points into horizontal runs
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let currentX = x1;
    let currentY = y1;
    let runStartX = currentX;
    let runY = currentY;
    let runLength = 1;

    while (true) {
      if (currentX === x2 && currentY === y2) {
        // Draw final run
        this.fillRect(runStartX, runY, runLength, 1, color);
        break;
      }

      const e2 = 2 * err;
      let moved = false;

      if (e2 > -dy) {
        err -= dy;
        currentX += sx;
        moved = true;
      }
      if (e2 < dx) {
        err += dx;

        if (moved) {
          // We moved both X and Y, so end the current run and start a new one
          this.fillRect(runStartX, runY, runLength, 1, color);
          runStartX = currentX;
          runLength = 1;
        } else {
          // Only moved Y, so end current run and start new one
          this.fillRect(runStartX, runY, runLength, 1, color);
          runLength = 1;
        }

        currentY += sy;
        runY = currentY;

        if (!moved) {
          runStartX = currentX;
        }
      } else if (moved) {
        // Only moved X, extend current run
        runLength++;
      }
    }
  }

  /**
   * Draw a single point/pixel
   * @param x - X position
   * @param y - Y position
   * @param color - Point color
   */
  drawPoint(x: number, y: number, color: Color): void {
    this.ensureInitialized();

    if (!this.whiteTexture) {
      this.logger.error(
        "PrimitiveRenderer drawPoint: white texture not available! Renderer may not be properly initialized."
      );
      return; // Don't throw, just return so scene can continue
    }

    this.quadRenderer.drawQuadInternal(
      this.whiteTexture,
      x,
      y,
      1,
      1,
      0,
      0,
      undefined,
      color,
      0
    );
  }

  /**
   * Draw an equilateral triangle outline (all sides equal length)
   * @param centerX - Center X position of the triangle
   * @param centerY - Center Y position of the triangle
   * @param sideLength - Length of each side of the triangle
   * @param color - Triangle outline color
   * @param lineWidth - Line width for the outline (default: 1)
   * @param rotation - Rotation angle in radians (default: 0, pointing up)
   */
  drawEquilateralTriangle(
    centerX: number,
    centerY: number,
    sideLength: number,
    color: Color,
    lineWidth: number = 1,
    rotation: number = 0
  ): void {
    // Distance from center to vertex (circumradius): radius = side * sqrt(3) / 3
    const radius = (sideLength * Math.sqrt(3)) / 3;

    // Calculate the three vertices at 120-degree intervals
    // Starting angle: -π/2 (pointing up) + rotation
    const angle1 = -Math.PI / 2 + rotation;
    const angle2 = angle1 + (2 * Math.PI) / 3;
    const angle3 = angle2 + (2 * Math.PI) / 3;

    const x1 = centerX + radius * Math.cos(angle1);
    const y1 = centerY + radius * Math.sin(angle1);
    const x2 = centerX + radius * Math.cos(angle2);
    const y2 = centerY + radius * Math.sin(angle2);
    const x3 = centerX + radius * Math.cos(angle3);
    const y3 = centerY + radius * Math.sin(angle3);

    this.drawTriangle(x1, y1, x2, y2, x3, y3, color, lineWidth);
  }

  /**
   * Draw a filled equilateral triangle (all sides equal length)
   * @param centerX - Center X position of the triangle
   * @param centerY - Center Y position of the triangle
   * @param sideLength - Length of each side of the triangle
   * @param color - Triangle fill color
   * @param rotation - Rotation angle in radians (default: 0, pointing up)
   */
  fillEquilateralTriangle(
    centerX: number,
    centerY: number,
    sideLength: number,
    color: Color,
    rotation: number = 0
  ): void {
    // Distance from center to vertex (circumradius): radius = side * sqrt(3) / 3
    const radius = (sideLength * Math.sqrt(3)) / 3;

    // Calculate the three vertices at 120-degree intervals
    // Starting angle: -π/2 (pointing up) + rotation
    const angle1 = -Math.PI / 2 + rotation;
    const angle2 = angle1 + (2 * Math.PI) / 3;
    const angle3 = angle2 + (2 * Math.PI) / 3;

    const x1 = centerX + radius * Math.cos(angle1);
    const y1 = centerY + radius * Math.sin(angle1);
    const x2 = centerX + radius * Math.cos(angle2);
    const y2 = centerY + radius * Math.sin(angle2);
    const x3 = centerX + radius * Math.cos(angle3);
    const y3 = centerY + radius * Math.sin(angle3);

    this.fillTriangle(x1, y1, x2, y2, x3, y3, color);
  }

  /**
   * Draw an equilateral triangle outline positioned by its base
   * @param baseX - X position of the base center
   * @param baseY - Y position of the base
   * @param sideLength - Length of each side
   * @param color - Triangle outline color
   * @param lineWidth - Line width for the outline (default: 1)
   * @param pointingUp - Whether triangle points up (true) or down (false)
   */
  drawEquilateralTriangleFromBase(
    baseX: number,
    baseY: number,
    sideLength: number,
    color: Color,
    lineWidth: number = 1,
    pointingUp: boolean = true
  ): void {
    // Height of an equilateral triangle: height = side * sqrt(3) / 2
    const height = (sideLength * Math.sqrt(3)) / 2;
    const halfSide = sideLength / 2;

    let x1, y1, x2, y2, x3, y3;

    if (pointingUp) {
      // Triangle pointing up
      x1 = baseX; // Top vertex
      y1 = baseY - height;
      x2 = baseX - halfSide; // Bottom left vertex
      y2 = baseY;
      x3 = baseX + halfSide; // Bottom right vertex
      y3 = baseY;
    } else {
      // Triangle pointing down
      x1 = baseX; // Bottom vertex
      y1 = baseY + height;
      x2 = baseX - halfSide; // Top left vertex
      y2 = baseY;
      x3 = baseX + halfSide; // Top right vertex
      y3 = baseY;
    }

    this.drawTriangle(x1, y1, x2, y2, x3, y3, color, lineWidth);
  }

  /**
   * Draw a filled equilateral triangle positioned by its base
   * @param baseX - X position of the base center
   * @param baseY - Y position of the base
   * @param sideLength - Length of each side
   * @param color - Triangle fill color
   * @param pointingUp - Whether triangle points up (true) or down (false)
   */
  fillEquilateralTriangleFromBase(
    baseX: number,
    baseY: number,
    sideLength: number,
    color: Color,
    pointingUp: boolean = true
  ): void {
    // Height of an equilateral triangle: height = side * sqrt(3) / 2
    const height = (sideLength * Math.sqrt(3)) / 2;
    const halfSide = sideLength / 2;

    let x1, y1, x2, y2, x3, y3;

    if (pointingUp) {
      // Triangle pointing up
      x1 = baseX; // Top vertex
      y1 = baseY - height;
      x2 = baseX - halfSide; // Bottom left vertex
      y2 = baseY;
      x3 = baseX + halfSide; // Bottom right vertex
      y3 = baseY;
    } else {
      // Triangle pointing down
      x1 = baseX; // Bottom vertex
      y1 = baseY + height;
      x2 = baseX - halfSide; // Top left vertex
      y2 = baseY;
      x3 = baseX + halfSide; // Top right vertex
      y3 = baseY;
    }

    this.fillTriangle(x1, y1, x2, y2, x3, y3, color);
  }

  /**
   * Draw a filled triangle with rotation and scaling support
   */
  fillTriangleEx(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    const finalRotation = rotation || 0;
    const finalScaleX = scaleX || 1;
    const finalScaleY = scaleY || 1;

    // If no transformation needed, use the basic method
    if (finalRotation === 0 && finalScaleX === 1 && finalScaleY === 1) {
      this.fillTriangle(x1, y1, x2, y2, x3, y3, color);
      return;
    }

    // Apply transformations to each vertex
    const cos = Math.cos(finalRotation);
    const sin = Math.sin(finalRotation);

    // Find center point for rotation
    const centerX = (x1 + x2 + x3) / 3;
    const centerY = (y1 + y2 + y3) / 3;

    // Transform each vertex directly without allocating objects
    // Transform vertex 1
    let tx1 = x1 - centerX;
    let ty1 = y1 - centerY;
    tx1 *= finalScaleX;
    ty1 *= finalScaleY;
    const rx1 = tx1 * cos - ty1 * sin + centerX;
    const ry1 = tx1 * sin + ty1 * cos + centerY;

    // Transform vertex 2  
    let tx2 = x2 - centerX;
    let ty2 = y2 - centerY;
    tx2 *= finalScaleX;
    ty2 *= finalScaleY;
    const rx2 = tx2 * cos - ty2 * sin + centerX;
    const ry2 = tx2 * sin + ty2 * cos + centerY;

    // Transform vertex 3
    let tx3 = x3 - centerX;
    let ty3 = y3 - centerY;
    tx3 *= finalScaleX;
    ty3 *= finalScaleY;
    const rx3 = tx3 * cos - ty3 * sin + centerX;
    const ry3 = tx3 * sin + ty3 * cos + centerY;

    this.fillTriangle(rx1, ry1, rx2, ry2, rx3, ry3, color);
  }

  /**
   * Draw a triangle outline with rotation and scaling support
   */
  drawTriangleEx(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    color: Color,
    lineWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    const finalRotation = rotation || 0;
    const finalScaleX = scaleX || 1;
    const finalScaleY = scaleY || 1;

    // If no transformation needed, use the basic method
    if (finalRotation === 0 && finalScaleX === 1 && finalScaleY === 1) {
      this.drawTriangle(x1, y1, x2, y2, x3, y3, color, lineWidth);
      return;
    }

    // Apply transformations to each vertex
    const cos = Math.cos(finalRotation);
    const sin = Math.sin(finalRotation);

    // Find center point for rotation
    const centerX = (x1 + x2 + x3) / 3;
    const centerY = (y1 + y2 + y3) / 3;

    // Transform each vertex directly without allocating objects
    // Transform vertex 1
    let tx1 = x1 - centerX;
    let ty1 = y1 - centerY;
    tx1 *= finalScaleX;
    ty1 *= finalScaleY;
    const rx1 = tx1 * cos - ty1 * sin + centerX;
    const ry1 = tx1 * sin + ty1 * cos + centerY;

    // Transform vertex 2  
    let tx2 = x2 - centerX;
    let ty2 = y2 - centerY;
    tx2 *= finalScaleX;
    ty2 *= finalScaleY;
    const rx2 = tx2 * cos - ty2 * sin + centerX;
    const ry2 = tx2 * sin + ty2 * cos + centerY;

    // Transform vertex 3
    let tx3 = x3 - centerX;
    let ty3 = y3 - centerY;
    tx3 *= finalScaleX;
    ty3 *= finalScaleY;
    const rx3 = tx3 * cos - ty3 * sin + centerX;
    const ry3 = tx3 * sin + ty3 * cos + centerY;

    this.drawTriangle(rx1, ry1, rx2, ry2, rx3, ry3, color, lineWidth);
  }

  /**
   * Draw a line with rotation and scaling support
   */
  drawLineEx(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: Color,
    lineWidth: number = 1,
    rotation?: number,
    scaleX?: number,
    scaleY?: number
  ): void {
    const finalRotation = rotation || 0;
    const finalScaleX = scaleX || 1;
    const finalScaleY = scaleY || 1;

    // If no transformation needed, use the basic method
    if (finalRotation === 0 && finalScaleX === 1 && finalScaleY === 1) {
      this.drawLine(x1, y1, x2, y2, color, lineWidth);
      return;
    }

    // Apply transformations to each endpoint
    const cos = Math.cos(finalRotation);
    const sin = Math.sin(finalRotation);

    // Find center point for rotation
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    // Transform each endpoint directly without allocating objects
    // Transform point 1
    let tx1 = x1 - centerX;
    let ty1 = y1 - centerY;
    tx1 *= finalScaleX;
    ty1 *= finalScaleY;
    const rx1 = tx1 * cos - ty1 * sin + centerX;
    const ry1 = tx1 * sin + ty1 * cos + centerY;

    // Transform point 2
    let tx2 = x2 - centerX;
    let ty2 = y2 - centerY;
    tx2 *= finalScaleX;
    ty2 *= finalScaleY;
    const rx2 = tx2 * cos - ty2 * sin + centerX;
    const ry2 = tx2 * sin + ty2 * cos + centerY;

    this.drawLine(rx1, ry1, rx2, ry2, color, lineWidth);
  }

}