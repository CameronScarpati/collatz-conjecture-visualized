#ifndef COLLATZ_STATS_H
#define COLLATZ_STATS_H

// Statistics for one branch.
struct CollatzBranchStats {
  unsigned long long steps;      // (sequence length minus one)
  unsigned long long branchPeak; // maximum value reached in the branch
};

// Overall (aggregated) statistics.
struct CollatzOverallStats {
  unsigned long long branchesDone;
  unsigned long long sumOfSteps;
  unsigned long long maxSteps;
  unsigned long long overallMaxPeak;
};

#endif // COLLATZ_STATS_H