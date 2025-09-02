// TexturedQuadShaderWebGL2.ts - WebGL2 shader for rendering textured quads with per-vertex colors

export class TexturedQuadShaderWebGL2 {
  static getVertexShaderSource(): string {
    return `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      in uint a_color;
      
      uniform mat4 u_mvpMatrix;
      
      out vec2 v_texCoord;
      out vec4 v_color;
      
      void main() {
        gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
        
        // Unpack RGBA color from uint32 (RGBA format: R in bits 0-7, G in 8-15, B in 16-23, A in 24-31)
        uint r = (a_color >> 0u) & 0xFFu;
        uint g = (a_color >> 8u) & 0xFFu;
        uint b = (a_color >> 16u) & 0xFFu;
        uint a = (a_color >> 24u) & 0xFFu;
        
        v_color = vec4(float(r), float(g), float(b), float(a)) / 255.0;
      }
    `;
  }

  static getFragmentShaderSource(): string {
    return `#version 300 es
      precision mediump float;
      
      in vec2 v_texCoord;
      in vec4 v_color;
      uniform sampler2D u_texture;
      
      out vec4 fragColor;
      
      void main() {
        vec4 texColor = texture(u_texture, v_texCoord);
        fragColor = texColor * v_color;
      }
    `;
  }

  static getVertexBufferLayout(): {
    stride: number;
    attributes: Array<{
      name: string;
      size: number;
      type: number;
      normalized: boolean;
      offset: number;
    }>;
  } {
    // Interleaved vertex format: position (2 floats) + texCoord (2 floats) + color (1 uint32)
    // Total: 5 * 4 bytes = 20 bytes per vertex
    return {
      stride: 20,
      attributes: [
        {
          name: "a_position",
          size: 2,
          type: WebGL2RenderingContext.FLOAT,
          normalized: false,
          offset: 0,
        },
        {
          name: "a_texCoord",
          size: 2,
          type: WebGL2RenderingContext.FLOAT,
          normalized: false,
          offset: 8,
        },
        {
          name: "a_color",
          size: 1,
          type: WebGL2RenderingContext.UNSIGNED_INT,
          normalized: false,
          offset: 16,
        },
      ],
    };
  }
}
