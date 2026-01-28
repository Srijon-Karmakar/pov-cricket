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
      <div style={{ 
          color: "white", 
          background: "rgba(0,0,0,0.8)", 
          padding: "12px 20px", 
          borderRadius: "8px",
          fontFamily: "monospace",
          border: "1px solid rgba(255,255,255,0.2)"
      }}>
        LOADING {Math.round(progress)}%
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
  const onReadyRef = useRef(onSceneReady);
  
  useEffect(() => { onReadyRef.current = onSceneReady; }, [onSceneReady]);
  useEffect(() => {
    if (cloned) {
        requestAnimationFrame(() => onReadyRef.current?.(cloned));
    }
  }, [cloned]);

  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

/* ---------- Camera Logic ---------- */
function FixedPovCamera({ points }) {
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

    // Direction: From Wicket TO Bowler
    const dir = bowlerPos.clone().sub(wicketPos).normalize();
    
    // Position: 10cm behind wicket, 20cm up (Stump Cam)
    const camPos = wicketPos.clone().add(dir.clone().multiplyScalar(-0.1));
    camPos.y += 0.2; 

    camera.position.copy(camPos);
    camera.lookAt(bowlerPos);
    camera.updateProjectionMatrix();

  }, [points, camera]);

  return null;
}

/* ---------- GAME LOGIC (PURE NEWTONIAN PHYSICS) ---------- */
function CricketGameSystem({ points }) {
  const ballRef = useRef();
  const shieldRef = useRef();
  const [feedback, setFeedback] = useState(null);

  // --- PHYSICS CONSTANTS ---
  const GRAVITY = 18.0; // Slightly exaggerated gravity for visual snap
  const BALL_RADIUS = 0.035; 
  const BOUNCE_DAMPING = 0.65; // Ball loses 35% speed on bounce
  const GROUND_FRICTION = 0.96; // Skids on ground

  // --- GAME STATE ---
  const state = useRef({
    active: false,    // Is ball moving?
    velocity: new THREE.Vector3(0,0,0), // Current Velocity
    hasBounced: false,
    speedFactor: 1.0, // Multiplier
  });

  // --- 1. CALCULATE THROW (Ballistics) ---
  const startBowling = () => {
    if (!points?.bowler || !points?.wicket || !points?.batsman) return;
    
    setFeedback(null);
    const s = state.current;
    
    // POSITIONS
    const startPos = new THREE.Vector3();
    const wicketPos = new THREE.Vector3();
    points.bowler.getWorldPosition(startPos);
    points.wicket.getWorldPosition(wicketPos);

    // 1. SETUP BALL
    // Force release height (approx 2.2m - Bowler hand height)
    startPos.y = 2.2; 
    ballRef.current.position.copy(startPos);
    ballRef.current.visible = true;
    ballRef.current.rotation.set(0,0,0);

    // 2. DETERMINE TARGET (Where to bounce)
    // Random Length: 0 (Batsman) to 1 (Bowler). 
    // Good length is approx 0.15 to 0.25 away from stumps in this scale
    const lengthAlpha = 0.12 + Math.random() * 0.15; // Random Good Length
    const lineOffset = (Math.random() - 0.5) * 0.6; // Left/Right
    
    const targetPos = wicketPos.clone().lerp(startPos, lengthAlpha);
    targetPos.x += lineOffset;
    targetPos.y = BALL_RADIUS; // Target is ON THE FLOOR

    // 3. CALCULATE VELOCITY (Projectile Motion Formula)
    // We want to hit 'targetPos' from 'startPos'.
    // We choose a random Flight Time (Speed).
    const distance = new THREE.Vector3(targetPos.x, 0, targetPos.z).distanceTo(new THREE.Vector3(startPos.x, 0, startPos.z));
    
    // Faster ball = Less time. 
    // Random speed factor: Fast(0.5s) to Slow(0.7s)
    const timeToTarget = 0.45 + Math.random() * 0.2; 
    
    // Horizontal Velocity = Distance / Time
    const velocityHorizontal = targetPos.clone().sub(startPos);
    velocityHorizontal.y = 0;
    velocityHorizontal.normalize().multiplyScalar(distance / timeToTarget);

    // Vertical Velocity (Vy)
    // Formula: y = y0 + vy*t - 0.5*g*t^2
    // We know y (TargetY), y0 (StartY), g, t. Solve for vy.
    // vy = (y - y0 + 0.5*g*t^2) / t
    const vy = (targetPos.y - startPos.y + 0.5 * GRAVITY * (timeToTarget * timeToTarget)) / timeToTarget;

    // Combine
    s.velocity.set(velocityHorizontal.x, vy, velocityHorizontal.z);
    
    // Reset State
    s.active = true;
    s.hasBounced = false;
  };

  // --- 2. HANDLE HIT ---
  const handleBatSwing = (e) => {
    e.stopPropagation(); 
    const s = state.current;
    if (!s.active) return; // Can't hit if not moving

    const ballPos = ballRef.current.position;
    const hitPos = e.point; 

    // Timing/Accuracy Logic
    const distance = hitPos.distanceTo(ballPos);
    const zDiff = Math.abs(hitPos.z - ballPos.z);

    // Strict timing window (0.8m depth tolerance)
    if (zDiff > 0.8) {
        setFeedback({ text: "TIMING!", color: "gray" });
        return; 
    }
    // Strict hitbox (0.5m radius)
    if (distance > 0.5) { 
        setFeedback({ text: "MISS!", color: "white" });
        return;
    }

    // --- PHYSICS REACTION (THE HIT) ---
    // Calculate direction based on where you clicked on the "Sphere" of influence
    const impactVector = new THREE.Vector3().subVectors(ballPos, hitPos);
    
    // Base drive is forward (towards bowler)
    const shotDir = new THREE.Vector3(0, 0.15, 1);
    
    // Add horizontal angle (Cut/Glance)
    shotDir.x += impactVector.x * 3.0; 
    
    // Add loft (only if clicked underneath)
    if (impactVector.y > 0) {
        shotDir.y += impactVector.y * 4.0;
    } else {
        // Ground shot force
        shotDir.y = -0.1; 
    }
    
    shotDir.normalize();

    // Power
    const power = (1 - distance) * 40 + 15; 

    // Apply Hit Velocity
    s.velocity.copy(shotDir.multiplyScalar(power));
    s.hasBounced = true; // Treat hit as post-bounce logic (simple physics)

    // Feedback UI
    let msg = "SHOT!";
    let col = "#4ade80";
    if (shotDir.y > 0.3) { msg = "SIX!"; col = "orange"; }
    else if (Math.abs(shotDir.x) > 0.6) { msg = "CUT"; col = "cyan"; }
    
    setFeedback({ text: msg, color: col });
  };

  // --- 3. PHYSICS LOOP (The Heart) ---
  useFrame((_, delta) => {
    const s = state.current;
    if (!s.active) return;
    
    const ball = ballRef.current;
    
    // A. Apply Velocity
    ball.position.addScaledVector(s.velocity, delta);

    // B. Apply Gravity
    s.velocity.y -= GRAVITY * delta;

    // C. Collision Detection (Ground)
    if (ball.position.y <= BALL_RADIUS) {
        // HARD CONSTRAINT: Snap to floor
        ball.position.y = BALL_RADIUS;
        
        // BOUNCE LOGIC
        // Reverse Y velocity + Damping (Energy Loss)
        s.velocity.y = -s.velocity.y * BOUNCE_DAMPING;
        
        // Friction (Slow down X/Z on bounce)
        s.velocity.x *= GROUND_FRICTION;
        s.velocity.z *= GROUND_FRICTION;

        s.hasBounced = true;

        // Stop rolling if too slow
        if (s.velocity.length() < 0.2) {
            s.active = false;
        }
    }

    // D. Visual Rotation (Spin)
    ball.rotation.x -= s.velocity.z * delta * 2.0;
    ball.rotation.z += s.velocity.x * delta * 2.0;

    // E. Reset if passed wicket (Missed)
    const wicketZ = points?.wicket?.position.z || 0;
    if (ball.position.z < wicketZ - 2) {
         s.active = false;
         setFeedback({ text: "BEATEN", color: "#ef4444" });
    }
  });

  // Loop
  useEffect(() => {
     const interval = setInterval(() => {
         if (!state.current.active) startBowling();
     }, 1000);
     return () => clearInterval(interval);
  }, [points]);

  return (
    <>
      <group>
        <mesh ref={ballRef} castShadow receiveShadow>
          <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
          <meshStandardMaterial 
            color="#8b0000" 
            roughness={0.3} 
            metalness={0.1}
            envMapIntensity={2.0}
          />
        </mesh>

        {/* CLICK SHIELD - At Batsman Position */}
        {points?.wicket && (
            <mesh 
                ref={shieldRef}
                position={[
                    points.wicket.position.x, 
                    points.wicket.position.y + 1.2, 
                    points.wicket.position.z
                ]} 
                onClick={handleBatSwing}
            >
                <planeGeometry args={[8, 6]} /> 
                <meshBasicMaterial transparent opacity={0.0} side={THREE.DoubleSide} />
            </mesh>
        )}
      </group>

      {feedback && (
          <Html position={[0, 1, -3]} center>
              <div style={{ 
                  color: feedback.color, 
                  fontSize: '48px', 
                  fontWeight: '900', 
                  textShadow: '0px 4px 12px rgba(0,0,0,0.8)',
                  whiteSpace: 'nowrap',
                  fontFamily: 'sans-serif',
                  fontStyle: 'italic',
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
    
    scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
  };

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#111" }}>
      <Canvas shadows="soft" camera={{ fov: 50 }} gl={{ toneMappingExposure: 1.1 }}>
        
        {/* LIGHTING */}
        <ambientLight intensity={0.4} color="#b0c4de" />
        <directionalLight 
            position={[-5, 12, -5]} 
            intensity={2.5} 
            castShadow 
            shadow-bias={-0.0001}
            shadow-mapSize={[2048, 2048]} 
        >
            <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10]} />
        </directionalLight>
        <directionalLight position={[5, 0, 5]} intensity={0.5} color="#ffd700" />

        <Suspense fallback={<Loader />}>
          <Environment preset="sunset" background blur={0.7} />
          
          <CricketGameSystem points={points} />
          <FixedPovCamera points={points} />

          <DracoGLBModel 
            url="/models/cricket.glb" 
            onSceneReady={handleSceneReady}
          />
          
          <ContactShadows opacity={0.6} scale={20} blur={2.5} far={4} color="#000000" />
        </Suspense>
      </Canvas>

      <div className="absolute top-5 left-5 text-white pointer-events-none bg-black/30 p-4 rounded-xl backdrop-blur-md border border-white/10">
         <h3 className="font-bold text-xl tracking-wider">PRO CRICKET PHYSICS</h3>
         <p className="text-sm opacity-80 mt-1">Real Gravity & Collision</p>
         <div className="mt-2 text-xs text-yellow-400">Tap screen to bat</div>
      </div>
    </div>
  );
}