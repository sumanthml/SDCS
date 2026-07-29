"""
ai_analyst.py — Groq LLM-powered schedule analysis advisor.
Uses llama-3.3-70b-versatile for fast, intelligent recommendations.
"""
import os
import httpx
from typing import Dict, Any, List

from schemas import AIAnalysisRequest, AIAnalysisResponse

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


def _build_prompt(req: AIAnalysisRequest) -> str:
    results = req.simulation_results
    best = req.best_algorithm

    lines = [
        "You are an expert manufacturing operations research engineer and shop-floor scheduling consultant.",
        "Analyze the following simulation results from a job-shop scheduling optimization system.",
        "",
        f"BEST PERFORMING ALGORITHM: {best}",
        "",
        "=== ALGORITHM COMPARISON RESULTS ===",
    ]

    for algo, data in results.items():
        lines.append(f"\n▶ {algo}:")
        lines.append(f"  • Makespan: {data.get('makespan', 'N/A')} minutes")
        lines.append(f"  • Avg Flow Time: {data.get('avg_flow_time', 'N/A')} minutes")
        lines.append(f"  • Total Idle Time: {data.get('total_idle_time', 'N/A')} minutes")
        lines.append(f"  • Avg Tardiness: {data.get('avg_tardiness', 'N/A')} minutes")
        lines.append(f"  • Bottleneck Machine: {data.get('bottleneck_machine', 'N/A')}")

        metrics = data.get("machine_metrics", [])
        if metrics:
            lines.append("  • Machine Utilization:")
            for m in metrics:
                lines.append(f"    - {m.get('machine_name', '?')}: {m.get('utilization_pct', 0):.1f}% utilization, {m.get('idle_time', 0):.1f} min idle")

    if req.user_context:
        lines.append(f"\nOPERATOR CONTEXT: {req.user_context}")

    lines.append("""
=== YOUR TASK ===
Provide a structured analysis with:
1. A 2-3 sentence executive summary comparing all algorithms.
2. Specific bottleneck analysis: WHY is the identified machine a bottleneck, and what can be done.
3. Three concrete, actionable recommendations to reduce makespan or idle time.
4. Which algorithm to use for THIS specific job mix and WHY.

Be precise, concise, and use manufacturing operations terminology.
Format your response in clear sections with headers.
""")

    return "\n".join(lines)


async def analyze_schedule(req: AIAnalysisRequest) -> AIAnalysisResponse:
    """Call Groq API and parse the structured response."""
    if not GROQ_API_KEY:
        return AIAnalysisResponse(
            analysis="Groq API key not configured. Please set GROQ_API_KEY in backend .env file.",
            recommendations=["Configure GROQ_API_KEY to enable AI analysis."],
            bottleneck_advice="AI analysis unavailable without API key.",
            model_used="none",
        )

    prompt = _build_prompt(req)

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a world-class manufacturing operations research engineer. Be precise and technical.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1200,
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(GROQ_API_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

        # Extract recommendations as bullet points from the content
        recs: List[str] = []
        for line in content.split("\n"):
            stripped = line.strip()
            if stripped.startswith(("1.", "2.", "3.", "•", "-", "→", "✓")):
                clean = stripped.lstrip("123.•-→✓ ").strip()
                if len(clean) > 10:
                    recs.append(clean)

        # Find bottleneck advice section
        bottleneck_section = ""
        lines = content.split("\n")
        in_bn = False
        bn_lines = []
        for line in lines:
            if "bottleneck" in line.lower():
                in_bn = True
            if in_bn:
                bn_lines.append(line)
                if len(bn_lines) > 5:
                    break
        bottleneck_section = " ".join(bn_lines).strip()[:500] if bn_lines else "See full analysis above."

        return AIAnalysisResponse(
            analysis=content,
            recommendations=recs[:6] if recs else ["Review the full analysis above for recommendations."],
            bottleneck_advice=bottleneck_section,
            model_used=MODEL,
        )

    except httpx.HTTPStatusError as e:
        return AIAnalysisResponse(
            analysis=f"Groq API error: {e.response.status_code} — {e.response.text}",
            recommendations=["Check your GROQ_API_KEY and try again."],
            bottleneck_advice="API error prevented bottleneck analysis.",
            model_used=MODEL,
        )
    except Exception as e:
        return AIAnalysisResponse(
            analysis=f"Unexpected error calling Groq API: {str(e)}",
            recommendations=["Check backend logs for details."],
            bottleneck_advice="Error during AI analysis.",
            model_used=MODEL,
        )
