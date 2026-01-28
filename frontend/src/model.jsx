import React, { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader, DRACOLoader, MeshoptDecoder } from "three-stdlib";

export default function Model({ url, onReady }) {
  const gltf = useLoader(
    GLTFLoader,
    url,
    (loader) => {
      const base = import.meta.env.BASE_URL || "/";

      const draco = new DRACOLoader();
      draco.setDecoderPath(`${base}draco/`);
      loader.setDRACOLoader(draco);

      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  );

  const centeredScene = useMemo(() => {
    const s = gltf.scene.clone(true);

    s.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(s);
    const c = new THREE.Vector3();
    box.getCenter(c);
    s.position.sub(c);

    return s;
  }, [gltf]);

  useEffect(() => {
    onReady?.(centeredScene);
  }, [centeredScene, onReady]);

  return <primitive object={centeredScene} />;
}
