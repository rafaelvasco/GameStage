// TexturedQuadShader.ts - Default textured quad rendering shader for WebGPU

export const TEXTURED_QUAD_SHADER_WGSL = `
// Vertex shader uniforms
struct QuadUniforms {
    mvpMatrix: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: QuadUniforms;
@group(0) @binding(1) var quadTexture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;

// Vertex input
struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) texCoord: vec2<f32>,
    @location(2) color: u32,
}

// Vertex output / Fragment input
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) color: vec4<f32>,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Transform position
    output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 0.0, 1.0);
    
    // Pass through texture coordinates directly
    output.texCoord = input.texCoord;
    
    // Unpack RGBA8 color from u32 (RGBA format: R in bits 0-7, G in 8-15, B in 16-23, A in 24-31)
    let r = f32((input.color >> 0u) & 0xFFu) / 255.0;
    let g = f32((input.color >> 8u) & 0xFFu) / 255.0;
    let b = f32((input.color >> 16u) & 0xFFu) / 255.0;
    let a = f32((input.color >> 24u) & 0xFFu) / 255.0;
    let vertexColor = vec4<f32>(r, g, b, a);
    
    // Pass through per-vertex color
    output.color = vertexColor;
    
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let textureColor = textureSample(quadTexture, textureSampler, input.texCoord);
    return textureColor * input.color;
}
`;

// Quad uniform buffer structure (must match WGSL)
export interface QuadUniforms {
  mvpMatrix: Float32Array; // 16 floats (64 bytes)
}

export const QUAD_UNIFORM_BUFFER_SIZE = 64; // 64 bytes for just the matrix
