def list_alerts() -> list[dict[str, str]]:
    return [
        {
            "title": "Daily insight",
            "type": "Discipline",
            "severity": "Medium",
            "detail": "Lifestyle spend is above the daily run-rate. Keep this week below Rs 22,000 to stay on plan.",
        },
        {
            "title": "Market alert",
            "type": "Opportunity",
            "severity": "Low",
            "detail": "Large-cap quality remains more attractive than overheated small-cap fresh entries.",
        },
        {
            "title": "Recommendation alert",
            "type": "Action",
            "severity": "High",
            "detail": "Clear credit-card debt before deploying the tactical sector basket.",
        },
    ]
