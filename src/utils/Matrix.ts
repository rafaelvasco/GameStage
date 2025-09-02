/**
 * Matrix utility class for 4x4 matrix operations used in 2D/3D graphics rendering.
 * All matrices are stored in column-major order as Float32Array with 16 elements.
 *
 * This class centralizes matrix operations that were previously scattered across
 * Canvas.ts, WebGL2Graphics.ts, and WebGPUGraphics.ts for better code organization
 * and reusability.
 */
export class Matrix {
  // Pre-allocated arrays to reduce memory allocations in hot paths
  private static readonly tempMatrix1: Float32Array = new Float32Array(16);
  private static readonly tempMatrix2: Float32Array = new Float32Array(16);
  private static readonly tempPoint: { x: number; y: number } = { x: 0, y: 0 };
  /**
   * Creates a 4x4 identity matrix
   * @returns Float32Array containing identity matrix values
   */
  static createIdentity(): Float32Array {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  /**
   * Sets a matrix to identity values (in-place operation)
   * @param matrix - Target matrix to set to identity
   */
  static setIdentity(matrix: Float32Array): void {
    matrix[0] = 1;
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    matrix[4] = 0;
    matrix[5] = 1;
    matrix[6] = 0;
    matrix[7] = 0;
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    matrix[12] = 0;
    matrix[13] = 0;
    matrix[14] = 0;
    matrix[15] = 1;
  }

  /**
   * Creates a translation matrix
   * @param x - Translation X offset
   * @param y - Translation Y offset
   * @param z - Translation Z offset (default: 0)
   * @returns Float32Array containing translation matrix
   */
  static createTranslation(x: number, y: number, z: number = 0): Float32Array {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  /**
   * Sets a matrix to translation values (in-place operation)
   * @param matrix - Target matrix to modify
   * @param x - Translation X offset
   * @param y - Translation Y offset
   * @param z - Translation Z offset (default: 0)
   */
  static setTranslation(
    matrix: Float32Array,
    x: number,
    y: number,
    z: number = 0
  ): void {
    Matrix.setIdentity(matrix);
    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;
  }

  /**
   * Creates a scale matrix
   * @param x - Scale factor for X axis
   * @param y - Scale factor for Y axis
   * @param z - Scale factor for Z axis (default: 1)
   * @returns Float32Array containing scale matrix
   */
  static createScale(x: number, y: number, z: number = 1): Float32Array {
    return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  }

  /**
   * Sets a matrix to scale values (in-place operation)
   * @param matrix - Target matrix to modify
   * @param x - Scale factor for X axis
   * @param y - Scale factor for Y axis
   * @param z - Scale factor for Z axis (default: 1)
   */
  static setScale(
    matrix: Float32Array,
    x: number,
    y: number,
    z: number = 1
  ): void {
    Matrix.setIdentity(matrix);
    matrix[0] = x;
    matrix[5] = y;
    matrix[10] = z;
  }

  /**
   * Creates a rotation matrix around the Z axis (2D rotation)
   * @param angle - Rotation angle in radians
   * @returns Float32Array containing rotation matrix
   */
  static createRotationZ(angle: number): Float32Array {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new Float32Array([
      cos,
      sin,
      0,
      0,
      -sin,
      cos,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
    ]);
  }

  /**
   * Sets a matrix to rotation values around Z axis (in-place operation)
   * @param matrix - Target matrix to modify
   * @param angle - Rotation angle in radians
   */
  static setRotationZ(matrix: Float32Array, angle: number): void {
    Matrix.setIdentity(matrix);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    matrix[0] = cos;
    matrix[1] = sin;
    matrix[4] = -sin;
    matrix[5] = cos;
  }

  /**
   * Creates an orthographic projection matrix
   * @param left - Left edge of the projection volume
   * @param right - Right edge of the projection volume
   * @param bottom - Bottom edge of the projection volume
   * @param top - Top edge of the projection volume
   * @param near - Near clipping plane distance
   * @param far - Far clipping plane distance
   * @returns Float32Array containing the orthographic projection matrix
   */
  static createOrthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number
  ): Float32Array {
    const matrix = new Float32Array(16);
    Matrix.setOrthographic(matrix, left, right, bottom, top, near, far);
    return matrix;
  }

  /**
   * Sets a matrix to orthographic projection values (in-place operation)
   * @param matrix - Target matrix to modify
   * @param left - Left edge of the projection volume
   * @param right - Right edge of the projection volume
   * @param bottom - Bottom edge of the projection volume
   * @param top - Top edge of the projection volume
   * @param near - Near clipping plane distance
   * @param far - Far clipping plane distance
   */
  static setOrthographic(
    matrix: Float32Array,
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number
  ): void {
    matrix[0] = 2 / (right - left);
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;

    matrix[4] = 0;
    matrix[5] = 2 / (top - bottom);
    matrix[6] = 0;
    matrix[7] = 0;

    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = -2 / (far - near);
    matrix[11] = 0;

    matrix[12] = -(right + left) / (right - left);
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[14] = -(far + near) / (far - near);
    matrix[15] = 1;
  }

  /**
   * Multiplies two 4x4 matrices and returns the result in a new matrix
   * @param a - First matrix (left operand)
   * @param b - Second matrix (right operand)
   * @returns Float32Array containing the result (a * b)
   */
  static multiply(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);
    Matrix.multiplyInPlace(a, b, result);
    return result;
  }

  /**
   * Multiplies two 4x4 matrices in-place (no allocation)
   * @param a - First matrix (left operand)
   * @param b - Second matrix (right operand)
   * @param result - Target matrix to store the result (a * b)
   */
  static multiplyInPlace(
    a: Float32Array,
    b: Float32Array,
    result: Float32Array
  ): void {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
  }

  /**
   * Compares two matrices for equality
   * @param a - First matrix
   * @param b - Second matrix
   * @returns true if matrices are equal, false otherwise
   */
  static equals(a: Float32Array, b: Float32Array): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }

    return true;
  }

  /**
   * Copies values from source matrix to destination matrix
   * @param source - Source matrix to copy from
   * @param destination - Destination matrix to copy to
   */
  static copy(source: Float32Array, destination: Float32Array): void {
    destination.set(source);
  }

  /**
   * Creates a copy of the given matrix
   * @param matrix - Matrix to copy
   * @returns Float32Array containing a copy of the matrix
   */
  static clone(matrix: Float32Array): Float32Array {
    return new Float32Array(matrix);
  }

  /**
   * Transforms a 2D point by the given matrix
   * @param matrix - Transformation matrix
   * @param x - X coordinate of the point
   * @param y - Y coordinate of the point
   * @returns Object containing transformed x and y coordinates (reused object)
   */
  static transformPoint(
    matrix: Float32Array,
    x: number,
    y: number
  ): { x: number; y: number } {
    const transformedX = matrix[0] * x + matrix[4] * y + matrix[12];
    const transformedY = matrix[1] * x + matrix[5] * y + matrix[13];

    Matrix.tempPoint.x = transformedX;
    Matrix.tempPoint.y = transformedY;
    return Matrix.tempPoint;
  }

  /**
   * Creates a matrix that combines translation, rotation, and scale operations
   * @param tx - Translation X offset
   * @param ty - Translation Y offset
   * @param rotation - Rotation angle in radians
   * @param scaleX - Scale factor for X axis
   * @param scaleY - Scale factor for Y axis
   * @returns Float32Array containing the combined transformation matrix
   */
  static createTransform(
    tx: number,
    ty: number,
    rotation: number = 0,
    scaleX: number = 1,
    scaleY: number = 1
  ): Float32Array {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return new Float32Array([
      cos * scaleX,
      sin * scaleX,
      0,
      0,
      -sin * scaleY,
      cos * scaleY,
      0,
      0,
      0,
      0,
      1,
      0,
      tx,
      ty,
      0,
      1,
    ]);
  }

  /**
   * Creates the inverse of a 4x4 matrix
   * @param matrix - Matrix to invert
   * @returns Float32Array containing the inverse matrix, or null if matrix is not invertible
   */
  static createInverse(matrix: Float32Array): Float32Array | null {
    const result = new Float32Array(16);
    if (Matrix.setInverse(result, matrix)) {
      return result;
    }
    return null;
  }

  /**
   * Gets a temporary matrix for intermediate calculations (avoids allocation)
   * WARNING: This matrix is reused - copy the result if you need to keep it
   * @returns Pre-allocated temporary matrix
   */
  static getTempMatrix1(): Float32Array {
    return Matrix.tempMatrix1;
  }

  /**
   * Gets a second temporary matrix for intermediate calculations (avoids allocation)
   * WARNING: This matrix is reused - copy the result if you need to keep it
   * @returns Pre-allocated temporary matrix
   */
  static getTempMatrix2(): Float32Array {
    return Matrix.tempMatrix2;
  }

  /**
   * Sets a matrix to the inverse of the given matrix (in-place operation)
   * @param result - Target matrix to store the inverse
   * @param matrix - Matrix to invert
   * @returns true if successful, false if matrix is not invertible
   */
  static setInverse(result: Float32Array, matrix: Float32Array): boolean {
    const m = matrix;
    // Use temp matrix instead of allocating new one
    const inv = Matrix.tempMatrix2;

    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

    const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];

    if (Math.abs(det) < 1e-8) {
      return false; // Matrix is not invertible
    }

    const detInv = 1.0 / det;

    for (let i = 0; i < 16; i++) {
      result[i] = inv[i] * detInv;
    }

    return true;
  }

  /**
   * Gets a string representation of the matrix for debugging
   * @param matrix - Matrix to stringify
   * @param precision - Number of decimal places (default: 3)
   * @returns String representation of the matrix
   */
  static toString(matrix: Float32Array, precision: number = 3): string {
    const rows = [];
    for (let i = 0; i < 4; i++) {
      const row = [];
      for (let j = 0; j < 4; j++) {
        row.push(matrix[i * 4 + j].toFixed(precision));
      }
      rows.push(`[${row.join(", ")}]`);
    }
    return `Matrix4x4:\n${rows.join("\n")}`;
  }
}
