/** Top recommendations card for the dashboard. */

import { useNavigate } from "react-router-dom";
import type { TopRecommendation } from "../../types";

interface Props {
  recommendations: TopRecommendation[];
}

export function TopRecommendations({ recommendations }: Props) {
  const navigate = useNavigate();

  if (recommendations.length === 0) return null;

  return (
    <div className="dashboard-card" data-testid="top-recommendations">
      <h2 className="dashboard-card-title">Top Recommendations</h2>
      <ul className="top-recs-list">
        {recommendations.map((rec) => (
          <li key={rec.id} className="top-recs-item">
            {rec.title}
          </li>
        ))}
      </ul>
      <button
        className="top-recs-link"
        onClick={() => navigate("/recommendations")}
      >
        View all &#8594;
      </button>
    </div>
  );
}
