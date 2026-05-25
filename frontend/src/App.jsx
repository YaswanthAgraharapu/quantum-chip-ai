import React, { useMemo, useState } from "react";
import axios from "axios";
import { Activity, Bot, Box, Cpu, Diamond, Download, GitCompare, Grid2X2, Hexagon, Play, Plus, Radio, Send, Square, Sparkles, UserRound } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_URL = "http://127.0.0.1:8000";

const starterPrompt =
  "Create a superconducting quantum chip with 6 qubits, shared resonator, low complexity and compare topologies.";

const quickPrompts = [
  "Create a 4 qubit ring topology with shared resonator",
  "Design an 8 qubit mesh chip with low routing density",
  "Build a 6 qubit star topology and explain bottlenecks",
];

const qubitFamilies = [
  { id: "transmon", label: "Transmon", icon: Hexagon },
  { id: "fluxonium", label: "Fluxonium", icon: Diamond },
  { id: "xmon", label: "Xmon", icon: Plus },
  { id: "concentric", label: "Concentric", icon: Radio },
  { id: "gatemon", label: "Gatemon", icon: Square },
  { id: "squid loop", label: "SQUID Loop", icon: Grid2X2 },
];

function extractQubits(text) {
  const match = text.toLowerCase().match(/(\d+)\s*(qubit|qubits|qbit|qbits|core|cores)/);
  return match ? Math.max(2, Math.min(Number(match[1]), 16)) : 4;
}

function requestedTopology(text) {
  const lower = text.toLowerCase();
  return ["ring", "mesh", "star", "linear"].find((topology) => lower.includes(topology));
}

function extractRequirements(text) {
  const lower = text.toLowerCase();
  const topology = requestedTopology(text);
  const constraints = [];

  if (lower.includes("low")) constraints.push("Low complexity");
  if (lower.includes("scalable") || lower.includes("scale")) constraints.push("Scalable architecture");
  if (lower.includes("dense") || lower.includes("density")) constraints.push("Routing density aware");
  if (lower.includes("compare") || lower.includes("variation")) constraints.push("Compare multiple designs");
  if (constraints.length === 0) constraints.push("Balanced architecture");

  return {
    qubits: extractQubits(text),
    requestedTopology: topology ? `${topology[0].toUpperCase()}${topology.slice(1)}` : "Auto compare",
    readout: /resonator|readout|shared/i.test(text) ? "Shared resonator/readout requested" : "Dedicated readout not specified",
    constraints,
    intent: "Generate superconducting quantum chip architecture from natural language",
  };
}

function localFallbackGenerate(text) {
  const qubits = extractQubits(text);
  const hasSharedResonator = /resonator|readout|shared/i.test(text);
  const requested = requestedTopology(text);
  const topologies = requested ? [requested] : ["ring", "mesh", "star"];
  const designs = topologies.map((topology) => buildLocalDesign(topology, qubits, hasSharedResonator));
  const recommended = designs.reduce((best, design) =>
    design.metrics.efficiency > best.metrics.efficiency ? design : best
  );

  return {
    prompt: text,
    requirements: extractRequirements(text),
    designs,
    recommendedId: recommended.id,
    summary: "Generated locally because the backend is not running.",
  };
}

function buildLocalDesign(topology, qubits, hasSharedResonator) {
  const nodes = Array.from({ length: qubits }, (_, index) => ({
    id: `Q${index + 1}`,
    label: `Q${index + 1}`,
    type: "qubit",
    role: "Transmon qubit",
  }));

  if (hasSharedResonator) {
    nodes.push({ id: "R1", label: "R1", type: "resonator", role: "Shared readout resonator" });
  }

  const edges = [];
  if (topology === "ring") {
    for (let index = 0; index < qubits; index += 1) {
      edges.push({ source: `Q${index + 1}`, target: `Q${((index + 1) % qubits) + 1}`, type: "coupler" });
    }
  }
  if (topology === "star") {
    for (let index = 2; index <= qubits; index += 1) {
      edges.push({ source: "Q1", target: `Q${index}`, type: "coupler" });
    }
  }
  if (topology === "mesh") {
    const cols = Math.ceil(Math.sqrt(qubits));
    for (let index = 0; index < qubits; index += 1) {
      const col = index % cols;
      const right = index + 1;
      const down = index + cols;
      if (col < cols - 1 && right < qubits) {
        edges.push({ source: `Q${index + 1}`, target: `Q${right + 1}`, type: "coupler" });
      }
      if (down < qubits) {
        edges.push({ source: `Q${index + 1}`, target: `Q${down + 1}`, type: "coupler" });
      }
    }
  }
  if (topology === "linear") {
    for (let index = 1; index < qubits; index += 1) {
      edges.push({ source: `Q${index}`, target: `Q${index + 1}`, type: "coupler" });
    }
  }
  if (hasSharedResonator) {
    for (let index = 1; index <= qubits; index += 1) {
      edges.push({ source: `Q${index}`, target: "R1", type: "readout" });
    }
  }

  const placedNodes = placeLocalNodes(nodes, topology, qubits);
  const density = edges.length / Math.max(1, qubits);
  const complexity = Math.min(100, Math.round(density * 18 + qubits * 2));
  const topologyBonus = { mesh: 22, ring: 16, star: 10, linear: 6 }[topology];
  const scalability = Math.min(100, 50 + topologyBonus + qubits * 2);
  const efficiency = Math.max(30, Math.min(98, Math.round(scalability - complexity * 0.35 + 20)));

  return {
    id: `${topology}-${qubits}`,
    name: `${topology[0].toUpperCase()}${topology.slice(1)} Topology`,
    topology,
    qubits,
    nodes: placedNodes,
    edges,
    metrics: { complexity, routingDensity: Number(density.toFixed(2)), scalability, efficiency },
    reason: {
      mesh: "Mesh balances local qubit communication and scales well for larger quantum layouts.",
      ring: "Ring keeps routing compact while giving each qubit two neighbors, which is useful for low-complexity demos.",
      star: "Star is simple and easy to explain, but the center qubit can become a communication bottleneck.",
      linear: "Linear is the simplest layout and works well as a baseline architecture.",
    }[topology],
    qiskitMetalCode: `from qiskit_metal import designs
from qiskit_metal.qlibrary.qubits.transmon_pocket import TransmonPocket

design = designs.DesignPlanar()
design.overwrite_enabled = True

# Generated topology: ${topology}
# Qubits: ${qubits}
# Shared resonator: ${hasSharedResonator}

qubits = []
for index in range(${qubits}):
    qubits.append(
        TransmonPocket(
            design,
            f"Q{index + 1}",
            options=dict(pos_x=f"{index * 1.2}mm", pos_y="0mm")
        )
    )
`,
  };
}

function placeLocalNodes(nodes, topology, qubits) {
  const qubitNodes = nodes.filter((node) => node.type === "qubit");
  const placed = [];

  if (topology === "mesh") {
    const cols = Math.ceil(Math.sqrt(qubits));
    qubitNodes.forEach((node, index) => {
      placed.push({ ...node, x: 140 + (index % cols) * 150, y: 100 + Math.floor(index / cols) * 150 });
    });
  } else if (topology === "linear") {
    qubitNodes.forEach((node, index) => placed.push({ ...node, x: 100 + index * 140, y: 210 }));
  } else if (topology === "star") {
    placed.push({ ...qubitNodes[0], x: 350, y: 210 });
    qubitNodes.slice(1).forEach((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(1, qubits - 1);
      placed.push({ ...node, x: 350 + 170 * Math.cos(angle), y: 210 + 170 * Math.sin(angle) });
    });
  } else {
    qubitNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / qubits;
      placed.push({ ...node, x: 350 + 180 * Math.cos(angle), y: 220 + 180 * Math.sin(angle) });
    });
  }

  const resonator = nodes.find((node) => node.type === "resonator");
  if (resonator) placed.push({ ...resonator, x: 350, y: 430 });
  return placed;
}

function ChipCanvas({ design }) {
  if (!design) {
    return (
      <div className="empty-state">
        <Sparkles size={28} />
        <p>Generated superconducting chip architecture will appear here.</p>
      </div>
    );
  }

  const nodeMap = new Map(design.nodes.map((node) => [node.id, node]));

  return (
    <svg className="chip-canvas" viewBox="0 0 720 520" role="img" aria-label="Generated chip layout">
      <defs>
        <linearGradient id="chipBase" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#122235" />
          <stop offset="100%" stopColor="#263b45" />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="42" y="34" width="636" height="452" rx="8" fill="url(#chipBase)" stroke="#6ee7d8" strokeWidth="2" />
      <rect x="76" y="68" width="568" height="384" rx="6" fill="rgba(7, 15, 25, 0.72)" stroke="#365468" />

      {design.edges.map((edge, index) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;

        return (
          <line
            key={`${edge.source}-${edge.target}-${index}`}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            className={edge.type === "readout" ? "readout-line" : "coupler-line"}
          />
        );
      })}

      {design.nodes.map((node, index) => (
        <g key={node.id} className="node-group" style={{ animationDelay: `${index * 90}ms` }}>
          <circle
            cx={node.x}
            cy={node.y}
            r={node.type === "resonator" ? 34 : 28}
            className={node.type === "resonator" ? "resonator-node" : "qubit-node"}
            filter="url(#softGlow)"
          />
          <text x={node.x} y={node.y + 5} textAnchor="middle" className="node-label">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MetalWaveCanvas({ design }) {
  if (!design) {
    return (
      <div className="empty-state compact">
        <Sparkles size={24} />
        <p>Qiskit Metal-style wave layout will appear here.</p>
      </div>
    );
  }

  const qubitLabels = design.nodes.filter((node) => node.type === "qubit").map((node) => node.label);
  const topology = design.topology;
  const visibleLabels = qubitLabels.slice(0, Math.min(qubitLabels.length, 8));

  function Pad({ label, x, y, compact = false }) {
    const width = compact ? 62 : 74;
    const height = compact ? 48 : 54;
    return (
      <g className="wave-pad" filter="url(#padShadow)">
        <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx="4" />
        <text x={x} y={y + 6}>{label}</text>
      </g>
    );
  }

  const meshPositions = visibleLabels.map((label, index) => ({
    label,
    x: 190 + (index % 4) * 120,
    y: 155 + Math.floor(index / 4) * 145,
  }));

  const ringPositions = visibleLabels.map((label, index) => {
    const angle = (2 * Math.PI * index) / visibleLabels.length - Math.PI / 2;
    return {
      label,
      x: 370 + 210 * Math.cos(angle),
      y: 250 + 150 * Math.sin(angle),
    };
  });

  const starPositions = visibleLabels.slice(1).map((label, index) => {
    const angle = (2 * Math.PI * index) / Math.max(1, visibleLabels.length - 1) - Math.PI / 2;
    return {
      label,
      x: 370 + 210 * Math.cos(angle),
      y: 250 + 150 * Math.sin(angle),
    };
  });

  const linearPositions = visibleLabels.map((label, index) => ({
    label,
    x: 105 + index * (530 / Math.max(1, visibleLabels.length - 1)),
    y: index % 2 === 0 ? 188 : 312,
  }));

  function renderMesh() {
    return (
      <>
        <path d="M 120 250 C 170 190, 220 310, 270 250 C 320 190, 370 310, 420 250 C 470 190, 520 310, 620 250" className="wave-line" />
        {meshPositions.map((node, index) => (
          <g key={node.label}>
            <line x1={node.x} y1={node.y} x2={node.x} y2="250" className="wave-coupler" />
            {index > 0 && index % 4 !== 0 && (
              <line x1={meshPositions[index - 1].x} y1={node.y} x2={node.x} y2={node.y} className="wave-coupler faint" />
            )}
            <Pad label={node.label} x={node.x} y={node.y} compact />
          </g>
        ))}
      </>
    );
  }

  function renderStar() {
    return (
      <>
        <Pad label={visibleLabels[0] ?? "Q1"} x={370} y={250} />
        {starPositions.map((node) => (
          <g key={node.label}>
            <path d={`M 370 250 C ${(370 + node.x) / 2} ${250}, ${(370 + node.x) / 2} ${node.y}, ${node.x} ${node.y}`} className="wave-coupler" />
            <Pad label={node.label} x={node.x} y={node.y} compact />
          </g>
        ))}
        <circle cx="370" cy="250" r="92" className="wave-ring-bus" />
      </>
    );
  }

  function renderRing() {
    return (
      <>
        <ellipse cx="370" cy="250" rx="230" ry="165" className="wave-ring-bus" />
        <ellipse cx="370" cy="250" rx="160" ry="105" className="wave-ring-bus inner" />
        {ringPositions.map((node, index) => {
          const next = ringPositions[(index + 1) % ringPositions.length];
          return (
            <g key={node.label}>
              <path d={`M ${node.x} ${node.y} C ${(node.x + next.x) / 2} ${node.y}, ${(node.x + next.x) / 2} ${next.y}, ${next.x} ${next.y}`} className="wave-coupler faint" />
              <Pad label={node.label} x={node.x} y={node.y} compact />
            </g>
          );
        })}
      </>
    );
  }

  function renderLinear() {
    return (
      <>
        <path d="M 90 250 C 150 205, 210 295, 270 250 C 330 205, 390 295, 450 250 C 510 205, 570 295, 650 250" className="wave-line" />
        {linearPositions.map((node, index) => (
          <g key={node.label}>
            <line x1={node.x} y1={node.y} x2={node.x} y2="250" className="wave-coupler" />
            {index > 0 && <line x1={linearPositions[index - 1].x} y1="250" x2={node.x} y2="250" className="wave-coupler faint" />}
            <Pad label={node.label} x={node.x} y={node.y} compact />
          </g>
        ))}
      </>
    );
  }

  return (
    <svg className="wave-canvas" viewBox="0 0 740 500" role="img" aria-label="Qiskit Metal wave resonator layout">
      <defs>
        <filter id="padShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#506070" floodOpacity="0.26" />
        </filter>
        <linearGradient id="padFill" x1="0" x2="1">
          <stop offset="0%" stopColor="#b8c8d2" />
          <stop offset="100%" stopColor="#dfe7eb" />
        </linearGradient>
      </defs>

      <rect x="30" y="24" width="680" height="430" rx="8" fill="#f7f7f4" stroke="#cfd7dc" />
      <g className="axis-grid">
        {Array.from({ length: 7 }).map((_, index) => (
          <line key={`x-${index}`} x1={90 + index * 90} y1="64" x2={90 + index * 90} y2="416" />
        ))}
        {Array.from({ length: 5 }).map((_, index) => (
          <line key={`y-${index}`} x1="80" y1={90 + index * 70} x2="660" y2={90 + index * 70} />
        ))}
      </g>

      {topology === "star" && renderStar()}
      {topology === "ring" && renderRing()}
      {topology === "linear" && renderLinear()}
      {topology === "mesh" && renderMesh()}

      <text x="48" y="444" className="wave-axis-label">Qiskit Metal resonator preview</text>
      <text x="598" y="444" className="wave-axis-label">{design.topology} coupling</text>
    </svg>
  );
}

function OutputCard({ title, subtitle, children }) {
  return (
    <div className="output-card">
      <div className="output-card-header">
        <span>{title}</span>
        <strong>{subtitle}</strong>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, icon }) {
  return (
    <div className="metric-card">
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function RequirementsPanel({ result, selectedDesign }) {
  if (!result?.requirements) return null;

  return (
    <div className="requirements-panel">
      <div className="block-title">User Requirements Output</div>
      <div className="requirements-grid">
        <div>
          <span>Prompt</span>
          <strong>{result.prompt}</strong>
        </div>
        <div>
          <span>Qubits</span>
          <strong>{result.requirements.qubits}</strong>
        </div>
        <div>
          <span>Requested topology</span>
          <strong>{result.requirements.requestedTopology}</strong>
        </div>
        <div>
          <span>Readout</span>
          <strong>{result.requirements.readout}</strong>
        </div>
        <div>
          <span>Generated variants</span>
          <strong>{result.designs.length}</strong>
        </div>
        <div>
          <span>Recommended output</span>
          <strong>{selectedDesign?.name ?? "Pending"}</strong>
        </div>
      </div>
      <div className="constraint-row">
        {result.requirements.constraints.map((constraint) => (
          <span key={constraint}>{constraint}</span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState(starterPrompt);
  const [requirements, setRequirements] = useState({
    description: "5-qubit transmon processor with nearest-neighbor coupling for gate fidelity above 99.5%",
    qubits: 5,
    connectivity: "2D Grid",
    qubitFamily: "transmon",
    substrate: "Sapphire (Al2O3)",
    coupling: "Capacitive",
    chipSize: "10 x 10",
    frequency: 5.5,
  });
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Tell me the number of qubits, topology, resonator/readout preference, and constraints. I will generate the chip architecture on the right.",
    },
  ]);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const selectedDesign = useMemo(() => {
    if (!result?.designs?.length) return null;
    return result.designs.find((design) => design.id === selectedId) ?? result.designs[0];
  }, [result, selectedId]);

  const chartData = useMemo(() => {
    if (!result?.designs) return [];
    return result.designs.map((design) => ({
      name: design.name.replace(" Topology", ""),
      Efficiency: design.metrics.efficiency,
      Complexity: design.metrics.complexity,
      Scalability: design.metrics.scalability,
    }));
  }, [result]);

  function buildPromptFromRequirements(nextRequirements = requirements) {
    const topology = nextRequirements.connectivity === "2D Grid" ? "mesh" : "ring";
    return `Create a superconducting quantum chip with ${nextRequirements.qubits} qubits using ${nextRequirements.qubitFamily} qubits, ${topology} topology, ${nextRequirements.coupling.toLowerCase()} coupling, ${nextRequirements.substrate} substrate, ${nextRequirements.chipSize} mm chip size, target frequency ${nextRequirements.frequency} GHz. Requirement: ${nextRequirements.description}`;
  }

  function updateRequirement(key, value) {
    setRequirements((current) => {
      const next = { ...current, [key]: value };
      setPrompt(buildPromptFromRequirements(next));
      return next;
    });
  }

  async function generateDesign(nextPrompt = prompt) {
    const cleanPrompt = nextPrompt.trim();
    if (!cleanPrompt) return;

    setPrompt(cleanPrompt);
    setMessages((current) => [...current, { role: "user", text: cleanPrompt }]);
    setLoading(true);
    setStatus("");

    try {
      const response = await axios.post(`${API_URL}/generate`, { prompt: cleanPrompt });
      setResult(response.data);
      setSelectedId(response.data.recommendedId);
      const best = response.data.designs.find((design) => design.id === response.data.recommendedId);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `I extracted ${response.data.requirements?.qubits ?? best?.qubits ?? "--"} qubits, ${response.data.requirements?.requestedTopology ?? best?.topology ?? "auto"} topology intent, and generated ${response.data.designs.length} output design option(s). Best match: ${best?.name ?? "recommended topology"} with ${best?.metrics.efficiency ?? "--"}% efficiency.`,
        },
      ]);
      setStatus("Connected to FastAPI backend.");
    } catch (requestError) {
      const fallback = localFallbackGenerate(cleanPrompt);
      setResult(fallback);
      setSelectedId(fallback.recommendedId);
      const best = fallback.designs.find((design) => design.id === fallback.recommendedId);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: `I extracted ${fallback.requirements.qubits} qubits, ${fallback.requirements.requestedTopology} topology intent, and ${fallback.requirements.readout.toLowerCase()}. I recommended ${best?.name} because it scores ${best?.metrics.efficiency}% efficiency.`,
        },
      ]);
      setStatus("Backend is not running, so this preview used the built-in local generator.");
    } finally {
      setLoading(false);
    }
  }

  function downloadJson() {
    if (!selectedDesign) return;
    const blob = new Blob([JSON.stringify(selectedDesign, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedDesign.id}-design.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <section className="control-panel">
        <div className="brand-row">
          <div className="brand-mark">
            <Bot size={24} />
          </div>
          <div>
            <h1>Quantum Chip Copilot</h1>
            <p>Chat-driven Qiskit Metal architecture designer.</p>
          </div>
        </div>

        <div className="requirements-form">
          <div className="form-kicker">
            <Box size={14} />
            Chip Requirements
          </div>

          <label className="field-label" htmlFor="natural-language">
            Natural Language Description
          </label>
          <textarea
            id="natural-language"
            className="dark-textarea"
            value={requirements.description}
            onChange={(event) => updateRequirement("description", event.target.value)}
          />

          <div className="two-col">
            <div>
              <label className="field-label" htmlFor="qubit-count">
                Number of Qubits
              </label>
              <div className="slider-row">
                <input
                  id="qubit-count"
                  type="range"
                  min="2"
                  max="12"
                  value={requirements.qubits}
                  onChange={(event) => updateRequirement("qubits", Number(event.target.value))}
                />
                <strong>{requirements.qubits}</strong>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="connectivity">
                Connectivity
              </label>
              <select
                id="connectivity"
                className="dark-select"
                value={requirements.connectivity}
                onChange={(event) => updateRequirement("connectivity", event.target.value)}
              >
                <option>2D Grid</option>
                <option>Nearest Neighbor</option>
                <option>Ring Bus</option>
              </select>
            </div>
          </div>

          <label className="field-label">Qubit Topology</label>
          <div className="qubit-card-grid">
            {qubitFamilies.map((family) => {
              const Icon = family.icon;
              return (
                <button
                  key={family.id}
                  type="button"
                  className={requirements.qubitFamily === family.id ? "qubit-choice active" : "qubit-choice"}
                  onClick={() => updateRequirement("qubitFamily", family.id)}
                >
                  <Icon size={22} />
                  <span>{family.label}</span>
                </button>
              );
            })}
          </div>

          <div className="two-col">
            <div>
              <label className="field-label" htmlFor="substrate">
                Substrate
              </label>
              <select
                id="substrate"
                className="dark-select"
                value={requirements.substrate}
                onChange={(event) => updateRequirement("substrate", event.target.value)}
              >
                <option>Sapphire (Al2O3)</option>
                <option>Silicon</option>
                <option>High-resistivity Si</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="coupling">
                Coupling Type
              </label>
              <select
                id="coupling"
                className="dark-select"
                value={requirements.coupling}
                onChange={(event) => updateRequirement("coupling", event.target.value)}
              >
                <option>Capacitive</option>
                <option>Inductive</option>
                <option>Resonator Bus</option>
              </select>
            </div>
          </div>

          <div className="two-col">
            <div>
              <label className="field-label" htmlFor="chip-size">
                Chip Size (mm)
              </label>
              <select
                id="chip-size"
                className="dark-select"
                value={requirements.chipSize}
                onChange={(event) => updateRequirement("chipSize", event.target.value)}
              >
                <option>10 x 10</option>
                <option>12 x 12</option>
                <option>15 x 15</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="frequency">
                Target Frequency (GHz)
              </label>
              <div className="slider-row">
                <input
                  id="frequency"
                  type="range"
                  min="4"
                  max="7"
                  step="0.1"
                  value={requirements.frequency}
                  onChange={(event) => updateRequirement("frequency", Number(event.target.value))}
                />
                <strong>{requirements.frequency}</strong>
              </div>
            </div>
          </div>

          <button className="requirements-generate" type="button" onClick={() => generateDesign(buildPromptFromRequirements())}>
            <Sparkles size={18} />
            Generate From Requirements
          </button>
        </div>

        <div className="chat-window" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
              <div className="avatar">{message.role === "assistant" ? <Bot size={16} /> : <UserRound size={16} />}</div>
              <p>{message.text}</p>
            </div>
          ))}
          {loading && (
            <div className="chat-message assistant">
              <div className="avatar">
                <Activity className="spin" size={16} />
              </div>
              <p>Parsing prompt, synthesizing topology graph, and preparing Qiskit Metal starter code...</p>
            </div>
          )}
        </div>

        <div className="quick-prompts">
          {quickPrompts.map((item) => (
            <button key={item} type="button" onClick={() => setPrompt(item)}>
              {item}
            </button>
          ))}
        </div>

        <label className="prompt-label" htmlFor="prompt">
          Message
        </label>
        <div className="composer">
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                generateDesign();
              }
            }}
            placeholder="Example: Create 6 qubit mesh topology with shared resonator..."
          />
          <button className="send-button" onClick={() => generateDesign()} disabled={loading} title="Generate design">
            {loading ? <Activity className="spin" size={18} /> : <Send size={18} />}
          </button>
        </div>

        <button className="primary-button" onClick={() => generateDesign()} disabled={loading}>
          {loading ? <Activity className="spin" size={18} /> : <Play size={18} />}
          {loading ? "Generating" : "Generate Design"}
        </button>

        {status && <div className="status-box">{status}</div>}

        {result?.designs?.length > 0 && (
          <>
            <div className="panel-block">
              <div className="block-title">
                <GitCompare size={18} />
                Design Variations
              </div>
              <div className="topology-list">
                {result.designs.map((design) => (
                  <button
                    key={design.id}
                    className={design.id === selectedDesign?.id ? "topology-item active" : "topology-item"}
                    onClick={() => setSelectedId(design.id)}
                  >
                    <span>{design.name}</span>
                    <strong>{design.metrics.efficiency}%</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-block">
              <div className="block-title">
                <Sparkles size={18} />
                Recommendation
              </div>
              <p className="recommendation">{selectedDesign?.reason}</p>
            </div>

            <button className="secondary-button" onClick={downloadJson}>
              <Download size={18} />
              Export JSON
            </button>
          </>
        )}
      </section>

      <section className="output-panel">
        <div className="output-header">
          <div>
            <span className="eyebrow">Generated Layout</span>
            <h2>{selectedDesign ? selectedDesign.name : "Waiting for prompt"}</h2>
          </div>
          {selectedDesign && selectedDesign.id === result?.recommendedId && <span className="badge">Recommended</span>}
        </div>

        <div className="output-comparison">
          <OutputCard title="Output 1" subtitle="Architecture topology graph">
            <ChipCanvas design={selectedDesign} />
          </OutputCard>
          <OutputCard title="Output 2" subtitle="Qiskit Metal wave layout">
            <MetalWaveCanvas design={selectedDesign} />
          </OutputCard>
        </div>

        {selectedDesign && (
          <div className="dashboard-grid">
            <RequirementsPanel result={result} selectedDesign={selectedDesign} />

            <div className="metrics-grid">
              <MetricCard label="Qubits" value={selectedDesign.qubits} icon={<Cpu size={20} />} />
              <MetricCard label="Edges" value={selectedDesign.edges.length} icon={<GitCompare size={20} />} />
              <MetricCard label="Efficiency" value={`${selectedDesign.metrics.efficiency}%`} icon={<Sparkles size={20} />} />
              <MetricCard label="Density" value={selectedDesign.metrics.routingDensity} icon={<Activity size={20} />} />
            </div>

            <div className="chart-panel">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6dee6" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Efficiency" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Complexity" fill="#b45309" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Scalability" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="code-panel">
              <div className="block-title">Generated Qiskit Metal Starter Code</div>
              <pre>{selectedDesign.qiskitMetalCode}</pre>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
