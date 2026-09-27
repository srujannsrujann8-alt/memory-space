import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import * as THREE from 'three';
import { GraphNodeItem } from '../types/graph';
import { KnowledgeNode } from './KnowledgeNode';
import { KnowledgeConnections } from './KnowledgeConnections';
import { BackgroundParticles } from './BackgroundParticles';

interface KnowledgeSceneProps {
  nodes: GraphNodeItem[];
  selectedNodeId: string | null;
  highlightedNodeIds: string[];
  onSelectNode: (node: GraphNodeItem | null) => void;
}

// Controller component to smoothly lerp camera target towards selected node
const CameraTargetController = ({
  targetNode,
}: {
  targetNode: GraphNodeItem | null;
}) => {
  const controlsRef = useRef<OrbitControlsType>(null);
  const targetVec = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (targetNode) {
      targetVec.current.set(
        targetNode.position[0],
        targetNode.position[1],
        targetNode.position[2]
      );
    } else {
      targetVec.current.set(0, 0, 0);
    }
  }, [targetNode]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetVec.current, 0.05);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      minDistance={3.5}
      maxDistance={14.0}
      maxPolarAngle={Math.PI / 1.7}
      minPolarAngle={Math.PI / 4.5}
      autoRotate={!targetNode}
      autoRotateSpeed={0.3}
    />
  );
};

export const KnowledgeScene = ({
  nodes,
  selectedNodeId,
  highlightedNodeIds,
  onSelectNode,
}: KnowledgeSceneProps) => {
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-auto">
      <Canvas
        camera={{ position: [0, 0.6, 9.2], fov: 46 }}
        onPointerDown={(e) => {
          // If clicked empty space, clear selection
          if (e.target === e.currentTarget) {
            onSelectNode(null);
          }
        }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Ambient & Directional Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} color="#38bdf8" intensity={0.5} />
        <pointLight position={[10, 10, -5]} color="#a855f7" intensity={0.5} />

        {/* Orbit Controls & Camera lerp */}
        <CameraTargetController targetNode={selectedNode} />

        {/* Celestial Background Particles */}
        <BackgroundParticles count={450} />

        {/* Dynamic Glowing Connections */}
        <KnowledgeConnections
          nodes={nodes}
          highlightedNodeIds={highlightedNodeIds}
          selectedNodeId={selectedNodeId}
        />

        {/* Floating Interactive 3D Nodes */}
        <group>
          {nodes.map((node) => (
            <KnowledgeNode
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              isHighlighted={highlightedNodeIds.includes(node.id)}
              onSelect={(n) => onSelectNode(n)}
            />
          ))}
        </group>
      </Canvas>
    </div>
  );
};
