import math
import re
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


Topology = Literal["ring", "star", "mesh", "linear"]


app = FastAPI(title="Quantum Chip AI Designer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PromptRequest(BaseModel):
    prompt: str


def extract_qubit_count(prompt: str) -> int:
    match = re.search(r"(\d+)\s*(qubit|qubits|qbit|qbits|core|cores)", prompt)
    if match:
        return max(2, min(int(match.group(1)), 16))
    return 4


def extract_requested_topology(prompt: str) -> Topology | None:
    for topology in ["ring", "star", "mesh", "linear"]:
        if topology in prompt:
            return topology  # type: ignore[return-value]
    return None


def extract_requirements(prompt: str) -> dict:
    topology = extract_requested_topology(prompt)
    constraints = []

    if "low" in prompt:
        constraints.append("Low complexity")
    if "scalable" in prompt or "scale" in prompt:
        constraints.append("Scalable architecture")
    if "dense" in prompt or "density" in prompt:
        constraints.append("Routing density aware")
    if "compare" in prompt or "variation" in prompt:
        constraints.append("Compare multiple designs")
    if not constraints:
        constraints.append("Balanced architecture")

    return {
        "qubits": extract_qubit_count(prompt),
        "requestedTopology": topology.title() if topology else "Auto compare",
        "readout": "Shared resonator/readout requested"
        if any(term in prompt for term in ["resonator", "readout", "shared"])
        else "Dedicated readout not specified",
        "constraints": constraints,
        "intent": "Generate superconducting quantum chip architecture from natural language",
    }


def build_nodes(qubits: int, shared_resonator: bool) -> list[dict]:
    nodes = [
        {
            "id": f"Q{i + 1}",
            "label": f"Q{i + 1}",
            "type": "qubit",
            "role": "Transmon qubit",
        }
        for i in range(qubits)
    ]

    if shared_resonator:
        nodes.append(
            {
                "id": "R1",
                "label": "R1",
                "type": "resonator",
                "role": "Shared readout resonator",
            }
        )

    return nodes


def build_edges(topology: Topology, qubits: int, shared_resonator: bool) -> list[dict]:
    edges: list[dict] = []

    if topology == "ring":
        for i in range(qubits):
            edges.append({"source": f"Q{i + 1}", "target": f"Q{((i + 1) % qubits) + 1}", "type": "coupler"})

    if topology == "star":
        for i in range(2, qubits + 1):
            edges.append({"source": "Q1", "target": f"Q{i}", "type": "coupler"})

    if topology == "mesh":
        cols = math.ceil(math.sqrt(qubits))
        for i in range(qubits):
            row, col = divmod(i, cols)
            right = i + 1
            down = i + cols
            if col < cols - 1 and right < qubits:
                edges.append({"source": f"Q{i + 1}", "target": f"Q{right + 1}", "type": "coupler"})
            if down < qubits:
                edges.append({"source": f"Q{i + 1}", "target": f"Q{down + 1}", "type": "coupler"})

    if topology == "linear":
        for i in range(1, qubits):
            edges.append({"source": f"Q{i}", "target": f"Q{i + 1}", "type": "coupler"})

    if shared_resonator:
        for i in range(1, qubits + 1):
            edges.append({"source": f"Q{i}", "target": "R1", "type": "readout"})

    return edges


def layout_nodes(nodes: list[dict], topology: Topology, qubits: int) -> list[dict]:
    placed = []
    qubit_nodes = [node for node in nodes if node["type"] == "qubit"]

    if topology == "mesh":
        cols = math.ceil(math.sqrt(qubits))
        spacing = 150
        for index, node in enumerate(qubit_nodes):
            row, col = divmod(index, cols)
            placed.append({**node, "x": 140 + col * spacing, "y": 100 + row * spacing})
    elif topology == "linear":
        for index, node in enumerate(qubit_nodes):
            placed.append({**node, "x": 100 + index * 140, "y": 210})
    elif topology == "star":
        placed.append({**qubit_nodes[0], "x": 350, "y": 210})
        radius = 170
        for index, node in enumerate(qubit_nodes[1:]):
            angle = (2 * math.pi * index) / max(1, qubits - 1)
            placed.append({**node, "x": 350 + radius * math.cos(angle), "y": 210 + radius * math.sin(angle)})
    else:
        radius = 180
        for index, node in enumerate(qubit_nodes):
            angle = (2 * math.pi * index) / qubits
            placed.append({**node, "x": 350 + radius * math.cos(angle), "y": 220 + radius * math.sin(angle)})

    resonator = next((node for node in nodes if node["type"] == "resonator"), None)
    if resonator:
        placed.append({**resonator, "x": 350, "y": 430})

    return placed


def score_design(topology: Topology, qubits: int, edge_count: int) -> dict:
    density = edge_count / max(1, qubits)
    complexity = min(100, round(density * 18 + qubits * 2))

    topology_bonus = {
        "mesh": 22,
        "ring": 16,
        "star": 10,
        "linear": 6,
    }[topology]

    scalability = min(100, 50 + topology_bonus + qubits * 2)
    efficiency = max(30, min(98, round(scalability - complexity * 0.35 + 20)))

    return {
        "complexity": complexity,
        "routingDensity": round(density, 2),
        "scalability": scalability,
        "efficiency": efficiency,
    }


def recommendation_reason(topology: Topology, qubits: int) -> str:
    if topology == "mesh":
        return "Mesh balances local qubit communication and scales well for larger quantum layouts."
    if topology == "ring":
        return "Ring keeps routing compact while giving each qubit two neighbors, which is useful for low-complexity demos."
    if topology == "star":
        return "Star is simple and easy to explain, but the center qubit can become a communication bottleneck."
    return "Linear is the simplest layout and works well as a baseline architecture."


def generate_qiskit_metal_code(topology: Topology, qubits: int, shared_resonator: bool) -> str:
    positions = []
    for index in range(qubits):
        if topology == "ring":
            angle = (2 * math.pi * index) / qubits
            positions.append((4 * math.cos(angle), 4 * math.sin(angle)))
        elif topology == "mesh":
            cols = math.ceil(math.sqrt(qubits))
            positions.append(((index % cols) * 1.8, (index // cols) * 1.8))
        elif topology == "star":
            if index == 0:
                positions.append((0, 0))
            else:
                angle = (2 * math.pi * (index - 1)) / max(1, qubits - 1)
                positions.append((4 * math.cos(angle), 4 * math.sin(angle)))
        else:
            positions.append((index * 1.2, 0))

    qubit_lines = "\n".join(
        [
            f'Q{index + 1} = TransmonPocket(design, "Q{index + 1}", options=dict(pos_x="{x:.1f}mm", pos_y="{y:.1f}mm"))'
            for index, (x, y) in enumerate(positions)
        ]
    )
    qubit_names = ", ".join([f"Q{index + 1}" for index in range(qubits)])

    return f'''from qiskit_metal import designs
from qiskit_metal.qlibrary.qubits.transmon_pocket import TransmonPocket

design = designs.DesignPlanar()
design.overwrite_enabled = True

# Generated topology: {topology}
# Qubits: {qubits}
# Shared resonator: {shared_resonator}

{qubit_lines}

qubits = [{qubit_names}]

# Next integration step:
# Add RouteMeander / CPW routes using the generated edge list from this API response.
gui = None
'''


def generate_design(prompt: str, topology: Topology) -> dict:
    normalized = prompt.lower()
    qubits = extract_qubit_count(normalized)
    shared_resonator = any(term in normalized for term in ["resonator", "readout", "shared"])
    nodes = build_nodes(qubits, shared_resonator)
    edges = build_edges(topology, qubits, shared_resonator)
    placed_nodes = layout_nodes(nodes, topology, qubits)
    metrics = score_design(topology, qubits, len(edges))

    return {
        "id": f"{topology}-{qubits}",
        "name": f"{topology.title()} Topology",
        "topology": topology,
        "qubits": qubits,
        "nodes": placed_nodes,
        "edges": edges,
        "metrics": metrics,
        "reason": recommendation_reason(topology, qubits),
        "qiskitMetalCode": generate_qiskit_metal_code(topology, qubits, shared_resonator),
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/generate")
def generate(request: PromptRequest) -> dict:
    normalized = request.prompt.lower()
    requested = extract_requested_topology(normalized)
    topologies: list[Topology] = [requested] if requested else ["ring", "mesh", "star"]
    designs = [generate_design(request.prompt, topology) for topology in topologies if topology]
    recommended = max(designs, key=lambda item: item["metrics"]["efficiency"])

    return {
        "prompt": request.prompt,
        "requirements": extract_requirements(normalized),
        "designs": designs,
        "recommendedId": recommended["id"],
        "summary": f"Generated {len(designs)} superconducting quantum chip architecture option(s).",
    }
