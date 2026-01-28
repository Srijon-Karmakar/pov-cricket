

// perfect game
import React, { Suspense, useMemo, useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, Html, useProgress } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

/* ---------- Loader ---------- */
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 14,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 12,
          letterSpacing: 0.5,
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        Loading… {Math.round(progress)}%
      </div>
    </Html>
  );
}

/* ---------- Draco GLB Loader ---------- */
function DracoGLBModel({
  url,
  dracoPath = "/draco/",
  forceDecoder = "auto",
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onSceneReady,
}) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath(dracoPath);

    if (forceDecoder === "js") draco.setDecoderConfig({ type: "js" });
    if (forceDecoder === "wasm") draco.setDecoderConfig({ type: "wasm" });

    loader.setDRACOLoader(draco);
  });

  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  // ✅ keep latest callback without re-triggering effect every render
  const onReadyRef = useRef(onSceneReady);
  useEffect(() => {
    onReadyRef.current = onSceneReady;
  }, [onSceneReady]);

  // ✅ defer callback to next frame (avoids setState-in-render warnings)
  useEffect(() => {
    if (!cloned) return;
    const id = requestAnimationFrame(() => onReadyRef.current?.(cloned));
    return () => cancelAnimationFrame(id);
  }, [cloned]);

  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={scale}
      dispose={null}
    />
  );
}

/* ---------- Fixed POV Camera (wicket -> bowler) ---------- */
function FixedPovCamera({
  points,
  defaultFov = 52,
  backOffset = 0.1,
  upOffset = 0.2,
  debug = false,
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!points?.wicket || !points?.bowler) return;

    const wicket = points.wicket;
    const bowler = points.bowler;

    wicket.updateWorldMatrix(true, false);
    bowler.updateWorldMatrix(true, false);

    const wicketPos = new THREE.Vector3();
    const bowlerPos = new THREE.Vector3();

    wicket.getWorldPosition(wicketPos);
    bowler.getWorldPosition(bowlerPos);

    const dir = bowlerPos.clone().sub(wicketPos).normalize();
    const camPos = wicketPos.clone().add(dir.clone().multiplyScalar(-backOffset));
    camPos.y += upOffset;

    camera.position.copy(camPos);
    camera.fov = defaultFov;
    camera.up.set(0, 1, 0);
    camera.lookAt(bowlerPos);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    if (debug) {
      console.log("WicketPos:", wicketPos.toArray());
      console.log("CameraPos:", camPos.toArray());
      console.log("BowlerPos:", bowlerPos.toArray());
    }
  }, [points, camera, defaultFov, backOffset, upOffset, debug]);

  return null;
}

/* ---------- Bowling Ball Logic (NOW: variable speed + variable bounce) ---------- */
/* ---------- Bowling System with Batting Logic ---------- */
function BowlingSystem({
  points,
  intervalMs = 2500, // Slowed slightly to make it playable
  speedMin = 26,
  speedMax = 44,
  bounceHeightMin = 0.1,
  bounceHeightMax = 0.42,
  bounceTMin = 0.5,
  bounceTMax = 0.72,
  randomLine = 0.45,
  randomLength = 0.45,
  ballRadius = 0.04, // Visually slightly larger for visibility
}) {
  const ballRef = useRef(null);
  const [lastShot, setLastShot] = useState(null); // To show UI feedback

  // Physics constants
  const GRAVITY = 9.8;
  const DRAG = 0.98; // Air resistance
  const BOUNCE_DAMPING = 0.6; // Energy lost on bounce

  const state = useRef({
    phase: "IDLE", // IDLE | BOWLING | HIT
    t: 0,
    
    // Bezier Paths (Bowling)
    start: new THREE.Vector3(),
    bounce: new THREE.Vector3(),
    end: new THREE.Vector3(),
    speed: 35,
    h1: 0.25,
    h2: 0.18,

    // Physics Vectors (Batting)
    velocity: new THREE.Vector3(),
  });

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);
  const r = (a, b) => a + Math.random() * (b - a);

  // Bezier curve helper
  const qBezier = (p0, p1, p2, t, out) => {
    const it = 1 - t;
    out.set(0, 0, 0)
       .addScaledVector(p0, it * it)
       .addScaledVector(p1, 2 * it * t)
       .addScaledVector(p2, t * t);
    return out;
  };

  // --- 1. START THE THROW ---
  const startThrow = () => {
    if (!points?.bowler || !points?.wicket || !points?.batsman) return;
    
    // Reset state
    setLastShot(null); 
    const s = state.current;
    
    // Get world positions
    const start = new THREE.Vector3();
    const wicketPos = new THREE.Vector3();
    const batsPos = new THREE.Vector3();
    
    points.bowler.getWorldPosition(start);
    points.wicket.getWorldPosition(wicketPos);
    points.batsman.getWorldPosition(batsPos);

    // Calculate trajectory
    const mix = r(0.25, 0.85);
    const end = wicketPos.clone().lerp(batsPos, mix);
    end.x += r(-randomLine, randomLine);
    end.z += r(-randomLength, randomLength);

    const bt = THREE.MathUtils.clamp(r(bounceTMin, bounceTMax), 0.35, 0.85);
    const bounce = start.clone().lerp(end, bt);
    bounce.y = Math.min(bounce.y, wicketPos.y + 0.02);

    // Set State
    s.phase = "BOWLING";
    s.t = 0;
    s.start.copy(start);
    s.bounce.copy(bounce);
    s.end.copy(end);
    s.speed = r(speedMin, speedMax);
    
    // Arc heights
    const h = r(bounceHeightMin, bounceHeightMax);
    s.h1 = Math.max(0.06, h);
    s.h2 = Math.max(0.04, h * 0.65);

    if (ballRef.current) {
      ballRef.current.position.copy(start);
      ballRef.current.visible = true;
    }
  };

  // --- 2. HANDLE THE HIT (CLICK) ---
  const handleHit = (e) => {
    e.stopPropagation(); // Prevent clicking through to other stuff
    
    const s = state.current;
    if (s.phase !== "BOWLING") return; // Can only hit while ball is being bowled

    // A. CALCULATE TIMING
    const ballPos = ballRef.current.position;
    const wicketPos = new THREE.Vector3();
    points.wicket.getWorldPosition(wicketPos);

    // Distance to stumps determines timing
    const dist = ballPos.distanceTo(wicketPos);
    
    let timingQuality = "";
    let color = "";
    let power = 0;
    let elevation = 0;
    let sideAngle = 0;

    // Logic: 
    // < 1.0m = Perfect (Straight Drive)
    // 1.0m - 3.0m = Good (Off Drive / Pull)
    // > 3.0m = Too Early/Late (Edge or Miss)
    
    if (dist < 1.5) {
      timingQuality = "PERFECT TIMING!";
      color = "#4ade80"; // Green
      power = 25; 
      elevation = 0.4; // Lofted
      sideAngle = r(-0.1, 0.1); // Straight
    } else if (dist < 3.5) {
      timingQuality = "GOOD CONTACT";
      color = "#facc15"; // Yellow
      power = 18;
      elevation = 0.1; // Grounded
      // If clicked early (ball far away), hit to leg side
      sideAngle = 0.5; 
    } else {
      timingQuality = "MISTIMED...";
      color = "#f87171"; // Red
      power = 5; // Weak hit
      elevation = 0.8; // Pop up
      sideAngle = r(-1, 1); // Random edge
    }

    setLastShot({ text: timingQuality, color });

    // B. CALCULATE HIT VECTOR (PHYSICS START)
    s.phase = "HIT";
    
    // Base direction: Bowler to Wicket (inverted) -> Wicket to Bowler
    const dir = new THREE.Vector3().subVectors(s.start, s.end).normalize();
    
    // Apply timing angles
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), sideAngle); // Side to side
    dir.y += elevation; // Loft
    dir.normalize();

    // Set initial velocity
    s.velocity.copy(dir.multiplyScalar(power));
  };

  // --- 3. GAME LOOP ---
  useFrame((_, delta) => {
    const ball = ballRef.current;
    const s = state.current;
    if (!ball || s.phase === "IDLE") return;

    // === PHASE A: BOWLING (Animation) ===
    if (s.phase === "BOWLING") {
      s.t += delta * (s.speed / 10);
      const t = s.t;

      // Check if ball passed the wicket (Missed)
      if (t > 2.2) {
        s.phase = "IDLE";
        ball.visible = false;
        setLastShot({ text: "MISSED!", color: "white" });
        return;
      }

      // Bezier Logic
      if (t < 1) {
        const mid1 = s.start.clone().lerp(s.bounce, 0.5);
        mid1.y += s.h1;
        qBezier(s.start, mid1, s.bounce, t, tmp);
      } else {
        const t2 = t - 1;
        const mid2 = s.bounce.clone().lerp(s.end, 0.5);
        mid2.y += s.h2;
        qBezier(s.bounce, mid2, s.end, t2, tmp);
      }
      
      // Update Position
      ball.position.copy(tmp);
      ball.rotation.x += delta * 15;
    }

    // === PHASE B: HIT (Physics) ===
    if (s.phase === "HIT") {
      // 1. Apply Gravity
      s.velocity.y -= GRAVITY * delta;
      
      // 2. Apply Drag (Air resistance)
      s.velocity.multiplyScalar(DRAG);

      // 3. Move Ball
      const moveStep = s.velocity.clone().multiplyScalar(delta);
      ball.position.add(moveStep);
      
      // 4. Rotation for visual effect
      ball.rotation.x -= delta * 10; 

      // 5. Floor Bounce Logic
      if (ball.position.y <= ballRadius) {
        ball.position.y = ballRadius;
        s.velocity.y *= -BOUNCE_DAMPING; // Reverse Y and dampen
        s.velocity.x *= 0.8; // Floor friction
        s.velocity.z *= 0.8;
        
        // Stop if too slow
        if (s.velocity.length() < 0.5) {
            s.phase = "IDLE";
        }
      }
    }
  });

  // Interval Throwing
  useEffect(() => {
    const id = setInterval(() => {
      if (state.current.phase === "IDLE") startThrow();
    }, intervalMs);
    return () => clearInterval(id);
  }, [points, intervalMs]);

  const visible = !!(points?.bowler && points?.wicket && points?.batsman);

  return (
    <>
      <group>
        {/* Actual Ball */}
        <mesh 
            ref={ballRef} 
            visible={visible} 
            castShadow 
            // Add click handler here
            onClick={handleHit} 
        >
          <sphereGeometry args={[ballRadius, 24, 24]} />
          <meshStandardMaterial color="#b10f1a" roughness={0.4} metalness={0.1} />
        </mesh>

        {/* INVISIBLE HITBOX (Makes hitting easier) */}
        {ballRef.current && (
            <mesh 
                position={ballRef.current.position} 
                onClick={handleHit}
                visible={false} // Invisible but clickable
            >
                <sphereGeometry args={[0.4, 8, 8]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>
        )}
      </group>

      {/* UI Feedback Overlay */}
      {lastShot && (
        <Html position={[0, 1.5, 0]} center>
          <div style={{
             color: lastShot.color, 
             fontWeight: 'bold', 
             fontSize: '24px',
             textShadow: '0px 2px 4px rgba(0,0,0,0.8)',
             fontFamily: 'sans-serif'
          }}>
            {lastShot.text}
          </div>
        </Html>
      )}
    </>
  );
}

/* ---------- Main Page ---------- */
export default function FullScreenModel3DPage() {
  const MODEL_URL = "/models/cricket.glb";
  const DRACO_PATH = "/draco/";
  const FORCE_DECODER = "js";

  const HDR_URL = "/hdr/alps.hdr";

  const CAMERA_POS = [0, 1.2, 4.5];
  const CAMERA_FOV = 45;

  const MODEL_POS = [0, 0, 0];
  const MODEL_ROT = [0, 0, 0];
  const MODEL_SCALE = 1;

  const [points, setPoints] = useState(null);

  const handleSceneReady = (scene) => {
    const bowler = scene.getObjectByName("BowlerPoint");
    const batsman = scene.getObjectByName("BatsmanPoint");
    const wicket = scene.getObjectByName("WicketTarget");

    setPoints({ bowler, batsman, wicket });

    if (!bowler || !batsman || !wicket) {
      console.warn("Missing points:", {
        BowlerPoint: !!bowler,
        BatsmanPoint: !!batsman,
        WicketTarget: !!wicket,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black"
      onWheelCapture={(e) => e.preventDefault()}
      onTouchMoveCapture={(e) => e.preventDefault()}
      style={{ touchAction: "none" }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: CAMERA_POS, fov: CAMERA_FOV, near: 0.1, far: 5000 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#000000"), 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight
          castShadow
          position={[6, 10, 6]}
          intensity={1.2}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        <Suspense fallback={<Loader />}>
          <Environment files={HDR_URL} background blur={false} />

          <FixedPovCamera points={points} defaultFov={52} backOffset={0.1} upOffset={0.2} />

          {/* ✅ Variable speed + variable bounce */}
          <BowlingSystem
            points={points}
            intervalMs={1800}
            speedMin={22}
            speedMax={48}
            bounceHeightMin={0.08}
            bounceHeightMax={0.45}
            bounceTMin={0.48}
            bounceTMax={0.74}
            randomLine={0.45}
            randomLength={0.45}
            ballRadius={0.01}
          />

          <group>
            <DracoGLBModel
              url={MODEL_URL}
              dracoPath={DRACO_PATH}
              forceDecoder={FORCE_DECODER}
              position={MODEL_POS}
              rotation={MODEL_ROT}
              scale={MODEL_SCALE}
              onSceneReady={handleSceneReady}
            />
          </group>

          <ContactShadows position={[0, -0.02, 0]} opacity={0.45} scale={12} blur={2.4} far={12} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-xl">
        <div className="text-sm font-semibold tracking-wide">POV Viewer + Bowling</div>
        <div className="mt-1 text-xs text-white/70">
          HDR: <span className="text-white/90">{HDR_URL}</span>
        </div>
        <div className="mt-1 text-xs text-white/70">
          Camera: <span className="text-white/90">WicketTarget → BowlerPoint</span>
        </div>
        <div className="mt-1 text-xs text-white/70">
          Bowling: <span className="text-white/90">Speed & bounce vary per ball</span>
        </div>
        <div className="mt-2 text-[11px] text-white/60 leading-relaxed">
          Fixed camera • No rotate • No zoom • No pan
        </div>
      </div>
    </div>
  );
}






































