# Quantum Chip AI Designer

An MVP application for generating superconducting quantum chip architecture designs from natural language prompts.

The project uses:

- React + Vite for the frontend
- FastAPI for the backend
- Local prompt parsing and topology generation
- Optional Qiskit Metal code generation for credibility and future integration

## Run Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

## Run Frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Demo Prompt

```text
Create a superconducting quantum chip with 6 qubits, shared resonator, low complexity and ring topology.
```

## Fastest Frontend-Only Demo

The UI includes a built-in local generator, so it works even before FastAPI or Qiskit Metal is installed.

```powershell
cd frontend
npm install
npm run build
npm run serve
```

Open:

```text
http://localhost:4173
```

## What The Chatbot Outputs

For every prompt, the app displays:

- the original user requirement
- extracted qubit count
- requested topology or auto-comparison mode
- readout / shared resonator requirement
- detected constraints
- generated design variants
- recommended final topology
- visual chip layout
- metrics and Qiskit Metal starter code

## Direct GitHub Pages Deployment

This repo includes `.github/workflows/deploy.yml`.

After pushing to GitHub:

1. Open the GitHub repository.
2. Go to `Settings` -> `Pages`.
3. Under `Build and deployment`, select `GitHub Actions`.
4. Push to `main` or `master`.
5. GitHub will build `frontend/` and deploy the static app.

The deployed frontend works without FastAPI because it has a built-in local architecture generator.

## Render Backend Deployment

Use these Render settings:

```text
Root Directory: backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

The backend includes `backend/runtime.txt` to force Python 3.11.9. This avoids Python 3.14 dependency build errors with `pydantic-core`.

## Jury Positioning

This is not a quantum simulator. It is an AI-assisted architecture exploration layer for superconducting quantum chip design. It converts natural language into topology graphs, compares multiple architecture variants, scores them, recommends the best option, and prepares Qiskit Metal-style Python code.
