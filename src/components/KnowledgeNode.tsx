import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { GraphNodeItem } from '../services/graphService';

interface KnowledgeNodeProps {
  node: GraphNodeItem;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (node: GraphNodeItem) => void;
}

export const KnowledgeNode = ({
  node,
  isSelected,
  isHighlighted,
  onSelect,
}: KnowledgeNodeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRingRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Random phase offset so nodes don't float in lockstep
  const phase = useRef(Math.random() * Math.PI * 2);

  // Floating bob animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime() + phase.current;
    meshRef.current.position.y = Math.sin(t * 1.5) * 0.08;

    if (glowRingRef.current) {
      glowRingRef.current.rotation.z += 0.01;
      glowRingRef.current.rotation.x = Math.sin(t * 0.8) * 0.2;
    }
  });

  const isActive = isSelected || isHighlighted;
  const targetScale = hovered ? 1.4 : isActive ? 1.25 : 1.0;

  // Base node size: larger for Category Hubs, sleeker for Document Leaves
  const isRootHub = !!node.isRootNode;
  const isCategoryHub = !!node.isCategoryNode;
  const isEmptyCategory = isCategoryHub && node.documents === 0;
  const baseRadius = isRootHub ? 0.44 : isCategoryHub ? 0.34 : 0.22;

  // Formatted display label: categories show count, e.g. "Notes (1)", "Images (0)"
  const displayLabel = isRootHub
    ? `MemorySpace (${node.documents})`
    : isCategoryHub
    ? `${node.name} (${node.documents})`
    : node.name;

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        scale={targetScale}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Core sphere */}
        <sphereGeometry args={[baseRadius, 32, 32]} />
        <meshStandardMaterial
          color={isActive || hovered ? '#ffffff' : node.color}
          emissive={node.glowColor}
          emissiveIntensity={
            isActive
              ? 2.5
              : hovered
              ? 2.0
              : isEmptyCategory
              ? 0.35
              : isRootHub
              ? 1.4
              : 0.85
          }
          roughness={0.2}
          metalness={0.8}
        />

        {/* Outer subtle glow halo for highlighted / hovered / hub nodes */}
        {(isActive || hovered || isCategoryHub || isRootHub) && (
          <mesh ref={glowRingRef}>
            <ringGeometry args={[baseRadius * 1.35, baseRadius * 1.65, 32]} />
            <meshBasicMaterial
              color={node.color}
              transparent
              opacity={
                hovered
                  ? 0.7
                  : isEmptyCategory
                  ? 0.18
                  : isRootHub
                  ? 0.45
                  : isCategoryHub
                  ? 0.35
                  : 0.45
              }
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </mesh>

      {/* Floating HTML Label positioned above node */}
      <Html
        position={[0, baseRadius + 0.38, 0]}
        center
        distanceFactor={12}
        style={{
          pointerEvents: 'none',
          transition: 'all 0.2s ease-out',
        }}
      >
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all duration-300 ${
            isActive
              ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] font-semibold scale-110'
              : hovered
              ? 'bg-slate-900/90 text-white border border-sky-400/80 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
              : isRootHub
              ? 'bg-slate-950/90 text-cyan-300 border border-cyan-400/50 font-bold shadow-[0_0_12px_rgba(56,189,248,0.25)] backdrop-blur-sm'
              : isCategoryHub
              ? isEmptyCategory
                ? 'bg-slate-950/60 text-slate-400 border border-slate-800/60 backdrop-blur-sm opacity-75'
                : 'bg-slate-900/90 text-cyan-300 border border-cyan-500/40 font-bold backdrop-blur-sm'
              : 'bg-slate-950/70 text-slate-300 border border-slate-700/50 backdrop-blur-sm opacity-85'
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: node.color }}
          />
          <span className="truncate max-w-[150px]" title={displayLabel}>{displayLabel}</span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping flex-shrink-0" />
          )}
        </div>
      </Html>
    </group>
  );
};
