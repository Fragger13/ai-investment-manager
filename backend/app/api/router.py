from fastapi import APIRouter

from app.api.routes import alerts, assets, auth, chat, copilot, documents, drift, feedback, holdings, intelligence, llm, market, memory, onboarding, portfolio, recommendations, research, system, validation

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(research.router, prefix="/research", tags=["research"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(validation.router, prefix="/validation", tags=["validation"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(holdings.router, prefix="/holdings", tags=["holdings"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(drift.router, prefix="/drift", tags=["drift"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(llm.router, prefix="/llm", tags=["llm"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
