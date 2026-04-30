import { GitHubReviewCore } from "../core/github/review-core.js";
import { createLiveGitHubAdapter } from "../core/github/live-adapter.js";

export interface CliServices {
  readonly core: GitHubReviewCore;
}

export function createDefaultCliServices(): CliServices {
  return { core: new GitHubReviewCore(createLiveGitHubAdapter()) };
}
