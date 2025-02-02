#include "collatz-conjecture.h"

constexpr int CollatzConjecture::applyCollatzFormula(int num) {
    return (num % 2 == 0) ? (num / 2) : (3 * num + 1);
}

void CollatzConjecture::computeCollatz(int n) {
    if (n < 1)
        throw std::runtime_error("computeCollatz: Only positive integers are allowed.");

    // Only compute for the range (maxComputed+1) to n
    for (int i = maxComputed + 1; i <= n; ++i) {
        // Compute (or retrieve) the sequence for branch i.
        const std::vector<int>& seq = computeSequence(i);

        // Compute branch statistics: steps and peak.
        int branchSteps = static_cast<int>(seq.size()) - 1;
        int branchPeak = 1;
        for (int val : seq)
            branchPeak = std::max(branchPeak, val);

        // Update the overall statistics cache incrementally.
        if (i == 1) {
            overallStatsCache[i] = { 1, branchSteps, branchSteps, branchPeak };
        } else {
            const auto& prev = overallStatsCache[i - 1];
            overallStatsCache[i] = {
                    prev.branchesDone + 1,
                    prev.sumOfSteps + branchSteps,
                    std::max(prev.maxSteps, branchSteps),
                    std::max(prev.overallMaxPeak, branchPeak)
            };
        }
    }

    if (n > maxComputed)
        maxComputed = n;
}

const std::vector<int>& CollatzConjecture::computeSequence(int num) {
    auto it = collatzTree.find(num);
    if (it != collatzTree.end())
        return it->second;

    // Base case for 1: use a predefined loop.
    if (num == 1) {
        collatzTree[num] = { 1, 4, 2, 1 };
        return collatzTree[num];
    }

    // Recursive case.
    int nextNum = applyCollatzFormula(num);
    const auto& nextSeq = computeSequence(nextNum);

    std::vector<int> seq;
    seq.reserve(nextSeq.size() + 1);
    seq.push_back(num);
    seq.insert(seq.end(), nextSeq.begin(), nextSeq.end());

    collatzTree[num] = std::move(seq);
    return collatzTree[num];
}

const std::unordered_map<int, std::vector<int>>& CollatzConjecture::getCollatzBranches() const {
    return collatzTree;
}

const CollatzOverallStats& CollatzConjecture::getOverallStats(int n) {
    if (n < 1)
        throw std::runtime_error("getOverallStats: Only positive integers are allowed.");
    if (n > maxComputed)
        computeCollatz(n);

    auto it = overallStatsCache.find(n);
    if (it != overallStatsCache.end())
        return it->second;

    // This point should never be reached because computeCollatz populates the cache.
    throw std::runtime_error("Overall stats not found for n = " + std::to_string(n));
}
