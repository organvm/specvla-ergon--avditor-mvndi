"use client";

import React, { useEffect, useRef } from "react";
import type p5 from "p5";
import { loadP5 } from "./loadP5";

interface AlignmentSigilProps {
  scores: {
    communication: number; // Mercury
    aesthetic: number; // Venus
    drive: number; // Mars
    structure: number; // Saturn
  };
}

export default function AlignmentSigil({ scores }: AlignmentSigilProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let p5Instance: p5 | undefined;
    let disposed = false;

    const sketch = (p: p5) => {
      let angle = 0;

      p.setup = () => {
        const canvas = p.createCanvas(300, 300);
        canvas.style("background", "transparent");
        p.angleMode(p.DEGREES);
      };

      p.draw = () => {
        p.clear(0, 0, 0, 0);
        p.translate(p.width / 2, p.height / 2);

        // Mercury (Communication) - Central intricate lines
        p.push();
        p.stroke(112, 0, 255, 150); // #7000ff
        p.strokeWeight(1);
        p.noFill();
        const mercScale = p.map(scores.communication, 0, 100, 20, 100);
        for (let i = 0; i < 6; i++) {
          p.rotate(60 + angle * 0.5);
          p.ellipse(0, 0, mercScale, mercScale / 2);
        }
        p.pop();

        // Venus (Aesthetic) - Soft orbiting rings
        p.push();
        p.stroke(0, 212, 255, 180); // #00d4ff
        p.strokeWeight(2);
        p.noFill();
        const venScale = p.map(scores.aesthetic, 0, 100, 50, 130);
        for (let i = 0; i < 3; i++) {
          p.rotate(120 - angle * 0.2);
          p.arc(0, 0, venScale, venScale + 20, 0, 180);
        }
        p.pop();

        // Mars (Drive) - Aggressive outer points
        p.push();
        p.stroke(255, 0, 112, 200); // #ff0070
        p.strokeWeight(2);
        p.noFill();
        const marsPoints = Math.floor(p.map(scores.drive, 0, 100, 3, 12));
        const marsRadius = p.map(scores.drive, 0, 100, 80, 140);
        p.rotate(angle);
        p.beginShape();
        for (let i = 0; i < 360; i += 360 / marsPoints) {
          const x = marsRadius * p.cos(i);
          const y = marsRadius * p.sin(i);
          p.vertex(x, y);
          // Inner point for star effect
          const ix = (marsRadius - 30) * p.cos(i + (180 / marsPoints));
          const iy = (marsRadius - 30) * p.sin(i + (180 / marsPoints));
          p.vertex(ix, iy);
        }
        p.endShape(p.CLOSE);
        p.pop();

        // Saturn (Structure) - Solid structural framework
        p.push();
        p.stroke(255, 204, 0, 120); // #ffcc00
        p.strokeWeight(p.map(scores.structure, 0, 100, 1, 5));
        p.noFill();
        const satRadius = p.map(scores.structure, 0, 100, 100, 145);
        p.rotate(-angle * 0.3);
        p.rectMode(p.CENTER);
        p.rect(0, 0, satRadius, satRadius);
        p.rotate(45);
        p.rect(0, 0, satRadius, satRadius);
        p.pop();

        angle += 0.5;
      };
    };

    void loadP5().then((P5) => {
      if (disposed || !containerRef.current) return;
      p5Instance = new P5(sketch, containerRef.current);
    });

    return () => {
      disposed = true;
      p5Instance?.remove();
    };
  }, [scores]);

  return (
    <div 
      className="card" 
      style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        padding: "2rem",
        background: "rgba(0,0,0,0.4)"
      }}
    >
      <div style={{ position: "relative" }}>
        <div ref={containerRef} />
        <div style={{ 
          position: "absolute", 
          bottom: "-20px", 
          left: 0, 
          right: 0, 
          textAlign: "center", 
          fontSize: "0.6rem", 
          color: "var(--text-muted)", 
          letterSpacing: "0.2em",
          textTransform: "uppercase" 
        }}>
          Alignment Sigil
        </div>
      </div>
    </div>
  );
}
