#ifndef COLLATZ_MODES_H
#define COLLATZ_MODES_H

#include "collatz_engine.h"
#include "collatz_stats.h"
#include <unordered_map>
#include <vector>

// Structure for bulk mode (computing all sequences from 1 to maxN).
struct CollatzBulkResult {
    std::unordered_map<unsigned long long, std::vector<unsigned long long>> branches;
    CollatzOverallStats overallStats;
};

// Structure for selective mode (computing only user–selected branches).
struct CollatzSelectiveResult {
    std::unordered_map<unsigned long long, std::vector<unsigned long long>> branches;
    std::unordered_map<unsigned long long, CollatzBranchStats> branchStats;
};

// Compute all sequences for numbers 1..maxN.
CollatzBulkResult computeBulkSequences(CollatzEngine& engine, unsigned long long maxN);

// Compute sequences only for the user–selected branch starting numbers.
CollatzSelectiveResult computeSelectiveSequences(CollatzEngine& engine, const std::vector<unsigned long long>& selectedBranches);

#endif // COLLATZ_MODES_H
