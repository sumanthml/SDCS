# 🏭 ShopFlowAI — Intelligent Smart Manufacturing Job Scheduling Simulator

A cloud-based web application for manufacturing plant managers and shop-floor planners to **simulate, compare, and optimize** job scheduling using discrete-event simulation and constraint programming.

## ✨ Features

- **4 Scheduling Algorithms**: FCFS, SPT, Priority Dispatching, CP-SAT (Google OR-Tools)
- **Interactive SVG Gantt Chart** with zoom, color-coded jobs, and hover tooltips
- **Machine & Job Builder** with drag-and-drop CSV import
- **What-If Disruption Engine** (machine downtime + emergency job insertion)
- **AI Schedule Analyst** powered by Groq Llama 3
- **Supabase Auth** with RBAC (Planner / Manager roles)
- **Firebase Analytics** tracking
- **Export** to CSV and JSON

---

## 🚀 Quick Start

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
# → Opens at http://localhost:5173
```

### Backend (FastAPI)

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → API docs at http://localhost:8000/docs
```

---

## 🗄️ Database Setup (Supabase)

1. Open your Supabase project → SQL Editor
2. Copy & paste the contents of `schema.sql`
3. Click **Run** — all tables, RLS policies, and triggers are created automatically

---

## ☁️ Deployment

### Frontend → Vercel

```bash
# In frontend/
vercel --prod
# Set environment variables in Vercel dashboard
```

Required env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FIREBASE_API_KEY` (and other Firebase vars)
- `VITE_API_BASE_URL` → Your Render backend URL

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo, set root directory to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env var: `GROQ_API_KEY=gsk_...`

---

## 🧮 Architecture

```
Frontend (Vercel)          Backend (Render)
  React + Vite       →      FastAPI + SimPy + OR-Tools
  Supabase Auth      ←      JSON API Responses
  Firebase Analytics        Groq AI Integration

Database: Supabase PostgreSQL (machines, jobs, simulation_runs)
```

---

## 📊 Algorithm Details

| Algorithm | Strategy | Best For |
|-----------|----------|----------|
| FCFS | Arrival time order | Fair queue, low priority diversity |
| SPT | Shortest operation first | Minimizing avg flow time |
| Priority | Job priority (1–5) | Customer-critical orders |
| CP-SAT | Mathematical optimum | Absolute minimum makespan |

---

## 📄 CSV Import Format

### Jobs CSV
```
job_name,priority,arrival_time,due_date,step_number,machine_code,machine_name,duration_mins
Job A,3,0,480,1,M1,CNC Lathe,30
Job A,3,0,480,2,M2,Drill Press,15
```

### Machines CSV
```
machine_code,name,status,shift_hours
M1,CNC Lathe,Active,8
M2,Drill Press,Active,8
```
