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

export interface ScoreWeights {
  skills: { total: number; mustHave: number; niceToHave: number };
  experience: number;
  location: { total: number; remoteAllowed: number };
  salary: number;
}

export interface ScoreWeightOverrides {
  skills?: number;
  experience?: number;
  location?: number;
  salary?: number;
}
