"""Analysis engine endpoints — status, correlations, regression, timing, naps."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import (
    AnalysisStatusResponse,
    CorrelationResponse,
    CorrelationResult,
    NapResponse,
    NapSegment,
    RegressionResponse,
    RegressionResult,
    RegressionCoefficient,
    SleepTimingResponse,
    VariableStatus,
)
from backend.services.nap_analysis import compute_nap_analysis
from backend.services.sleep_timing import compute_sleep_timing
from backend.services.stats_engine import (
    PRIMARY_OUTCOMES,
    compute_correlations,
    compute_regression,
    get_data_status,
    prepare_analysis_dataframe,
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/status", response_model=AnalysisStatusResponse)
def analysis_status(db: Session = Depends(get_db)) -> AnalysisStatusResponse:
    """Data sufficiency status for each analysis phase."""
    df = prepare_analysis_dataframe(db)
    status = get_data_status(df)
    return AnalysisStatusResponse(
        total_sleep_days=status["total_sleep_days"],
        phase_a_unlocked=status["phase_a_unlocked"],
        phase_b_unlocked=status["phase_b_unlocked"],
        phase_c_unlocked=status["phase_c_unlocked"],
        variables=[VariableStatus(**v) for v in status["variables"]],
    )


@router.get("/correlations", response_model=CorrelationResponse)
def analysis_correlations(db: Session = Depends(get_db)) -> CorrelationResponse:
    """Pairwise correlations between predictors and outcomes."""
    df = prepare_analysis_dataframe(db)
    total_days = len(df)
    results, excluded_sick = compute_correlations(df)
    return CorrelationResponse(
        results=[CorrelationResult(**r) for r in results],
        total_days=total_days,
        excluded_sick_days=excluded_sick,
    )


@router.get("/regression", response_model=RegressionResponse)
def analysis_regression(db: Session = Depends(get_db)) -> RegressionResponse:
    """OLS regression for primary outcome variables."""
    df = prepare_analysis_dataframe(db)
    total_days = len(df)
    results = []
    for outcome in PRIMARY_OUTCOMES:
        result = compute_regression(df, outcome)
        if result is not None:
            results.append(
                RegressionResult(
                    outcome=result["outcome"],
                    outcome_label=result["outcome_label"],
                    n_days=result["n_days"],
                    r_squared=result["r_squared"],
                    adj_r_squared=result["adj_r_squared"],
                    coefficients=[
                        RegressionCoefficient(**c) for c in result["coefficients"]
                    ],
                    has_autocorrelation=result["has_autocorrelation"],
                    is_stationary=result["is_stationary"],
                    multicollinearity_warning=result["multicollinearity_warning"],
                    excluded_predictors=result["excluded_predictors"],
                )
            )
    return RegressionResponse(results=results, total_days=total_days)


@router.get("/timing", response_model=SleepTimingResponse)
def analysis_timing(db: Session = Depends(get_db)) -> SleepTimingResponse:
    """Sleep timing analysis — chronotype, optimal bedtime, social jet lag."""
    df = prepare_analysis_dataframe(db)
    result = compute_sleep_timing(df)
    return SleepTimingResponse(**result)


@router.get("/naps", response_model=NapResponse)
def analysis_naps(db: Session = Depends(get_db)) -> NapResponse:
    """Segmented nap impact analysis."""
    result = compute_nap_analysis(db)
    return NapResponse(
        no_nap_baseline=result["no_nap_baseline"],
        segments=[NapSegment(**s) for s in result["segments"]],
        total_nap_days=result["total_nap_days"],
        total_no_nap_days=result["total_no_nap_days"],
    )
