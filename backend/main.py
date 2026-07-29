"""
main.py — FastAPI entrypoint (production-hardened).
"""
import os
import io
import csv
import json
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError

from schemas import (
    SimulationRequest, SimulationResponse,
    AIAnalysisRequest, AIAnalysisResponse,
    AlgorithmResult,
)
from scheduler import run_simulation
from ai_analyst import analyze_schedule

# ─── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="ShopFlowAI — Scheduling Engine API",
    description="Discrete-event simulation + CP-SAT optimization for job-shop scheduling",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global exception handlers ────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = " → ".join(str(x) for x in err.get("loc", []))
        errors.append(f"{loc}: {err.get('msg', 'Invalid value')}")
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": errors},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )


# ─── Root & Health ─────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "ok", "message": "ShopFlowAI Scheduling API is running."}


@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "service": "ShopFlowAI Scheduling Engine",
        "algorithms": ["FCFS", "SPT", "Priority", "CP-SAT"],
    }


# ─── Simulate ─────────────────────────────────────────────────
@app.post("/api/simulate", response_model=SimulationResponse, tags=["Simulation"])
def simulate(req: SimulationRequest):
    """Run job-shop scheduling algorithms and return Gantt + metrics."""
    if not req.machines:
        raise HTTPException(400, "Provide at least one machine.")
    if not req.jobs:
        raise HTTPException(400, "Provide at least one job.")
    if not req.algorithms:
        raise HTTPException(400, "Select at least one algorithm.")

    # Validate every op has a machine_id
    for job in req.jobs:
        for op in job.operations:
            if not op.machine_id:
                raise HTTPException(
                    400,
                    f"Job '{job.job_name}' step {op.step_number} has no machine assigned."
                )

    try:
        results = run_simulation(
            machines=req.machines,
            jobs=req.jobs,
            algorithms=req.algorithms,
            downtime_events=req.downtime_events or [],
            emergency_jobs=req.emergency_jobs or [],
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Simulation engine error: {str(e)}")

    if not results:
        raise HTTPException(500, "No algorithm produced results. Check your inputs.")

    best = min(results, key=lambda k: results[k].makespan)
    summary_parts = [f"{a}: {r.makespan}min makespan" for a, r in results.items()]

    return SimulationResponse(
        results=results,
        best_algorithm=best,
        summary=" | ".join(summary_parts),
    )


# ─── AI Analysis ──────────────────────────────────────────────
@app.post("/api/analyze", response_model=AIAnalysisResponse, tags=["AI"])
async def analyze(req: AIAnalysisRequest):
    """Groq LLM-powered schedule analysis."""
    return await analyze_schedule(req)


# ─── CSV Export ───────────────────────────────────────────────
@app.post("/api/export/csv", tags=["Export"])
def export_csv(result: AlgorithmResult):
    """Export a schedule as CSV for shop-floor dispatch."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "job_name", "step_number", "machine_name",
        "start_time", "end_time", "duration", "is_emergency",
    ])
    writer.writeheader()
    # Sort by machine then start_time for natural reading order
    sorted_tasks = sorted(result.schedule, key=lambda t: (t.machine_name, t.start_time))
    for task in sorted_tasks:
        writer.writerow({
            "job_name": task.job_name,
            "step_number": task.step_number,
            "machine_name": task.machine_name,
            "start_time": task.start_time,
            "end_time": task.end_time,
            "duration": task.duration,
            "is_emergency": task.is_emergency,
        })
    output.seek(0)
    filename = f"dispatch_schedule_{result.algorithm}_{int(__import__('time').time())}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── CSV Import ───────────────────────────────────────────────
@app.post("/api/import/csv", tags=["Import"])
async def import_csv(file: UploadFile = File(...)):
    """
    Parse uploaded CSV into jobs.
    Required columns: job_name, step_number, machine_code, machine_name, duration_mins
    Optional columns: priority, arrival_time, due_date
    """
    if not file.filename:
        raise HTTPException(400, "No file provided.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    required_cols = {"job_name", "step_number", "machine_code", "machine_name", "duration_mins"}

    if not reader.fieldnames or not required_cols.issubset(set(reader.fieldnames)):
        missing = required_cols - set(reader.fieldnames or [])
        raise HTTPException(400, f"CSV missing required columns: {', '.join(missing)}")

    jobs_map: dict = {}
    errors: list = []

    for i, row in enumerate(reader, start=2):
        try:
            job_name = row["job_name"].strip()
            if not job_name:
                errors.append(f"Row {i}: empty job_name")
                continue

            if job_name not in jobs_map:
                jobs_map[job_name] = {
                    "job_id": f"imported_{job_name.replace(' ', '_').replace('#', '')}_{i}",
                    "job_name": job_name,
                    "priority": int(row.get("priority", 3) or 3),
                    "arrival_time": float(row.get("arrival_time", 0) or 0),
                    "due_date": float(row["due_date"]) if row.get("due_date") else None,
                    "operations": [],
                }

            duration = float(row["duration_mins"])
            if duration <= 0:
                errors.append(f"Row {i}: duration_mins must be > 0")
                continue

            jobs_map[job_name]["operations"].append({
                "step_number": int(row["step_number"]),
                "machine_id": row["machine_code"].strip(),
                "machine_name": row["machine_name"].strip(),
                "duration_mins": duration,
            })
        except (KeyError, ValueError) as e:
            errors.append(f"Row {i}: {str(e)}")

    # Sort operations by step_number
    for job in jobs_map.values():
        job["operations"].sort(key=lambda op: op["step_number"])

    return {
        "jobs": list(jobs_map.values()),
        "errors": errors,
        "imported_count": len(jobs_map),
        "total_operations": sum(len(j["operations"]) for j in jobs_map.values()),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
