"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * STARGATE CORRIDOR
 * WebGL fragment shader inspired by the slit-scan photography
 * in 2001: A Space Odyssey and the wormhole in Interstellar.
 *
 * Creates structured light planes stretching into a vanishing point,
 * with turbulent color corridors and depth-mapped striations.
 *
 * Responds to:
 * - Time of day (color palette shifts)
 * - Device orientation (parallax vanishing point)
 * - Scroll position (speed modulation)
 */

// GLSL vertex shader
const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// GLSL fragment shader — the slit-scan Stargate effect
const FRAGMENT_SHADER = `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_offset;       // device orientation parallax
  uniform float u_hue_shift;   // time-of-day color rotation
  uniform float u_speed;       // scroll-modulated speed

  // Convert HSV to RGB
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // Fractal Brownian motion noise for turbulence
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

    // Apply device orientation parallax
    uv += u_offset * 0.15;

    float t = u_time * u_speed;

    // === SLIT-SCAN TUNNEL GEOMETRY ===
    // Convert to polar coordinates centered on vanishing point
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Tunnel depth — the key slit-scan transformation
    float depth = 0.5 / (radius + 0.01);

    // Scrolling tunnel coordinates
    float tunnel_u = angle / 3.14159;
    float tunnel_v = depth + t * 0.3;

    // === STRUCTURED LIGHT PLANES ===
    // Create the horizontal striation pattern (like slit-scan photography)
    float striations = sin(tunnel_v * 20.0) * 0.5 + 0.5;
    striations *= sin(tunnel_v * 7.0 + tunnel_u * 3.0) * 0.5 + 0.5;

    // Vertical light bars (the corridor walls)
    float bars = smoothstep(0.0, 0.05, abs(sin(tunnel_u * 8.0 + t * 0.1)));

    // === TURBULENT COLOR ===
    // FBM-driven color turbulence (Interstellar wormhole clouds)
    float turb = fbm(vec2(tunnel_u * 2.0, tunnel_v * 0.5) + t * 0.05);

    // Multi-hue color bands rotating with time-of-day shift
    float hue = fract(
      tunnel_u * 0.3 +
      depth * 0.1 +
      turb * 0.4 +
      u_hue_shift +
      t * 0.02
    );

    float saturation = 0.7 + turb * 0.3;
    float value = striations * bars * smoothstep(0.0, 0.3, radius);

    // Central glow — the blinding white core
    float core_glow = exp(-radius * 4.0) * 0.8;

    // Depth fade — brighter near center of tunnel
    float depth_brightness = smoothstep(8.0, 0.5, depth) * 1.2;
    value *= depth_brightness;

    // === COMPOSE ===
    vec3 color = hsv2rgb(vec3(hue, saturation, value));

    // Add the hot white core
    color += vec3(core_glow);

    // Edge vignette
    float vignette = 1.0 - smoothstep(0.3, 1.4, radius);
    color *= vignette;

    // Subtle film grain
    float grain = (hash(gl_FragCoord.xy + t) - 0.5) * 0.03;
    color += grain;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function getTimeOfDayHue(): number {
  const hour = new Date().getHours();
  // Dawn (5-7): warm amber 0.08
  // Morning (7-11): cool blue 0.6
  // Midday (11-14): white-blue 0.55
  // Afternoon (14-17): golden 0.12
  // Dusk (17-20): purple-magenta 0.8
  // Night (20-5): deep blue-violet 0.7
  if (hour >= 5 && hour < 7) return 0.08;
  if (hour >= 7 && hour < 11) return 0.6;
  if (hour >= 11 && hour < 14) return 0.55;
  if (hour >= 14 && hour < 17) return 0.12;
  if (hour >= 17 && hour < 20) return 0.8;
  return 0.7;
}

export default function SpaceTimeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const [orientation, setOrientation] = useState({ x: 0, y: 0 });
  const speedRef = useRef(1.0);

  // Device orientation listener
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const x = (e.gamma || 0) / 90; // -1 to 1 (tilt left/right)
      const y = (e.beta || 0) / 180;  // -1 to 1 (tilt forward/back)
      setOrientation({ x, y });
    };

    // Try to get permission on iOS 13+
    const doe = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (doe.requestPermission) {
      // Will be triggered by user gesture later
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  // Scroll speed modulation
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const scrollRatio = maxScroll > 0 ? scrollY / maxScroll : 0;
      speedRef.current = 0.6 + scrollRatio * 1.4; // 0.6x at top, 2.0x at bottom
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // WebGL initialization and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;
    glRef.current = gl;

    // Compile shaders
    function compileShader(source: string, type: number): WebGLShader | null {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl!.getShaderInfoLog(shader));
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertShader = compileShader(VERTEX_SHADER, gl.VERTEX_SHADER);
    const fragShader = compileShader(FRAGMENT_SHADER, gl.FRAGMENT_SHADER);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;
    gl.useProgram(program);

    // Full-screen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uOffset = gl.getUniformLocation(program, "u_offset");
    const uHueShift = gl.getUniformLocation(program, "u_hue_shift");
    const uSpeed = gl.getUniformLocation(program, "u_speed");

    const hueShift = getTimeOfDayHue();
    startTimeRef.current = Date.now();

    // Resize handler
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Render loop
    const render = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uOffset, orientation.x, orientation.y);
      gl.uniform1f(uHueShift, hueShift);
      gl.uniform1f(uSpeed, speedRef.current);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [orientation]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -5,
        pointerEvents: "none",
      }}
    />
  );
}
