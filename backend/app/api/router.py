from fastapi import APIRouter

from app.api.routes import alerts, auth, chat, documents, intelligence, onboarding, recommendations, research

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(research.router, prefix="/research", tags=["research"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
