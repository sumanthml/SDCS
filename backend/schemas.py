from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class OperationSchema(BaseModel):
    step_number: int
    machine_id: str  # machine_code or UUID
    machine_name: str
    duration_mins: float = Field(gt=0)


class JobSchema(BaseModel):
    job_id: str
    job_name: str
    priority: int = Field(default=1, ge=1, le=5)
    arrival_time: float = 0.0
    due_date: Optional[float] = None
    operations: List[OperationSchema]


class MachineSchema(BaseModel):
    machine_id: str
    machine_code: str
    name: str
    status: str = "Active"
    shift_hours: float = 8.0


class DowntimeEvent(BaseModel):
    machine_id: str
    start_time: float
    end_time: float


class EmergencyJob(BaseModel):
    job: JobSchema
    insert_at_time: float = 0.0


class SimulationRequest(BaseModel):
    machines: List[MachineSchema]
    jobs: List[JobSchema]
    algorithms: List[str] = Field(
        default=["FCFS", "SPT", "Priority", "CP-SAT"]
    )
    downtime_events: Optional[List[DowntimeEvent]] = []
    emergency_jobs: Optional[List[EmergencyJob]] = []


class TaskLog(BaseModel):
    job_id: str
    job_name: str
    machine_id: str
    machine_name: str
    step_number: int
    start_time: float
    end_time: float
    duration: float
    is_emergency: bool = False


class MachineMetrics(BaseModel):
    machine_id: str
    machine_name: str
    total_busy_time: float
    idle_time: float
    utilization_pct: float
    queue_length: int


class AlgorithmResult(BaseModel):
    algorithm: str
    makespan: float
    avg_flow_time: float
    avg_tardiness: float
    total_idle_time: float
    machine_metrics: List[MachineMetrics]
    schedule: List[TaskLog]
    bottleneck_machine: Optional[str] = None
    solver_status: Optional[str] = None  # For CP-SAT


class SimulationResponse(BaseModel):
    results: Dict[str, AlgorithmResult]
    best_algorithm: str
    summary: str


class AIAnalysisRequest(BaseModel):
    simulation_results: Dict[str, Any]
    best_algorithm: str
    user_context: Optional[str] = None


class AIAnalysisResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    analysis: str
    recommendations: List[str]
    bottleneck_advice: str
    model_used: str
