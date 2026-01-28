

// // // FullScreenModel3DPage.jsx
// // import React, { Suspense, useMemo, useEffect, useState, useRef } from "react";
// // import * as THREE from "three";
// // import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
// // import { Environment, ContactShadows, Html, useProgress } from "@react-three/drei";
// // import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// // import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

// // /* ---------- Loader ---------- */
// // function Loader() {
// //   const { progress } = useProgress();
// //   return (
// //     <Html center>
// //       <div
// //         style={{
// //           padding: "10px 14px",
// //           borderRadius: 14,
// //           background: "rgba(0,0,0,0.6)",
// //           color: "#fff",
// //           fontSize: 12,
// //           letterSpacing: 0.5,
// //           backdropFilter: "blur(8px)",
// //           border: "1px solid rgba(255,255,255,0.15)",
// //         }}
// //       >
// //         Loading… {Math.round(progress)}%
// //       </div>
// //     </Html>
// //   );
// // }

// // /* ---------- Draco GLB Loader ---------- */
// // function DracoGLBModel({
// //   url,
// //   dracoPath = "/draco/",
// //   forceDecoder = "auto",
// //   position = [0, 0, 0],
// //   rotation = [0, 0, 0],
// //   scale = 1,
// //   onSceneReady,
// // }) {
// //   const gltf = useLoader(GLTFLoader, url, (loader) => {
// //     const draco = new DRACOLoader();
// //     draco.setDecoderPath(dracoPath);

// //     if (forceDecoder === "js") draco.setDecoderConfig({ type: "js" });
// //     if (forceDecoder === "wasm") draco.setDecoderConfig({ type: "wasm" });

// //     loader.setDRACOLoader(draco);
// //   });

// //   const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

// //   // ✅ keep latest callback without re-triggering effect every render
// //   const onReadyRef = useRef(onSceneReady);
// //   useEffect(() => {
// //     onReadyRef.current = onSceneReady;
// //   }, [onSceneReady]);

// //   // ✅ defer callback to next frame (avoids setState-in-render warnings)
// //   useEffect(() => {
// //     if (!cloned) return;
// //     const id = requestAnimationFrame(() => onReadyRef.current?.(cloned));
// //     return () => cancelAnimationFrame(id);
// //   }, [cloned]);

// //   return (
// //     <primitive
// //       object={cloned}
// //       position={position}
// //       rotation={rotation}
// //       scale={scale}
// //       dispose={null}
// //     />
// //   );
// // }

// // /* ---------- Fixed POV Camera (wicket -> bowler) ---------- */
// // function FixedPovCamera({
// //   points,
// //   defaultFov = 52,
// //   backOffset = 0.1,
// //   upOffset = 0.2,
// //   debug = false,
// // }) {
// //   const { camera } = useThree();

// //   useEffect(() => {
// //     if (!points?.wicket || !points?.bowler) return;

// //     const wicket = points.wicket;
// //     const bowler = points.bowler;

// //     wicket.updateWorldMatrix(true, false);
// //     bowler.updateWorldMatrix(true, false);

// //     const wicketPos = new THREE.Vector3();
// //     const bowlerPos = new THREE.Vector3();

// //     wicket.getWorldPosition(wicketPos);
// //     bowler.getWorldPosition(bowlerPos);

// //     const dir = bowlerPos.clone().sub(wicketPos).normalize();
// //     const camPos = wicketPos.clone().add(dir.clone().multiplyScalar(-backOffset));
// //     camPos.y += upOffset;

// //     camera.position.copy(camPos);
// //     camera.fov = defaultFov;
// //     camera.up.set(0, 1, 0);
// //     camera.lookAt(bowlerPos);
// //     camera.updateProjectionMatrix();
// //     camera.updateMatrixWorld(true);

// //     if (debug) {
// //       console.log("WicketPos:", wicketPos.toArray());
// //       console.log("CameraPos:", camPos.toArray());
// //       console.log("BowlerPos:", bowlerPos.toArray());
// //     }
// //   }, [points, camera, defaultFov, backOffset, upOffset, debug]);

// //   return null;
// // }

// // /* ---------- Bowling Ball Logic (NOW: variable speed + variable bounce) ---------- */
// // /* ---------- Bowling System with Batting Logic ---------- */
// // function BowlingSystem({
// //   points,
// //   intervalMs = 2500, // Slowed slightly to make it playable
// //   speedMin = 26,
// //   speedMax = 44,
// //   bounceHeightMin = 0.1,
// //   bounceHeightMax = 0.42,
// //   bounceTMin = 0.5,
// //   bounceTMax = 0.72,
// //   randomLine = 0.45,
// //   randomLength = 0.45,
// //   ballRadius = 0.04, // Visually slightly larger for visibility
// // }) {
// //   const ballRef = useRef(null);
// //   const [lastShot, setLastShot] = useState(null); // To show UI feedback

// //   // Physics constants
// //   const GRAVITY = 9.8;
// //   const DRAG = 0.98; // Air resistance
// //   const BOUNCE_DAMPING = 0.6; // Energy lost on bounce

// //   const state = useRef({
// //     phase: "IDLE", // IDLE | BOWLING | HIT
// //     t: 0,
    
// //     // Bezier Paths (Bowling)
// //     start: new THREE.Vector3(),
// //     bounce: new THREE.Vector3(),
// //     end: new THREE.Vector3(),
// //     speed: 35,
// //     h1: 0.25,
// //     h2: 0.18,

// //     // Physics Vectors (Batting)
// //     velocity: new THREE.Vector3(),
// //   });

// //   const tmp = useMemo(() => new THREE.Vector3(), []);
// //   const tmp2 = useMemo(() => new THREE.Vector3(), []);
// //   const r = (a, b) => a + Math.random() * (b - a);

// //   // Bezier curve helper
// //   const qBezier = (p0, p1, p2, t, out) => {
// //     const it = 1 - t;
// //     out.set(0, 0, 0)
// //        .addScaledVector(p0, it * it)
// //        .addScaledVector(p1, 2 * it * t)
// //        .addScaledVector(p2, t * t);
// //     return out;
// //   };

// //   // --- 1. START THE THROW ---
// //   const startThrow = () => {
// //     if (!points?.bowler || !points?.wicket || !points?.batsman) return;
    
// //     // Reset state
// //     setLastShot(null); 
// //     const s = state.current;
    
// //     // Get world positions
// //     const start = new THREE.Vector3();
// //     const wicketPos = new THREE.Vector3();
// //     const batsPos = new THREE.Vector3();
    
// //     points.bowler.getWorldPosition(start);
// //     points.wicket.getWorldPosition(wicketPos);
// //     points.batsman.getWorldPosition(batsPos);

// //     // Calculate trajectory
// //     const mix = r(0.25, 0.85);
// //     const end = wicketPos.clone().lerp(batsPos, mix);
// //     end.x += r(-randomLine, randomLine);
// //     end.z += r(-randomLength, randomLength);

// //     const bt = THREE.MathUtils.clamp(r(bounceTMin, bounceTMax), 0.35, 0.85);
// //     const bounce = start.clone().lerp(end, bt);
// //     bounce.y = Math.min(bounce.y, wicketPos.y + 0.02);

// //     // Set State
// //     s.phase = "BOWLING";
// //     s.t = 0;
// //     s.start.copy(start);
// //     s.bounce.copy(bounce);
// //     s.end.copy(end);
// //     s.speed = r(speedMin, speedMax);
    
// //     // Arc heights
// //     const h = r(bounceHeightMin, bounceHeightMax);
// //     s.h1 = Math.max(0.06, h);
// //     s.h2 = Math.max(0.04, h * 0.65);

// //     if (ballRef.current) {
// //       ballRef.current.position.copy(start);
// //       ballRef.current.visible = true;
// //     }
// //   };

// //   // --- 2. HANDLE THE HIT (CLICK) ---
// //   const handleHit = (e) => {
// //     e.stopPropagation(); // Prevent clicking through to other stuff
    
// //     const s = state.current;
// //     if (s.phase !== "BOWLING") return; // Can only hit while ball is being bowled

// //     // A. CALCULATE TIMING
// //     const ballPos = ballRef.current.position;
// //     const wicketPos = new THREE.Vector3();
// //     points.wicket.getWorldPosition(wicketPos);

// //     // Distance to stumps determines timing
// //     const dist = ballPos.distanceTo(wicketPos);
    
// //     let timingQuality = "";
// //     let color = "";
// //     let power = 0;
// //     let elevation = 0;
// //     let sideAngle = 0;

// //     // Logic: 
// //     // < 1.0m = Perfect (Straight Drive)
// //     // 1.0m - 3.0m = Good (Off Drive / Pull)
// //     // > 3.0m = Too Early/Late (Edge or Miss)
    
// //     if (dist < 1.5) {
// //       timingQuality = "PERFECT TIMING!";
// //       color = "#4ade80"; // Green
// //       power = 25; 
// //       elevation = 0.4; // Lofted
// //       sideAngle = r(-0.1, 0.1); // Straight
// //     } else if (dist < 3.5) {
// //       timingQuality = "GOOD CONTACT";
// //       color = "#facc15"; // Yellow
// //       power = 18;
// //       elevation = 0.1; // Grounded
// //       // If clicked early (ball far away), hit to leg side
// //       sideAngle = 0.5; 
// //     } else {
// //       timingQuality = "MISTIMED...";
// //       color = "#f87171"; // Red
// //       power = 5; // Weak hit
// //       elevation = 0.8; // Pop up
// //       sideAngle = r(-1, 1); // Random edge
// //     }

// //     setLastShot({ text: timingQuality, color });

// //     // B. CALCULATE HIT VECTOR (PHYSICS START)
// //     s.phase = "HIT";
    
// //     // Base direction: Bowler to Wicket (inverted) -> Wicket to Bowler
// //     const dir = new THREE.Vector3().subVectors(s.start, s.end).normalize();
    
// //     // Apply timing angles
// //     dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), sideAngle); // Side to side
// //     dir.y += elevation; // Loft
// //     dir.normalize();

// //     // Set initial velocity
// //     s.velocity.copy(dir.multiplyScalar(power));
// //   };

// //   // --- 3. GAME LOOP ---
// //   useFrame((_, delta) => {
// //     const ball = ballRef.current;
// //     const s = state.current;
// //     if (!ball || s.phase === "IDLE") return;

// //     // === PHASE A: BOWLING (Animation) ===
// //     if (s.phase === "BOWLING") {
// //       s.t += delta * (s.speed / 10);
// //       const t = s.t;

// //       // Check if ball passed the wicket (Missed)
// //       if (t > 2.2) {
// //         s.phase = "IDLE";
// //         ball.visible = false;
// //         setLastShot({ text: "MISSED!", color: "white" });
// //         return;
// //       }

// //       // Bezier Logic
// //       if (t < 1) {
// //         const mid1 = s.start.clone().lerp(s.bounce, 0.5);
// //         mid1.y += s.h1;
// //         qBezier(s.start, mid1, s.bounce, t, tmp);
// //       } else {
// //         const t2 = t - 1;
// //         const mid2 = s.bounce.clone().lerp(s.end, 0.5);
// //         mid2.y += s.h2;
// //         qBezier(s.bounce, mid2, s.end, t2, tmp);
// //       }
      
// //       // Update Position
// //       ball.position.copy(tmp);
// //       ball.rotation.x += delta * 15;
// //     }

// //     // === PHASE B: HIT (Physics) ===
// //     if (s.phase === "HIT") {
// //       // 1. Apply Gravity
// //       s.velocity.y -= GRAVITY * delta;
      
// //       // 2. Apply Drag (Air resistance)
// //       s.velocity.multiplyScalar(DRAG);

// //       // 3. Move Ball
// //       const moveStep = s.velocity.clone().multiplyScalar(delta);
// //       ball.position.add(moveStep);
      
// //       // 4. Rotation for visual effect
// //       ball.rotation.x -= delta * 10; 

// //       // 5. Floor Bounce Logic
// //       if (ball.position.y <= ballRadius) {
// //         ball.position.y = ballRadius;
// //         s.velocity.y *= -BOUNCE_DAMPING; // Reverse Y and dampen
// //         s.velocity.x *= 0.8; // Floor friction
// //         s.velocity.z *= 0.8;
        
// //         // Stop if too slow
// //         if (s.velocity.length() < 0.5) {
// //             s.phase = "IDLE";
// //         }
// //       }
// //     }
// //   });

// //   // Interval Throwing
// //   useEffect(() => {
// //     const id = setInterval(() => {
// //       if (state.current.phase === "IDLE") startThrow();
// //     }, intervalMs);
// //     return () => clearInterval(id);
// //   }, [points, intervalMs]);

// //   const visible = !!(points?.bowler && points?.wicket && points?.batsman);

// //   return (
// //     <>
// //       <group>
// //         {/* Actual Ball */}
// //         <mesh 
// //             ref={ballRef} 
// //             visible={visible} 
// //             castShadow 
// //             // Add click handler here
// //             onClick={handleHit} 
// //         >
// //           <sphereGeometry args={[ballRadius, 24, 24]} />
// //           <meshStandardMaterial color="#b10f1a" roughness={0.4} metalness={0.1} />
// //         </mesh>

// //         {/* INVISIBLE HITBOX (Makes hitting easier) */}
// //         {ballRef.current && (
// //             <mesh 
// //                 position={ballRef.current.position} 
// //                 onClick={handleHit}
// //                 visible={false} // Invisible but clickable
// //             >
// //                 <sphereGeometry args={[0.4, 8, 8]} />
// //                 <meshBasicMaterial transparent opacity={0} />
// //             </mesh>
// //         )}
// //       </group>

// //       {/* UI Feedback Overlay */}
// //       {lastShot && (
// //         <Html position={[0, 1.5, 0]} center>
// //           <div style={{
// //              color: lastShot.color, 
// //              fontWeight: 'bold', 
// //              fontSize: '24px',
// //              textShadow: '0px 2px 4px rgba(0,0,0,0.8)',
// //              fontFamily: 'sans-serif'
// //           }}>
// //             {lastShot.text}
// //           </div>
// //         </Html>
// //       )}
// //     </>
// //   );
// // }

// // /* ---------- Main Page ---------- */
// // export default function FullScreenModel3DPage() {
// //   const MODEL_URL = "/models/cricket.glb";
// //   const DRACO_PATH = "/draco/";
// //   const FORCE_DECODER = "js";

// //   const HDR_URL = "/hdr/alps.hdr";

// //   const CAMERA_POS = [0, 1.2, 4.5];
// //   const CAMERA_FOV = 45;

// //   const MODEL_POS = [0, 0, 0];
// //   const MODEL_ROT = [0, 0, 0];
// //   const MODEL_SCALE = 1;

// //   const [points, setPoints] = useState(null);

// //   const handleSceneReady = (scene) => {
// //     const bowler = scene.getObjectByName("BowlerPoint");
// //     const batsman = scene.getObjectByName("BatsmanPoint");
// //     const wicket = scene.getObjectByName("WicketTarget");

// //     setPoints({ bowler, batsman, wicket });

// //     if (!bowler || !batsman || !wicket) {
// //       console.warn("Missing points:", {
// //         BowlerPoint: !!bowler,
// //         BatsmanPoint: !!batsman,
// //         WicketTarget: !!wicket,
// //       });
// //     }
// //   };

// //   return (
// //     <div
// //       className="fixed inset-0 bg-black"
// //       onWheelCapture={(e) => e.preventDefault()}
// //       onTouchMoveCapture={(e) => e.preventDefault()}
// //       style={{ touchAction: "none" }}
// //     >
// //       <Canvas
// //         shadows
// //         dpr={[1, 2]}
// //         camera={{ position: CAMERA_POS, fov: CAMERA_FOV, near: 0.1, far: 5000 }}
// //         gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
// //         onCreated={({ gl }) => {
// //           gl.setClearColor(new THREE.Color("#000000"), 1);
// //           gl.toneMapping = THREE.ACESFilmicToneMapping;
// //           gl.toneMappingExposure = 1.0;
// //           gl.outputColorSpace = THREE.SRGBColorSpace;
// //         }}
// //       >
// //         <ambientLight intensity={0.25} />
// //         <directionalLight
// //           castShadow
// //           position={[6, 10, 6]}
// //           intensity={1.2}
// //           shadow-mapSize-width={2048}
// //           shadow-mapSize-height={2048}
// //         />

// //         <Suspense fallback={<Loader />}>
// //           <Environment files={HDR_URL} background blur={false} />

// //           <FixedPovCamera points={points} defaultFov={52} backOffset={0.1} upOffset={0.2} />

// //           {/* ✅ Variable speed + variable bounce */}
// //           <BowlingSystem
// //             points={points}
// //             intervalMs={1800}
// //             speedMin={22}
// //             speedMax={48}
// //             bounceHeightMin={0.08}
// //             bounceHeightMax={0.45}
// //             bounceTMin={0.48}
// //             bounceTMax={0.74}
// //             randomLine={0.45}
// //             randomLength={0.45}
// //             ballRadius={0.01}
// //           />

// //           <group>
// //             <DracoGLBModel
// //               url={MODEL_URL}
// //               dracoPath={DRACO_PATH}
// //               forceDecoder={FORCE_DECODER}
// //               position={MODEL_POS}
// //               rotation={MODEL_ROT}
// //               scale={MODEL_SCALE}
// //               onSceneReady={handleSceneReady}
// //             />
// //           </group>

// //           <ContactShadows position={[0, -0.02, 0]} opacity={0.45} scale={12} blur={2.4} far={12} />
// //         </Suspense>
// //       </Canvas>

// //       <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-xl">
// //         <div className="text-sm font-semibold tracking-wide">POV Viewer + Bowling</div>
// //         <div className="mt-1 text-xs text-white/70">
// //           HDR: <span className="text-white/90">{HDR_URL}</span>
// //         </div>
// //         <div className="mt-1 text-xs text-white/70">
// //           Camera: <span className="text-white/90">WicketTarget → BowlerPoint</span>
// //         </div>
// //         <div className="mt-1 text-xs text-white/70">
// //           Bowling: <span className="text-white/90">Speed & bounce vary per ball</span>
// //         </div>
// //         <div className="mt-2 text-[11px] text-white/60 leading-relaxed">
// //           Fixed camera • No rotate • No zoom • No pan
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }






































// // FullScreenModel3DPage.jsx
// import React, { Suspense, useMemo, useEffect, useState, useRef } from "react";
// import * as THREE from "three";
// import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
// import { Environment, ContactShadows, Html, useProgress } from "@react-three/drei";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

// /* ---------- Loader ---------- */
// function Loader() {
//   const { progress } = useProgress();
//   return (
//     <Html center>
//       <div
//         style={{
//           padding: "10px 14px",
//           borderRadius: 14,
//           background: "rgba(0,0,0,0.6)",
//           color: "#fff",
//           fontSize: 12,
//           letterSpacing: 0.5,
//           backdropFilter: "blur(8px)",
//           border: "1px solid rgba(255,255,255,0.15)",
//         }}
//       >
//         Loading… {Math.round(progress)}%
//       </div>
//     </Html>
//   );
// }

// /* ---------- Draco GLB Loader ---------- */
// function DracoGLBModel({
//   url,
//   dracoPath = "/draco/",
//   forceDecoder = "auto",
//   position = [0, 0, 0],
//   rotation = [0, 0, 0],
//   scale = 1,
//   onSceneReady,
// }) {
//   const gltf = useLoader(GLTFLoader, url, (loader) => {
//     const draco = new DRACOLoader();
//     draco.setDecoderPath(dracoPath);

//     if (forceDecoder === "js") draco.setDecoderConfig({ type: "js" });
//     if (forceDecoder === "wasm") draco.setDecoderConfig({ type: "wasm" });

//     loader.setDRACOLoader(draco);
//   });

//   const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

//   // ✅ keep latest callback without re-triggering effect every render
//   const onReadyRef = useRef(onSceneReady);
//   useEffect(() => {
//     onReadyRef.current = onSceneReady;
//   }, [onSceneReady]);

//   // ✅ defer callback to next frame (avoids setState-in-render warnings)
//   useEffect(() => {
//     if (!cloned) return;
//     const id = requestAnimationFrame(() => onReadyRef.current?.(cloned));
//     return () => cancelAnimationFrame(id);
//   }, [cloned]);

//   return (
//     <primitive
//       object={cloned}
//       position={position}
//       rotation={rotation}
//       scale={scale}
//       dispose={null}
//     />
//   );
// }

// /* ---------- Fixed POV Camera (wicket -> bowler) ---------- */
// function FixedPovCamera({
//   points,
//   defaultFov = 52,
//   backOffset = 0.1,
//   upOffset = 0.2,
//   debug = false,
// }) {
//   const { camera } = useThree();

//   useEffect(() => {
//     if (!points?.wicket || !points?.bowler) return;

//     const wicket = points.wicket;
//     const bowler = points.bowler;

//     wicket.updateWorldMatrix(true, false);
//     bowler.updateWorldMatrix(true, false);

//     const wicketPos = new THREE.Vector3();
//     const bowlerPos = new THREE.Vector3();

//     wicket.getWorldPosition(wicketPos);
//     bowler.getWorldPosition(bowlerPos);

//     const dir = bowlerPos.clone().sub(wicketPos).normalize();
//     const camPos = wicketPos.clone().add(dir.clone().multiplyScalar(-backOffset));
//     camPos.y += upOffset;

//     camera.position.copy(camPos);
//     camera.fov = defaultFov;
//     camera.up.set(0, 1, 0);
//     camera.lookAt(bowlerPos);
//     camera.updateProjectionMatrix();
//     camera.updateMatrixWorld(true);

//     if (debug) {
//       console.log("WicketPos:", wicketPos.toArray());
//       console.log("CameraPos:", camPos.toArray());
//       console.log("BowlerPos:", bowlerPos.toArray());
//     }
//   }, [points, camera, defaultFov, backOffset, upOffset, debug]);

//   return null;
// }




// /* ---------- Bowling System with Batting Logic ---------- */
// /* ---------- Bowling System with 360 Degree Batting Logic ---------- */
// function BowlingSystem({
//   points,
//   intervalMs = 2500,
//   speedMin = 26,
//   speedMax = 44,
//   bounceHeightMin = 0.1,
//   bounceHeightMax = 0.42,
//   bounceTMin = 0.5,
//   bounceTMax = 0.72,
//   randomLine = 0.45,
//   randomLength = 0.45,
//   ballRadius = 0.04,
// }) {
//   const ballRef = useRef(null);
//   const [lastShot, setLastShot] = useState(null);

//   // Physics constants
//   const GRAVITY = 9.8;
//   const DRAG = 0.97; // Air resistance (slightly less to allow boundaries)
//   const BOUNCE_DAMPING = 0.5;

//   const state = useRef({
//     phase: "IDLE",
//     t: 0,
//     start: new THREE.Vector3(),
//     bounce: new THREE.Vector3(),
//     end: new THREE.Vector3(),
//     speed: 35,
//     h1: 0.25,
//     h2: 0.18,
//     velocity: new THREE.Vector3(), // The movement vector
//   });

//   const tmp = useMemo(() => new THREE.Vector3(), []);
//   const r = (a, b) => a + Math.random() * (b - a);

//   // Quadratic Bezier for bowling arc
//   const qBezier = (p0, p1, p2, t, out) => {
//     const it = 1 - t;
//     out.set(0, 0, 0)
//        .addScaledVector(p0, it * it)
//        .addScaledVector(p1, 2 * it * t)
//        .addScaledVector(p2, t * t);
//     return out;
//   };

//   // --- 1. START THROW ---
//   const startThrow = () => {
//     if (!points?.bowler || !points?.wicket || !points?.batsman) return;
//     setLastShot(null);
//     const s = state.current;

//     // Get Positions
//     const start = new THREE.Vector3();
//     const wicketPos = new THREE.Vector3();
//     const batsPos = new THREE.Vector3();
//     points.bowler.getWorldPosition(start);
//     points.wicket.getWorldPosition(wicketPos);
//     points.batsman.getWorldPosition(batsPos);

//     // Random Line/Length
//     const mix = r(0.25, 0.85);
//     const end = wicketPos.clone().lerp(batsPos, mix);
//     end.x += r(-randomLine, randomLine);
//     end.z += r(-randomLength, randomLength);

//     const bt = THREE.MathUtils.clamp(r(bounceTMin, bounceTMax), 0.35, 0.85);
//     const bounce = start.clone().lerp(end, bt);
//     bounce.y = Math.min(bounce.y, wicketPos.y + 0.02);

//     // Init State
//     s.phase = "BOWLING";
//     s.t = 0;
//     s.start.copy(start);
//     s.bounce.copy(bounce);
//     s.end.copy(end);
//     s.speed = r(speedMin, speedMax);

//     const h = r(bounceHeightMin, bounceHeightMax);
//     s.h1 = Math.max(0.06, h);
//     s.h2 = Math.max(0.04, h * 0.65);

//     if (ballRef.current) {
//       ballRef.current.position.copy(start);
//       ballRef.current.visible = true;
//     }
//   };

//   // --- 2. 360 DEGREE BATTING LOGIC ---
//   const handleHit = (e) => {
//     e.stopPropagation();
//     const s = state.current;
//     if (s.phase !== "BOWLING") return;

//     // A. GAME STATE CALCS
//     const ballPos = ballRef.current.position.clone();
//     const wicketPos = new THREE.Vector3();
//     points.wicket.getWorldPosition(wicketPos);
//     const distToWicket = ballPos.distanceTo(wicketPos);

//     // B. MOUSE IMPACT CALCULATION (Where did you click on the ball?)
//     // e.point is the exact 3D coordinate of the click
//     const hitPoint = e.point.clone();
    
//     // Calculate vector from Ball Center to Hit Point
//     // Ex: If you click the TOP, this vector points UP.
//     const impactVector = new THREE.Vector3().subVectors(hitPoint, ballPos);
    
//     // NORMALIZE IMPACT: Invert it!
//     // If you click RIGHT side, ball goes LEFT.
//     // If you click TOP, ball goes DOWN (Ground shot).
//     // If you click BOTTOM, ball goes UP (Loft).
//     const shotDirection = impactVector.clone().negate().normalize();

//     // C. TIMING LOGIC (Adds bias to direction)
//     let timingNote = "";
//     let timingColor = "";
//     let power = 0;
    
//     // Timing Bias (Pulling vs Driving vs Cutting)
//     // 0 = Neutral, negative = Left(Leg), positive = Right(Off)
//     let timingBiasX = 0; 

//     if (distToWicket < 1.0) {
//       // LATE: Ball is past stumps or very close
//       timingNote = "LATE CUT / GLANCE";
//       timingColor = "#fbbf24"; // Amber
//       power = 15;
//       timingBiasX = -0.5; // Glancing off to third man
//     } 
//     else if (distToWicket < 2.5) {
//       // PERFECT: In the slot
//       timingNote = "PERFECT TIMING";
//       timingColor = "#4ade80"; // Green
//       power = 28; // Max Power
//       // Direction is purely controlled by mouse in this zone
//     } 
//     else if (distToWicket < 4.0) {
//       // EARLY: Ball is far away
//       timingNote = "EARLY (PULL/HOOK)";
//       timingColor = "#f87171"; // Red
//       power = 22;
//       timingBiasX = 0.8; // Pulled to leg side heavily
//     } else {
//       timingNote = "TOO EARLY!";
//       timingColor = "gray";
//       power = 5;
//     }

//     // D. COMBINE VECTORS
//     // Start with the direction strictly based on where you clicked
//     const finalDir = shotDirection.clone();

//     // Add Main Forward Force (Bowler to Batsman direction inverted)
//     const pitchDir = new THREE.Vector3().subVectors(s.start, s.end).normalize();
    
//     // Blend: 40% Pitch Direction, 60% Mouse Direction
//     finalDir.lerp(pitchDir, 0.4);

//     // Apply Timing Bias (Dragging the ball left or right based on timing)
//     finalDir.x += timingBiasX;

//     // Amplify Verticality (Mouse click vertical offset matters more)
//     // If impactVector.y was negative (clicked bottom), we want high loft
//     finalDir.y += (impactVector.y < 0 ? 0.5 : -0.2); 

//     finalDir.normalize();

//     // E. APPLY PHYSICS
//     s.phase = "HIT";
//     s.velocity.copy(finalDir.multiplyScalar(power));

//     // Determine shot name based on direction
//     let shotName = timingNote;
//     if (finalDir.y > 0.3) shotName += " (LOFTED)";
//     else shotName += " (GROUNDED)";

//     setLastShot({ text: shotName, color: timingColor });
//   };

//   // --- 3. PHYSICS LOOP ---
//   useFrame((_, delta) => {
//     const ball = ballRef.current;
//     const s = state.current;

//     if (!ball || s.phase === "IDLE") return;

//     // BOWLING PHASE
//     if (s.phase === "BOWLING") {
//       s.t += delta * (s.speed / 10);
//       const t = s.t;

//       if (t > 2.5) {
//         s.phase = "IDLE";
//         ball.visible = false;
//         setLastShot({ text: "MISSED", color: "white" });
//         return;
//       }

//       if (t < 1) {
//         const mid1 = s.start.clone().lerp(s.bounce, 0.5);
//         mid1.y += s.h1;
//         qBezier(s.start, mid1, s.bounce, t, tmp);
//       } else {
//         const t2 = t - 1;
//         const mid2 = s.bounce.clone().lerp(s.end, 0.5);
//         mid2.y += s.h2;
//         qBezier(s.bounce, mid2, s.end, t2, tmp);
//       }
//       ball.position.copy(tmp);
//       ball.rotation.x += delta * 15;
//     }

//     // BATTING PHASE (Newtonian)
//     if (s.phase === "HIT") {
//       // Gravity
//       s.velocity.y -= GRAVITY * delta;
      
//       // Drag
//       s.velocity.multiplyScalar(DRAG);

//       // Move
//       ball.position.addScaledVector(s.velocity, delta);
      
//       // Rotate based on velocity
//       ball.rotation.x -= s.velocity.z * delta;
//       ball.rotation.z += s.velocity.x * delta;

//       // Floor Bounce
//       if (ball.position.y <= ballRadius) {
//         ball.position.y = ballRadius;
//         s.velocity.y *= -BOUNCE_DAMPING;
//         s.velocity.x *= 0.8; 
//         s.velocity.z *= 0.8;
        
//         if (s.velocity.length() < 0.2) s.phase = "IDLE";
//       }
//     }
//   });

//   useEffect(() => {
//     const id = setInterval(() => {
//       if (state.current.phase === "IDLE") startThrow();
//     }, intervalMs);
//     return () => clearInterval(id);
//   }, [points, intervalMs]);

//   const visible = !!(points?.bowler && points?.wicket && points?.batsman);

//   return (
//     <>
//       <group>
//         {/* Visual Ball */}
//         <mesh ref={ballRef} visible={visible} castShadow onClick={handleHit}>
//           <sphereGeometry args={[ballRadius, 24, 24]} />
//           <meshStandardMaterial color="#b10f1a" roughness={0.4} metalness={0.1} />
//         </mesh>

//         {/* HITBOX: Slightly larger than ball for better usability, triggers exact same logic */}
//         {ballRef.current && (
//             <mesh position={ballRef.current.position} onClick={handleHit} visible={false}>
//                 <sphereGeometry args={[ballRadius * 4, 12, 12]} />
//                 <meshBasicMaterial transparent opacity={0} />
//             </mesh>
//         )}
//       </group>

//       {/* HUD */}
//       {lastShot && (
//         <Html position={[0, 2, -2]} center>
//            <div className="flex flex-col items-center gap-1">
//               <div style={{
//                   color: lastShot.color, 
//                   fontWeight: '900', 
//                   fontSize: '32px',
//                   textTransform: 'uppercase',
//                   textShadow: '0 2px 10px rgba(0,0,0,0.5)',
//                   fontFamily: 'sans-serif'
//               }}>
//                 {lastShot.text}
//               </div>
//            </div>
//         </Html>
//       )}
//     </>
//   );
// }






// /* ---------- Main Page ---------- */
// export default function FullScreenModel3DPage() {
//   const MODEL_URL = "/models/cricket.glb";
//   const DRACO_PATH = "/draco/";
//   const FORCE_DECODER = "js";

//   const HDR_URL = "/hdr/alps.hdr";

//   const CAMERA_POS = [0, 1.2, 4.5];
//   const CAMERA_FOV = 45;

//   const MODEL_POS = [0, 0, 0];
//   const MODEL_ROT = [0, 0, 0];
//   const MODEL_SCALE = 1;

//   const [points, setPoints] = useState(null);

//   const handleSceneReady = (scene) => {
//     const bowler = scene.getObjectByName("BowlerPoint");
//     const batsman = scene.getObjectByName("BatsmanPoint");
//     const wicket = scene.getObjectByName("WicketTarget");

//     setPoints({ bowler, batsman, wicket });

//     if (!bowler || !batsman || !wicket) {
//       console.warn("Missing points:", {
//         BowlerPoint: !!bowler,
//         BatsmanPoint: !!batsman,
//         WicketTarget: !!wicket,
//       });
//     }
//   };

//   return (
//     <div
//       className="fixed inset-0 bg-black"
//       onWheelCapture={(e) => e.preventDefault()}
//       onTouchMoveCapture={(e) => e.preventDefault()}
//       style={{ touchAction: "none" }}
//     >
//       <Canvas
//         shadows
//         dpr={[1, 2]}
//         camera={{ position: CAMERA_POS, fov: CAMERA_FOV, near: 0.1, far: 5000 }}
//         gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
//         onCreated={({ gl }) => {
//           gl.setClearColor(new THREE.Color("#000000"), 1);
//           gl.toneMapping = THREE.ACESFilmicToneMapping;
//           gl.toneMappingExposure = 1.0;
//           gl.outputColorSpace = THREE.SRGBColorSpace;
//         }}
//       >
//         <ambientLight intensity={0.25} />
//         <directionalLight
//           castShadow
//           position={[6, 10, 6]}
//           intensity={1.2}
//           shadow-mapSize-width={2048}
//           shadow-mapSize-height={2048}
//         />

//         <Suspense fallback={<Loader />}>
//           <Environment files={HDR_URL} background blur={false} />

//           <FixedPovCamera points={points} defaultFov={52} backOffset={0.1} upOffset={0.2} />

//           {/* ✅ Variable speed + variable bounce */}
//           <BowlingSystem
//             points={points}
//             intervalMs={1800}
//             speedMin={22}
//             speedMax={48}
//             bounceHeightMin={0.08}
//             bounceHeightMax={0.45}
//             bounceTMin={0.48}
//             bounceTMax={0.74}
//             randomLine={0.45}
//             randomLength={0.45}
//             ballRadius={0.01}
//           />

//           <group>
//             <DracoGLBModel
//               url={MODEL_URL}
//               dracoPath={DRACO_PATH}
//               forceDecoder={FORCE_DECODER}
//               position={MODEL_POS}
//               rotation={MODEL_ROT}
//               scale={MODEL_SCALE}
//               onSceneReady={handleSceneReady}
//             />
//           </group>

//           <ContactShadows position={[0, -0.02, 0]} opacity={0.45} scale={12} blur={2.4} far={12} />
//         </Suspense>
//       </Canvas>

//       <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-xl">
//         <div className="text-sm font-semibold tracking-wide">POV Viewer + Bowling</div>
//         <div className="mt-1 text-xs text-white/70">
//           HDR: <span className="text-white/90">{HDR_URL}</span>
//         </div>
//         <div className="mt-1 text-xs text-white/70">
//           Camera: <span className="text-white/90">WicketTarget → BowlerPoint</span>
//         </div>
//         <div className="mt-1 text-xs text-white/70">
//           Bowling: <span className="text-white/90">Speed & bounce vary per ball</span>
//         </div>
//         <div className="mt-2 text-[11px] text-white/60 leading-relaxed">
//           Fixed camera • No rotate • No zoom • No pan
//         </div>
//       </div>
//     </div>
//   );
// }



































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
      <div style={{ color: "white", background: "rgba(0,0,0,0.8)", padding: "10px", borderRadius: "8px" }}>
        Loading {Math.round(progress)}%
      </div>
    </Html>
  );
}

/* ---------- Model Loader ---------- */
function DracoGLBModel({ url, position, rotation, scale, onSceneReady }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    draco.setDecoderConfig({ type: "js" });
    loader.setDRACOLoader(draco);
  });
  
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  
  // Handle scene ready callback safely
  const onReadyRef = useRef(onSceneReady);
  useEffect(() => { onReadyRef.current = onSceneReady; }, [onSceneReady]);
  
  useEffect(() => {
    if (cloned) {
        // Defer to next frame to avoid render loop issues
        requestAnimationFrame(() => onReadyRef.current?.(cloned));
    }
  }, [cloned]);

  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

/* ---------- 1. THE CAMERA (REVERTED TO ORIGINAL) ---------- */
function FixedPovCamera({ points }) {
  const { camera } = useThree();
  
  useEffect(() => {
    if (!points?.wicket || !points?.bowler) return;
    
    const wicket = points.wicket;
    const bowler = points.bowler;

    // Refresh matrices
    wicket.updateWorldMatrix(true, false);
    bowler.updateWorldMatrix(true, false);

    const wicketPos = new THREE.Vector3();
    const bowlerPos = new THREE.Vector3();
    wicket.getWorldPosition(wicketPos);
    bowler.getWorldPosition(bowlerPos);

    // ORIGINAL LOGIC RESTORED
    // Direction: From Wicket TO Bowler
    const dir = bowlerPos.clone().sub(wicketPos).normalize();
    
    // Position: Start at wicket, move BACKWARDS 0.1m
    const camPos = wicketPos.clone().add(dir.clone().multiplyScalar(-0.1));
    
    // Height: Just 0.2m up (Stump Cam view)
    camPos.y += 0.2; 

    camera.position.copy(camPos);
    camera.lookAt(bowlerPos);
    camera.updateProjectionMatrix();

  }, [points, camera]);

  return null;
}

/* ---------- 2. GAME LOGIC (INVISIBLE SHIELD) ---------- */
function CricketGameSystem({ points }) {
  const ballRef = useRef();
  const shieldRef = useRef();
  const [feedback, setFeedback] = useState(null);

  // Constants
  const GRAVITY = 9.8;
  const DRAG = 0.98;

  const state = useRef({
    phase: "IDLE", // IDLE, BOWLING, HIT
    t: 0, 
    start: new THREE.Vector3(),
    mid: new THREE.Vector3(), // Bounce point
    end: new THREE.Vector3(), // Target at stumps
    velocity: new THREE.Vector3(),
    speed: 1.5,
  });

  // Start Bowling
  const startBowling = () => {
    if (!points?.bowler || !points?.wicket || !points?.batsman) return;
    
    setFeedback(null);
    const s = state.current;

    const start = new THREE.Vector3(); 
    const wicketPos = new THREE.Vector3();
    const batsmanPos = new THREE.Vector3();
    
    points.bowler.getWorldPosition(start);
    points.wicket.getWorldPosition(wicketPos);
    points.batsman.getWorldPosition(batsmanPos);

    // Target is between wicket and batsman
    const target = wicketPos.clone().lerp(batsmanPos, 0.8);
    
    // Random Line (Left/Right)
    target.x += (Math.random() - 0.5) * 0.4; 
    
    // Bounce Point (Length)
    const bouncePoint = start.clone().lerp(target, 0.65 + Math.random() * 0.1);
    bouncePoint.y = 0; // Floor

    s.phase = "BOWLING";
    s.t = 0;
    s.start.copy(start);
    s.mid.copy(bouncePoint);
    s.end.copy(target);
    s.speed = 1.8 + Math.random() * 0.5; 

    if (ballRef.current) {
        ballRef.current.position.copy(start);
        ballRef.current.visible = true;
    }
  };

  // Handle Click on Invisible Shield
  const handleBatSwing = (e) => {
    e.stopPropagation(); // Important!

    const s = state.current;
    if (s.phase !== "BOWLING") return;

    const ballPos = ballRef.current.position;
    const hitPos = e.point; // Exactly where on screen you clicked (projected to 3D)

    // 1. Accuracy Check (Distance from ball to click)
    const distance = hitPos.distanceTo(ballPos);
    
    // 2. Timing Check (Z-Depth difference)
    // Ball moving fast on Z axis. If zDiff is high, you swung too early/late.
    const zDiff = Math.abs(hitPos.z - ballPos.z);

    if (zDiff > 1.5) {
        setFeedback({ text: "TIMING!", color: "gray" });
        return; 
    }

    if (distance > 0.8) {
        setFeedback({ text: "MISS!", color: "white" });
        return;
    }

    // HIT CONFIRMED - Calculate Physics Vector
    const impactVector = new THREE.Vector3().subVectors(ballPos, hitPos);
    
    // Default drive direction (forward)
    const shotDir = new THREE.Vector3(0, 0.2, 1); 
    // Modify based on where you clicked
    // Click Left -> Ball goes Right
    // Click Right -> Ball goes Left
    shotDir.x += impactVector.x * 2.0; 
    
    // Click Bottom -> Ball goes Up (Loft)
    if (impactVector.y > 0) {
        shotDir.y += impactVector.y * 3.0;
    }

    shotDir.normalize();

    // Power
    const power = (1 - Math.min(distance, 1)) * 30 + 10; 

    // Apply
    s.phase = "HIT";
    s.velocity.copy(shotDir.multiplyScalar(power));

    // UI Text
    let msg = "GOOD SHOT";
    let col = "#4ade80";
    if (impactVector.y > 0.1) { msg = "LOFTED!"; col = "orange"; }
    else if (Math.abs(shotDir.x) > 0.5) { msg = "CUT/PULL"; col = "cyan"; }

    setFeedback({ text: msg, color: col });
  };

  // Game Loop
  useFrame((_, delta) => {
    const s = state.current;
    if (s.phase === "IDLE") return;

    // BOWLING ANIMATION
    if (s.phase === "BOWLING") {
        s.t += delta * s.speed;
        
        if (s.t > 2.2) {
            s.phase = "IDLE";
            setFeedback({ text: "BOWLED!", color: "red" });
            return;
        }

        const t = s.t;
        // Bezier Path: Start -> Bounce -> End
        if (t < 1) {
            ballRef.current.position.lerpVectors(s.start, s.mid, t);
            ballRef.current.position.y += Math.sin(t * Math.PI) * 0.8; // Arc
        } else {
            const t2 = (t - 1) * 1.2; // Faster off pitch
            ballRef.current.position.lerpVectors(s.mid, s.end, t2);
            ballRef.current.position.y += Math.sin(t2 * Math.PI) * 0.4;
        }
    }

    // HIT PHYSICS
    if (s.phase === "HIT") {
        const ball = ballRef.current;
        s.velocity.y -= GRAVITY * delta;
        s.velocity.multiplyScalar(DRAG);
        ball.position.addScaledVector(s.velocity, delta);

        // Floor Bounce
        if (ball.position.y < 0.04) {
            ball.position.y = 0.04;
            s.velocity.y *= -0.6;
            s.velocity.x *= 0.8;
            s.velocity.z *= 0.8;
            if (s.velocity.length() < 0.1) s.phase = "IDLE";
        }
    }
  });

  useEffect(() => {
     const interval = setInterval(() => {
         if (state.current.phase === "IDLE") startBowling();
     }, 3500);
     return () => clearInterval(interval);
  }, [points]);

  return (
    <>
      <group>
        <mesh ref={ballRef} castShadow>
          <sphereGeometry args={[0.04, 32, 32]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.3} />
        </mesh>

        {/* INVISIBLE SHIELD - Covering the view at batsman position */}
        {points?.wicket && (
            <mesh 
                ref={shieldRef}
                // Positioned exactly where the camera is looking (near stumps)
                position={[
                    points.wicket.position.x, 
                    points.wicket.position.y + 1.2, 
                    points.wicket.position.z
                ]} 
                onClick={handleBatSwing}
            >
                <planeGeometry args={[6, 4]} /> 
                {/* Make transparent but clickable */}
                <meshBasicMaterial transparent opacity={0.0} color="red" side={THREE.DoubleSide} />
            </mesh>
        )}
      </group>

      {feedback && (
          <Html position={[0, 1, -3]} center>
              <div style={{ 
                  color: feedback.color, 
                  fontSize: '40px', 
                  fontWeight: '900', 
                  textShadow: '0px 2px 10px rgba(0,0,0,1)',
                  whiteSpace: 'nowrap',
                  fontFamily: 'sans-serif',
                  textTransform: 'uppercase'
              }}>
                  {feedback.text}
              </div>
          </Html>
      )}
    </>
  );
}

/* ---------- MAIN PAGE ---------- */
export default function CricketPage() {
  const [points, setPoints] = useState(null);

  const handleSceneReady = (scene) => {
    const bowler = scene.getObjectByName("BowlerPoint");
    const batsman = scene.getObjectByName("BatsmanPoint");
    const wicket = scene.getObjectByName("WicketTarget");

    if (bowler && batsman && wicket) {
        setPoints({ bowler, batsman, wicket });
    }
  };

  return (
    <div style={{ height: "100vh", width: "100vw", background: "black" }}>
      <Canvas shadows camera={{ fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} castShadow intensity={1.5} />
        
        <Suspense fallback={<Loader />}>
          <Environment preset="park" background blur={0.6} />
          
          <CricketGameSystem points={points} />
          <FixedPovCamera points={points} />

          <DracoGLBModel 
            url="/models/cricket.glb" 
            onSceneReady={handleSceneReady}
          />
          
          <ContactShadows opacity={0.5} scale={10} blur={2} far={10} />
        </Suspense>
      </Canvas>

      <div className="absolute top-5 left-5 text-white pointer-events-none bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20">
         <h3 className="font-bold text-lg">POV Cricket</h3>
         <p className="text-sm opacity-80">Click screen to hit.</p>
      </div>
    </div>
  );
}
