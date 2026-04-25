"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { WorkDto } from "@/lib/types";

type GraphNode = d3.SimulationNodeDatum & WorkDto;
type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
};

interface Props {
  works: WorkDto[];
  graphEdges: Array<{ source: string; target: string }>;
  selectedWorkId: string | null;
  onSelect: (id: string) => void;
}

export function CorpusGraph({ works, graphEdges, selectedWorkId, onSelect }: Props) {
  const graphRef = useRef<SVGSVGElement | null>(null);
  const graphNodeSelectionRef =
    useRef<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>(null);

  useEffect(() => {
    if (!graphRef.current || works.length === 0) return;
    const svg = d3.select(graphRef.current);
    const width = 420;
    const height = 380;
    svg.selectAll("*").remove();
    const root = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on("zoom", (event) => root.attr("transform", event.transform.toString())),
    );

    const nodes: GraphNode[] = works.map((w) => ({ ...w }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = graphEdges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(90),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(20));

    const link = root
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#6b5e4a")
      .attr("stroke-width", 1.2);

    const node = root
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", 9)
      .attr("fill", "#a8987e")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("click", (_, d) => onSelect(d.id));

    graphNodeSelectionRef.current = node;

    const labels = root
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("font-size", 10)
      .attr("fill", "#6b5e4a")
      .attr("text-anchor", "middle")
      .text((d) => d.title.slice(0, 18));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => ("x" in d.source ? (d.source as GraphNode).x ?? 0 : 0))
        .attr("y1", (d) => ("y" in d.source ? (d.source as GraphNode).y ?? 0 : 0))
        .attr("x2", (d) => ("x" in d.target ? (d.target as GraphNode).x ?? 0 : 0))
        .attr("y2", (d) => ("y" in d.target ? (d.target as GraphNode).y ?? 0 : 0));
      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      labels.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) + 22);
    });

    return () => {
      simulation.stop();
      graphNodeSelectionRef.current = null;
    };
  }, [works, graphEdges]);

  useEffect(() => {
    if (!graphNodeSelectionRef.current) return;
    graphNodeSelectionRef.current
      .attr("r", (d) => (selectedWorkId === d.id ? 12 : 9))
      .attr("fill", (d) => (selectedWorkId === d.id ? "#7a4f1e" : "#a8987e"));
  }, [selectedWorkId]);

  return <svg ref={graphRef} viewBox="0 0 420 380" className="graph" />;
}
