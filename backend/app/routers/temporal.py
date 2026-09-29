"""Temporal Network Anomaly Detection endpoint.

Read-only investigative aid: it summarises how the *existing* case/entity graph
changes across calendar-month periods and reports measurable, explainable
changes (connection increases, new relationships, new entities, bridge
formation, activity bursts). It does not predict criminal activity and never
modifies the graph. All authenticated roles (admin, investigator, analyst) may
read.
"""
import logging
import os
import sys
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.dependencies import get_current_user, require_roles, ANY_AUTH_ROLE
from app.services import temporal_service
from app.services.database import db_service

logger = logging.getLogger("crimenet.temporal.router")

router = APIRouter(
    prefix="/api/investigation",
    tags=["temporal-analysis"],
    dependencies=[Depends(get_current_user), Depends(require_roles(*ANY_AUTH_ROLE))],
)

SUPPORTED_PERIODS = ("month",)
_DATE_FMT = "%Y-%m-%d"


def _parse(value: Optional[str], field: str) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return datetime.strptime(value.strip(), _DATE_FMT)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field}: expected YYYY-MM-DD, got '{value}'.",
        )


@router.get("/temporal-analysis")
def temporal_analysis_endpoint(
    start_date: Optional[str] = Query(
        None, description="Inclusive window start (YYYY-MM-DD). Defaults to the earliest case date."),
    end_date: Optional[str] = Query(
        None, description="Inclusive window end (YYYY-MM-DD). Defaults to the latest case date."),
    period: str = Query(
        "month", description="Only 'month' is supported (case records are dated by day)."),
):
    """Detect explainable changes in the existing network across time periods.

    The window is clamped to the dates actually present in the database. When the
    selected window contains fewer than two observed periods, every detection
    reports "Insufficient historical data for this analysis." instead of
    guessing.
    """
    period_value = (period or "").strip().lower()
    if period_value not in SUPPORTED_PERIODS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported period '{period}'. Only {', '.join(SUPPORTED_PERIODS)} is supported.",
        )

    start = _parse(start_date, "start_date")
    end = _parse(end_date, "end_date")
    if start and end and start > end:
        raise HTTPException(
            status_code=422,
            detail="Invalid date range: start_date must not be after end_date.",
        )

    # Default window = full data range, resolved from the database itself.
    data_range = db_service._run_query(
        "MATCH (c:CrimeRecord) WHERE c.date IS NOT NULL "
        "RETURN min(c.date) AS min_date, max(c.date) AS max_date"
    )
    row = data_range[0] if data_range else {}
    data_min = _parse(row.get("min_date"), "start_date")
    data_max = _parse(row.get("max_date"), "end_date")

    if start is None and data_min is not None:
        start = data_min
    if end is None and data_max is not None:
        end = data_max
    if start is None or end is None:
        return temporal_service.analyze(db_service, datetime(1970, 1, 1), datetime(2100, 1, 1))

    try:
        result = temporal_service.analyze(db_service, start, end)
    except Exception:  # pragma: no cover - defensive: surface a clean 500
        logger.exception("Temporal analysis failed")
        raise HTTPException(status_code=500, detail="Temporal analysis could not be completed.")

    logger.info("Temporal analysis window=%s..%s periods=%s",
                start.date(), end.date(), result.get("summary", {}).get("period_count"))
    return result
