export interface ScoreComponent {
  score: number;
  max: number;
}

export interface MatchBreakdown {
  skills: ScoreComponent;
  experience: ScoreComponent;
  location: ScoreComponent;
  salary: ScoreComponent;
}

export interface MatchResult {
  score: number;
  breakdown: MatchBreakdown;
}
