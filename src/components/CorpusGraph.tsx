"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";
import type { WorkDto } from "@/lib/types";

type GraphNode = d3.SimulationNodeDatum & WorkDto;
type GraphLink = d3.SimulationLinkDatum<GraphNode>;

interface Props {
  works: WorkDto[];
  selectedWorkId: string | null;
  onSelect: (id: string) => void;
}

/** After simulation resolves links, source/target become GraphNode objects. */
function nodeX(endpoint: string | number | GraphNode): number {
  if (typeof endpoint === "object" && "x" in endpoint) return endpoint.x ?? 0;
  return 0;
}
function nodeY(endpoint: string | number | GraphNode): number {
  if (typeof endpoint === "object" && "y" in endpoint) return endpoint.y ?? 0;
  return 0;
}

export function CorpusGraph({ works, selectedWorkId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodeSelRef =
    useRef<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || works.length === 0) return;

    const svg = d3.select(svgRef.current);
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
    const links: GraphLink[] = works
      .flatMap((w) =>
        w.references.map((r) => ({ source: w.id, target: r.targetWorkId }))
      )
      .filter((e) => nodeIds.has(e.source as string) && nodeIds.has(e.target as string));

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
      .attr("stroke", "#45413a")
      .attr("stroke-width", 1.2);

    const node = root
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", 9)
      .attr("fill", "#8c877f")
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

    nodeSelRef.current = node;

    const labels = root
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("font-size", 10)
      .attr("fill", "#b9b5ad")
      .attr("text-anchor", "middle")
      .text((d) => d.title.slice(0, 18));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => nodeX(d.source))
        .attr("y1", (d) => nodeY(d.source))
        .attr("x2", (d) => nodeX(d.target))
        .attr("y2", (d) => nodeY(d.target));
      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      labels.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) + 22);
    });

    return () => {
      simulation.stop();
      nodeSelRef.current = null;
    };
  }, [works, onSelect]);

  useEffect(() => {
    if (!nodeSelRef.current) return;
    nodeSelRef.current
      .attr("r", (d) => (selectedWorkId === d.id ? 12 : 9))
      .attr("fill", (d) => (selectedWorkId === d.id ? "#b5935a" : "#8c877f"));
  }, [selectedWorkId]);

  return <svg ref={svgRef} viewBox="0 0 420 380" className="graph" />;
}
