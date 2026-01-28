// import React, { useRef, useState, useEffect, Suspense, useLayoutEffect } from 'react';
// import { Canvas } from '@react-three/fiber';
// import { useGLTF, Environment, PerspectiveCamera, Html } from '@react-three/drei';
// import { Physics, RigidBody, CapsuleCollider } from '@react-three/rapier';
// import * as THREE from 'three';

// // --- 1. Stadium Model (Unchanged) ---
// function Stadium({ onPointsLoaded }) {
//   const { scene } = useGLTF('/models/cricket.glb'); 

//   useEffect(() => {
//     if (scene) {
//       // Find points or use fallbacks
//       const batsman = scene.getObjectByName('BatsmanPoint') || { position: new THREE.Vector3(0, 2, 0) };
//       const bowler = scene.getObjectByName('BowlerPoint') || { position: new THREE.Vector3(0, 2, 20) };
//       const wicket = scene.getObjectByName('WicketTarget') || { position: new THREE.Vector3(0, 0, 0) };

//       onPointsLoaded({
//         batsman: batsman.position,
//         bowler: bowler.position,
//         wicket: wicket.position
//       });
//     }
//   }, [scene, onPointsLoaded]);

//   return <primitive object={scene} />;
// }


// // --- 2. The Player Rig (FIXED ANGLE) ---
// // --- The Player Rig (Horizon Fix) ---
// // --- The Player Rig (Horizon Fix) ---
// function BatsmanRig({ position, targetPosition }) {
//   const cameraRef = useRef();

//   // Settings for the view
//   const EYE_HEIGHT = 0.001; // Height from ground to eyes (Crouching stance)
  
//   useLayoutEffect(() => {
//     if (cameraRef.current && targetPosition) {
//       // THE FIX: Level the view.
//       // 1. We keep the X and Z of the bowler (to face the right direction).
//       // 2. BUT we change the Y (height) to match the camera's own height.
//       // This forces the camera to look parallel to the ground (at the horizon).
      
//       const lookAtX = targetPosition.x;
//       const lookAtY = position.y + EYE_HEIGHT; // <--- Match Camera Height (Horizon View)
//       const lookAtZ = targetPosition.z;

//       cameraRef.current.lookAt(lookAtX, lookAtY, lookAtZ);
//     }
//   }, [targetPosition, position]); 

//   return (
//     <RigidBody 
//       position={[position.x, position.y + EYE_HEIGHT, position.z]} 
//       type="fixed" 
//       colliders="hull"
//     >
//       <CapsuleCollider args={[0.8, 0.3]} />
      
//       <PerspectiveCamera 
//         ref={cameraRef} 
//         makeDefault 
//         fov={70}  // Lower FOV (50-60) makes the pitch look more realistic/longer like on TV
//         position={[0, 0, 0]} 
//       />
//     </RigidBody>
//   );
// }

// // --- 3. Main Page ---
// export default function Cricket3DPage() {
//   const [points, setPoints] = useState(null);

//   return (
//     <div className="w-full h-screen bg-black relative">
//       <Canvas>
//         <Suspense fallback={<Html center><div className="text-white">Loading...</div></Html>}>
//           <Environment files="/hdr/alps.hdr" background blur={0.6} />
//           <ambientLight intensity={0.5} />
//           <directionalLight position={[10, 10, 5]} intensity={1} />

//           <Physics>
//             <Stadium onPointsLoaded={setPoints} />
            
//             {/* Pass both Batsman (camera loc) and Bowler (target loc) points */}
//             {points && (
//               <BatsmanRig 
//                 position={points.batsman} 
//                 targetPosition={points.bowler} 
//               />
//             )}
//           </Physics>
//         </Suspense>
//       </Canvas>
      
//       {/* Updated UI Overlay */}
//       <div className="absolute top-4 left-4 text-white z-10 pointer-events-none select-none">
//         <h1 className="text-xl font-bold">Batsman POV</h1>
//         <p className="text-sm opacity-75">Fixed Camera View</p>
//       </div>
//     </div>
//   );
// }


































import React, { useRef, useState, useEffect, Suspense, useLayoutEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, Environment, PerspectiveCamera, Html } from '@react-three/drei';
import { Physics, RigidBody, CapsuleCollider, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

// --- 1. Stadium & The "Pitch" ---
function Stadium({ onPointsLoaded }) {
  const { scene } = useGLTF('/models/cricket.glb'); 

  useEffect(() => {
    if (scene) {
      const batsman = scene.getObjectByName('BatsmanPoint') || { position: new THREE.Vector3(0, 2, 0) };
      const bowler = scene.getObjectByName('BowlerPoint') || { position: new THREE.Vector3(0, 2, 20) };
      const wicket = scene.getObjectByName('WicketTarget') || { position: new THREE.Vector3(0, 0, 0) };

      onPointsLoaded({
        batsman: batsman.position.clone(),
        bowler: bowler.position.clone(),
        wicket: wicket.position.clone()
      });
    }
  }, [scene, onPointsLoaded]);

  return (
    <group>
      {/* Visual Model */}
      <primitive object={scene} />

      {/* PHYSICS HACK: Invisible Floor specifically for the Pitch.
         Trimesh is too buggy for fast balls. A Box is reliable.
         Placed at y=0, sized to cover the pitch area.
         Friction 1.0 makes the ball "grip" the pitch (spin/cut).
         Restitution 0.6 simulates the energy loss on impact.
      */}
      <RigidBody type="fixed" colliders="cuboid" friction={1.0} restitution={0.6}>
        <CuboidCollider args={[5, 0.1, 15]} position={[0, -0.1, 10]} /> 
      </RigidBody>
    </group>
  );
}

// --- 2. The Realistic Ball ---
function Ball({ startPos, targetPos, isBowling }) {
  const rigidBody = useRef();

  useEffect(() => {
    if (rigidBody.current && startPos && targetPos) {
      // 1. Reset Ball to Hand
      const releaseHeight = 2.2; // High arm action
      const startPoint = new THREE.Vector3(startPos.x, startPos.y + releaseHeight, startPos.z);
      
      rigidBody.current.setTranslation(startPoint, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);

      // 2. CRICKET PHYSICS ALGORITHM
      
      // A. Determine Speed (KPH -> M/S)
      // Pace: 130kph - 150kph
      const speedKph = 130 + Math.random() * 20; 
      const speedMs = speedKph * (1000 / 3600); // ~36 to 41 m/s

      // B. Determine Length (Where it bounces)
      // Distance from bowler release to stumps is approx 20m.
      // Yorker: 20m, Full: 17m, Good: 14m, Short: 10m
      const distanceToWicket = Math.abs(startPos.z - targetPos.z);
      const landingDist = 12 + Math.random() * 6; // Random spot 12m to 18m from bowler
      
      // C. Determine Line (Left/Right)
      const lineOffset = (Math.random() - 0.5) * 0.6; // Small variance left/right

      // D. Calculate Target Coordinate on Floor
      const direction = new THREE.Vector3().subVectors(targetPos, startPos).normalize();
      const bouncePoint = new THREE.Vector3(
        startPos.x + direction.x * landingDist + lineOffset,
        0, // Floor
        startPos.z + direction.z * landingDist // This assumes Z is the length axis
      );

      // E. Calculate Velocity Vector (Projectile Motion)
      // We know: Start(x,y,z), End(x,y,z), and Horizontal Speed (speedMs)
      
      // Time = Distance / Speed
      const horizDist = new THREE.Vector2(bouncePoint.x - startPoint.x, bouncePoint.z - startPoint.z).length();
      const timeToImpact = horizDist / speedMs;

      // Vx and Vz are constant components of horizontal speed
      const velX = (bouncePoint.x - startPoint.x) / timeToImpact;
      const velZ = (bouncePoint.z - startPoint.z) / timeToImpact;

      // Vy (Vertical) uses gravity equation: d = vt + 0.5at^2
      // Rearranged: v = (d - 0.5at^2) / t
      // We want to drop from `releaseHeight` to `0` in `timeToImpact`
      const gravity = -9.81;
      const distY = 0 - startPoint.y;
      const velY = (distY - (0.5 * gravity * Math.pow(timeToImpact, 2))) / timeToImpact;

      // 3. Apply Velocity
      rigidBody.current.setLinvel({ x: velX, y: velY, z: velZ }, true);

      // 4. Add "Seam" rotation (Backspin helps stability)
      rigidBody.current.setAngvel({ x: -10, y: 0, z: 0 }, true);
    }
  }, [isBowling, startPos, targetPos]);

  return (
    <RigidBody 
      ref={rigidBody} 
      colliders="ball" 
      restitution={0.7} // 0.7 is a good standard for a hard cricket ball
      friction={0.5} 
      linearDamping={0.1} // Air resistance (Drag)
      ccd={true} // <--- CRITICAL: Continuous Collision Detection prevents tunneling
      position={[0, -5, 0]} 
    >
      <mesh castShadow>
        <sphereGeometry args={[0.036]} />
        <meshStandardMaterial color="#8B0000" roughness={0.3} />
      </mesh>
    </RigidBody>
  );
}

// --- 3. Batsman Rig (Fixed Height) ---
function BatsmanRig({ position, targetPosition }) {
  const cameraRef = useRef();
  
  // FIXED: Eye height must be realistic (~1.2m for crouching stance)
  // Your previous 0.001 was making it feel like lying on the floor.
  const EYE_HEIGHT = 1.2; 
  
  useLayoutEffect(() => {
    if (cameraRef.current && targetPosition) {
      // Look at the bowler's release point (approx 2m high) for realistic view
      cameraRef.current.lookAt(targetPosition.x, targetPosition.y + 2, targetPosition.z);
    }
  }, [targetPosition, position]); 

  return (
    <RigidBody position={[position.x, position.y + EYE_HEIGHT, position.z]} type="fixed" colliders="hull">
      <CapsuleCollider args={[0.8, 0.3]} />
      <PerspectiveCamera ref={cameraRef} makeDefault fov={55} position={[0, 0, 0]} />
    </RigidBody>
  );
}

// --- 4. Main Page ---
export default function Cricket3DPage() {
  const [points, setPoints] = useState(null);
  const [bowlTrigger, setBowlTrigger] = useState(0); 

  return (
    <div className="w-full h-screen bg-black relative">
      <Canvas shadows>
        <Suspense fallback={<Html center><div className="text-white">Loading...</div></Html>}>
          <Environment files="/hdr/alps.hdr" background blur={0.6} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[-10, 10, 5]} intensity={1.5} castShadow />

          <Physics gravity={[0, -9.81, 0]}>
            <Stadium onPointsLoaded={setPoints} />
            
            {points && (
              <>
                <BatsmanRig position={points.batsman} targetPosition={points.bowler} />
                <Ball 
                  startPos={points.bowler} 
                  targetPos={points.wicket} 
                  isBowling={bowlTrigger} 
                />
              </>
            )}
          </Physics>
        </Suspense>
      </Canvas>
      
      {/* Interaction UI */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-10">
        <button 
          onClick={() => setBowlTrigger(p => p + 1)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-10 rounded-full shadow-xl transition-all active:scale-95 uppercase tracking-widest text-lg"
        >
          Bowl Ball
        </button>
      </div>

      <div className="absolute top-6 left-6 text-white z-10 pointer-events-none">
        <h1 className="text-2xl font-bold">Wicket Keeper View</h1>
        <p className="opacity-75 text-sm">Real-time Physics Simulation</p>
      </div>
    </div>
  );
}