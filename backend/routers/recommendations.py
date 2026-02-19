"""Recommendations and experiment tracking endpoints."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Experiment, ExperimentStatus
from backend.schemas import (
    ExperimentCreate,
    ExperimentOut,
    ExperimentUpdate,
    Recommendation,
    RecommendationsResponse,
)
from backend.services.recommender import (
    generate_recommendations,
    get_experiment_by_id,
    list_experiments,
)

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.get("/recommendations", response_model=RecommendationsResponse)
def get_recommendations(db: Session = Depends(get_db)) -> RecommendationsResponse:
    """Get all recommendations plus active experiment."""
    result = generate_recommendations(db)
    return RecommendationsResponse(
        recommendations=[Recommendation(**r) for r in result["recommendations"]],
        total_days=result["total_days"],
        has_sufficient_data=result["has_sufficient_data"],
        active_experiment=(
            ExperimentOut(**result["active_experiment"])
            if result["active_experiment"]
            else None
        ),
    )


@router.get("/experiments", response_model=list[ExperimentOut])
def get_experiments(db: Session = Depends(get_db)) -> list[ExperimentOut]:
    """List all experiments with computed metrics."""
    experiments = list_experiments(db)
    return [ExperimentOut(**e) for e in experiments]


@router.post("/experiments", response_model=ExperimentOut, status_code=201)
def create_experiment(
    body: ExperimentCreate, db: Session = Depends(get_db)
) -> ExperimentOut:
    """Start a new experiment. Returns 409 if one is already active."""
    # Check for active experiment
    active = (
        db.query(Experiment)
        .filter(Experiment.status == ExperimentStatus.ACTIVE)
        .first()
    )
    if active is not None:
        raise HTTPException(
            status_code=409,
            detail="An experiment is already active. Complete or abandon it first.",
        )

    end_date = body.end_date or (body.start_date + dt.timedelta(days=14))

    experiment = Experiment(
        factor=body.factor,
        hypothesis=body.hypothesis,
        start_date=body.start_date,
        end_date=end_date,
        notes=body.notes,
        created_at=dt.datetime.now(dt.UTC).replace(tzinfo=None),
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    result = get_experiment_by_id(db, experiment.id)
    if result is None:
        raise HTTPException(status_code=500, detail="Failed to create experiment")
    return ExperimentOut(**result)


@router.get("/experiments/{experiment_id}", response_model=ExperimentOut)
def get_experiment(
    experiment_id: int, db: Session = Depends(get_db)
) -> ExperimentOut:
    """Get a single experiment with computed metrics."""
    result = get_experiment_by_id(db, experiment_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return ExperimentOut(**result)


@router.patch("/experiments/{experiment_id}", response_model=ExperimentOut)
def update_experiment(
    experiment_id: int,
    body: ExperimentUpdate,
    db: Session = Depends(get_db),
) -> ExperimentOut:
    """Update experiment status or notes."""
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if body.status is not None:
        experiment.status = body.status
    if body.notes is not None:
        experiment.notes = body.notes

    db.commit()
    db.refresh(experiment)

    result = get_experiment_by_id(db, experiment.id)
    if result is None:
        raise HTTPException(status_code=500, detail="Failed to update experiment")
    return ExperimentOut(**result)
