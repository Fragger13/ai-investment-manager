from __future__ import annotations

from app.schemas.financial import OnboardingProfile
from app.services.optimization.goal_based_allocation_service import goal_allocation_profile


def optimize_goal_allocation(profile: OnboardingProfile) -> dict:
    return goal_allocation_profile(profile)

