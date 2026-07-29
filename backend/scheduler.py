"""
scheduler.py — Production-grade job-shop scheduling engine.
Implements: FCFS, SPT, Priority Dispatching, CP-SAT (Google OR-Tools).
Uses a deterministic timeline-based approach (no SimPy resource priority bugs).
"""
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from ortools.sat.python import cp_model
import os

from schemas import (
    JobSchema, MachineSchema,
    DowntimeEvent, EmergencyJob, TaskLog,
    MachineMetrics, AlgorithmResult
)

CP_SAT_TIME_LIMIT = float(os.getenv("CP_SAT_TIME_LIMIT", "15"))


# ─────────────────────────────────────────────────────────────
#  Utility helpers
# ─────────────────────────────────────────────────────────────

def _build_downtime_map(downtime_events: List[DowntimeEvent]) -> Dict[str, List[Tuple[float, float]]]:
    dmap: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
    for evt in downtime_events:
        dmap[evt.machine_id].append((float(evt.start_time), float(evt.end_time)))
    for k in dmap:
        dmap[k].sort()
    return dmap


def _next_available(start: float, duration: float, downtime_intervals: List[Tuple[float, float]]) -> Tuple[float, float]:
    """Slide start forward to avoid all downtime overlaps."""
    end = start + duration
    changed = True
    while changed:
        changed = False
        for ds, de in downtime_intervals:
            if start < de and end > ds:
                start = de
                end = start + duration
                changed = True
    return start, end


def _compute_metrics(
    schedule: List[TaskLog],
    all_jobs: List[JobSchema],
    machines: List[MachineSchema],
    makespan: float,
) -> Tuple[float, float, List[MachineMetrics], Optional[str]]:
    job_arrival = {j.job_id: j.arrival_time for j in all_jobs}
    job_end: Dict[str, float] = {}

    for task in schedule:
        jid = task.job_id
        if jid not in job_end or task.end_time > job_end[jid]:
            job_end[jid] = task.end_time

    flow_times = [job_end[jid] - job_arrival.get(jid, 0.0) for jid in job_end]
    avg_flow_time = sum(flow_times) / len(flow_times) if flow_times else 0.0

    machine_busy: Dict[str, float] = defaultdict(float)
    machine_jobs: Dict[str, int] = defaultdict(int)

    for task in schedule:
        machine_busy[task.machine_id] += task.duration
        machine_jobs[task.machine_id] += 1

    metrics: List[MachineMetrics] = []
    total_idle = 0.0
    bottleneck: Optional[str] = None
    max_util = -1.0

    for m in machines:
        busy = machine_busy.get(m.machine_id, 0.0)
        idle = max(0.0, makespan - busy)
        util = round((busy / makespan * 100) if makespan > 0 else 0.0, 2)
        total_idle += idle
        if util > max_util:
            max_util = util
            bottleneck = m.name
        metrics.append(MachineMetrics(
            machine_id=m.machine_id,
            machine_name=m.name,
            total_busy_time=round(busy, 2),
            idle_time=round(idle, 2),
            utilization_pct=util,
            queue_length=machine_jobs.get(m.machine_id, 0),
        ))

    return round(avg_flow_time, 2), round(total_idle, 2), metrics, bottleneck


def _avg_tardiness(schedule: List[TaskLog], all_jobs: List[JobSchema]) -> float:
    due_map = {j.job_id: j.due_date for j in all_jobs if j.due_date}
    job_end: Dict[str, float] = {}
    for task in schedule:
        jid = task.job_id
        if jid not in job_end or task.end_time > job_end[jid]:
            job_end[jid] = task.end_time
    vals = [max(0.0, job_end[jid] - due_map[jid]) for jid in job_end if jid in due_map]
    return round(sum(vals) / len(vals), 2) if vals else 0.0


# ─────────────────────────────────────────────────────────────
#  Deterministic Timeline-Based DES (no SimPy resource bugs)
# ─────────────────────────────────────────────────────────────

def _run_timeline(
    jobs: List[JobSchema],
    machines: List[MachineSchema],
    sort_fn,           # fn(job, op) -> sort key (lower = higher priority)
    downtime_map: Dict[str, List[Tuple[float, float]]],
    is_emergency_fn=None,
) -> Tuple[List[TaskLog], float]:
    """
    Deterministic timeline scheduler:
    - Tracks machine free time
    - Schedules each job step as soon as its predecessor finishes AND the machine is free
    - Avoids all downtime windows
    - Handles arbitrary arrival times
    """
    # machine_free[machine_id] = earliest time machine is available
    machine_free: Dict[str, float] = {m.machine_id: 0.0 for m in machines}
    # job_ready[job_id] = time the job's current step can start (after previous step done)
    job_ready: Dict[str, float] = {j.job_id: j.arrival_time for j in jobs}

    schedule: List[TaskLog] = []

    # Build all operations as flat list: (sort_key, job, op, is_emergency)
    all_ops = []
    for job in jobs:
        is_emg = is_emergency_fn(job) if is_emergency_fn else False
        for op in sorted(job.operations, key=lambda o: o.step_number):
            key = sort_fn(job, op)
            all_ops.append((key, job.arrival_time, job.job_id, op.step_number))

    # Process step by step: each pass we find and schedule all ready-to-run step 1s,
    # then step 2s, etc. — maintaining dependency order per job.
    # We do this via repeated passes until all ops are scheduled.

    scheduled_keys = set()   # (job_id, step_number) that are done
    job_step_end: Dict[str, float] = {j.job_id: j.arrival_time for j in jobs}  # completion of last scheduled step
    max_steps = max((len(j.operations) for j in jobs), default=0)

    for step_pass in range(1, max_steps + 1):
        # Collect all ops at this step_number across jobs, sorted by priority key
        step_ops = []
        for job in jobs:
            ops = sorted(job.operations, key=lambda o: o.step_number)
            if step_pass - 1 < len(ops):
                op = ops[step_pass - 1]
                if (job.job_id, op.step_number) not in scheduled_keys:
                    sk = sort_fn(job, op)
                    step_ops.append((sk, job.arrival_time, id(job), job, op))

        step_ops.sort(key=lambda x: (x[0], x[1]))  # sort by priority then arrival

        for _, _, _, job, op in step_ops:
            mid = op.machine_id
            # earliest we can start this op
            earliest = max(
                job_step_end[job.job_id],   # previous step must be done
                machine_free.get(mid, 0.0), # machine must be free
            )
            actual_start, actual_end = _next_available(earliest, op.duration_mins, downtime_map.get(mid, []))

            machine_free[mid] = actual_end
            job_step_end[job.job_id] = actual_end
            scheduled_keys.add((job.job_id, op.step_number))

            is_emg = is_emergency_fn(job) if is_emergency_fn else False
            schedule.append(TaskLog(
                job_id=job.job_id,
                job_name=job.job_name,
                machine_id=mid,
                machine_name=op.machine_name,
                step_number=op.step_number,
                start_time=round(actual_start, 2),
                end_time=round(actual_end, 2),
                duration=round(op.duration_mins, 2),
                is_emergency=is_emg,
            ))

    makespan = max((t.end_time for t in schedule), default=0.0)
    return schedule, round(makespan, 2)


# ─────────────────────────────────────────────────────────────
#  Algorithm Implementations
# ─────────────────────────────────────────────────────────────

def run_fcfs(jobs, machines, downtime_map):
    """FCFS: sort by arrival time, then job_id for tie-breaking."""
    sorted_jobs = sorted(jobs, key=lambda j: (j.arrival_time, j.job_id))
    return _run_timeline(sorted_jobs, machines, lambda job, op: job.arrival_time, downtime_map)


def run_spt(jobs, machines, downtime_map):
    """SPT: shortest operation duration first."""
    return _run_timeline(jobs, machines, lambda job, op: op.duration_mins, downtime_map)


def run_priority(jobs, machines, downtime_map):
    """Priority: higher priority number = scheduled earlier (negate for sort)."""
    return _run_timeline(jobs, machines, lambda job, op: -job.priority, downtime_map)


# ─────────────────────────────────────────────────────────────
#  CP-SAT Constraint Solver (Google OR-Tools)
# ─────────────────────────────────────────────────────────────

def run_cpsat(
    jobs: List[JobSchema],
    machines: List[MachineSchema],
    downtime_map: Dict[str, List],
    time_limit: float = CP_SAT_TIME_LIMIT,
) -> Tuple[List[TaskLog], float, str]:
    model = cp_model.CpModel()

    total_duration = int(sum(op.duration_mins for j in jobs for op in j.operations))
    horizon = total_duration * 2 + 120  # generous upper bound

    task_vars: Dict = {}       # (job_id, step_num) -> (start, end, interval)
    machine_intervals: Dict[str, List] = defaultdict(list)

    for job in jobs:
        ops = sorted(job.operations, key=lambda o: o.step_number)
        for op in ops:
            dur = max(1, int(round(op.duration_mins)))
            sfx = f"_j{job.job_id[:8]}_s{op.step_number}"
            s = model.NewIntVar(0, horizon, f"s{sfx}")
            e = model.NewIntVar(0, horizon, f"e{sfx}")
            iv = model.NewIntervalVar(s, dur, e, f"iv{sfx}")
            task_vars[(job.job_id, op.step_number)] = (s, e, iv)
            machine_intervals[op.machine_id].append(iv)
            # Arrival time constraint
            model.Add(s >= int(max(0, job.arrival_time)))

    # Precedence: each step must come after the previous
    for job in jobs:
        ops = sorted(job.operations, key=lambda o: o.step_number)
        for i in range(1, len(ops)):
            prev_e = task_vars[(job.job_id, ops[i-1].step_number)][1]
            curr_s = task_vars[(job.job_id, ops[i].step_number)][0]
            model.Add(curr_s >= prev_e)

    # No two jobs share the same machine at the same time
    for mid, ivs in machine_intervals.items():
        if len(ivs) > 1:
            model.AddNoOverlap(ivs)

    # Minimize makespan
    makespan_var = model.NewIntVar(0, horizon, "makespan")
    all_ends = [task_vars[k][1] for k in task_vars]
    model.AddMaxEquality(makespan_var, all_ends)
    model.Minimize(makespan_var)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_search_workers = 2  # safe for free tier
    solver.parameters.log_search_progress = False
    status = solver.Solve(model)
    status_str = solver.StatusName(status)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        sched: List[TaskLog] = []
        for job in jobs:
            for op in job.operations:
                key = (job.job_id, op.step_number)
                sv = float(solver.Value(task_vars[key][0]))
                ev = float(solver.Value(task_vars[key][1]))
                sched.append(TaskLog(
                    job_id=job.job_id,
                    job_name=job.job_name,
                    machine_id=op.machine_id,
                    machine_name=op.machine_name,
                    step_number=op.step_number,
                    start_time=round(sv, 2),
                    end_time=round(ev, 2),
                    duration=round(op.duration_mins, 2),
                ))
        return sched, round(float(solver.Value(makespan_var)), 2), status_str
    else:
        # Fallback to FCFS when CP-SAT cannot find a solution in time
        sched, mkspan = run_fcfs(jobs, machines, downtime_map)
        return sched, mkspan, f"FALLBACK_FCFS ({status_str})"


# ─────────────────────────────────────────────────────────────
#  Master simulation runner
# ─────────────────────────────────────────────────────────────

def run_simulation(
    machines: List[MachineSchema],
    jobs: List[JobSchema],
    algorithms: List[str],
    downtime_events: List[DowntimeEvent],
    emergency_jobs: List[EmergencyJob],
) -> Dict[str, AlgorithmResult]:

    active_machines = [m for m in machines if m.status == "Active"]
    if not active_machines:
        raise ValueError("No active machines available for simulation.")
    if not jobs:
        raise ValueError("No jobs provided for simulation.")

    # Validate all machine references
    machine_ids = {m.machine_id for m in active_machines}
    for job in jobs:
        for op in job.operations:
            if op.machine_id not in machine_ids:
                raise ValueError(
                    f"Job '{job.job_name}' step {op.step_number} references "
                    f"unknown/inactive machine '{op.machine_id}'"
                )

    # Merge emergency jobs
    all_jobs = list(jobs)
    emergency_ids = set()
    for ej in (emergency_jobs or []):
        ej.job.arrival_time = float(ej.insert_at_time)
        all_jobs.append(ej.job)
        emergency_ids.add(ej.job.job_id)

    is_emergency_fn = lambda job: job.job_id in emergency_ids
    downtime_map = _build_downtime_map(downtime_events or [])

    algo_map = {
        "FCFS":     run_fcfs,
        "SPT":      run_spt,
        "Priority": run_priority,
    }

    results: Dict[str, AlgorithmResult] = {}

    for algo in algorithms:
        try:
            if algo == "CP-SAT":
                schedule, makespan, solver_status = run_cpsat(all_jobs, active_machines, downtime_map)
            elif algo in algo_map:
                schedule, makespan = algo_map[algo](all_jobs, active_machines, downtime_map)
                solver_status = None
            else:
                continue

            avg_flow, total_idle, mach_metrics, bottleneck = _compute_metrics(
                schedule, all_jobs, active_machines, makespan
            )
            tardiness = _avg_tardiness(schedule, all_jobs)

            results[algo] = AlgorithmResult(
                algorithm=algo,
                makespan=makespan,
                avg_flow_time=avg_flow,
                avg_tardiness=tardiness,
                total_idle_time=round(total_idle, 2),
                machine_metrics=mach_metrics,
                schedule=schedule,
                bottleneck_machine=bottleneck,
                solver_status=solver_status,
            )
        except Exception as e:
            # Don't let one algorithm failure kill all results
            import traceback
            print(f"[WARN] Algorithm {algo} failed: {e}\n{traceback.format_exc()}")

    return results
