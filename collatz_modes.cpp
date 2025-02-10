#include "collatz_modes.h"
#include <algorithm>

CollatzBulkResult computeBulkSequences(CollatzEngine &engine,
                                       unsigned long long maxN) {
  CollatzBulkResult result;
  CollatzOverallStats overall{0, 0, 0, 0};

  for (unsigned long long i = 1; i <= maxN; ++i) {
    const auto &seq = engine.getSequence(i);
    result.branches[i] = seq;

    // Compute per–branch stats.
    unsigned long long branchSteps = seq.size() - 1;
    unsigned long long branchPeak = 0;
    for (unsigned long long val : seq)
      branchPeak = std::max(branchPeak, val);

    overall.branchesDone++;
    overall.sumOfSteps += branchSteps;
    overall.maxSteps = std::max(overall.maxSteps, branchSteps);
    overall.overallMaxPeak = std::max(overall.overallMaxPeak, branchPeak);
  }
  result.overallStats = overall;
  return result;
}

CollatzSelectiveResult computeSelectiveSequences(
    CollatzEngine &engine,
    const std::vector<unsigned long long> &selectedBranches) {
  CollatzSelectiveResult result;
  for (unsigned long long branch : selectedBranches) {
    const auto &seq = engine.getSequence(branch);
    result.branches[branch] = seq;

    CollatzBranchStats stats{};
    stats.steps = seq.size() - 1;
    stats.branchPeak = 0;
    for (unsigned long long val : seq)
      stats.branchPeak = std::max(stats.branchPeak, val);

    result.branchStats[branch] = stats;
  }
  return result;
}
