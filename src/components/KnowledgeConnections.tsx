import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { GraphNodeItem } from '../types/graph';

interface KnowledgeConnectionsProps {
  nodes: GraphNodeItem[];
  highlightedNodeIds: string[];
  selectedNodeId: string | null;
}

interface ConnectionEdge {
  id: string;
  points: [number, number, number][];
  isHighlighted: boolean;
}

export const KnowledgeConnections = ({
  nodes,
  highlightedNodeIds,
  selectedNodeId,
}: KnowledgeConnectionsProps) => {
  // Map node positions for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNodeItem>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Build edges list avoiding duplicate pairs
  const edges = useMemo(() => {
    const edgeList: ConnectionEdge[] = [];
    const visited = new Set<string>();

    nodes.forEach((node) => {
      node.related.forEach((targetId) => {
        const targetNode = nodeMap.get(targetId);
        if (!targetNode) return;

        const pairKey = [node.id, targetId].sort().join('--');
        if (visited.has(pairKey)) return;
        visited.add(pairKey);

        const isHighlighted =
          (highlightedNodeIds.includes(node.id) && highlightedNodeIds.includes(targetId)) ||
          selectedNodeId === node.id ||
          selectedNodeId === targetId;

        edgeList.push({
          id: pairKey,
          points: [node.position, targetNode.position],
          isHighlighted,
        });
      });
    });

    return edgeList;
  }, [nodes, nodeMap, highlightedNodeIds, selectedNodeId]);

  return (
    <group>
      {edges.map((edge) => (
        <Line
          key={edge.id}
          points={edge.points}
          color={edge.isHighlighted ? '#38bdf8' : '#334155'}
          lineWidth={edge.isHighlighted ? 2.5 : 1}
          transparent
          opacity={edge.isHighlighted ? 0.9 : 0.25}
        />
      ))}
    </group>
  );
};
