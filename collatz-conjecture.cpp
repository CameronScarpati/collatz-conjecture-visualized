#include "collatz-conjecture.h"
#include <stdexcept>

constexpr int CollatzConjecture::applyCollatzFormula(int num) {
    return (num % 2 == 0) ? (num / 2) : (3 * num + 1);
}

void CollatzConjecture::computeCollatz(int n) {
    if (n < 1) {
        throw std::runtime_error("computeCollatz: Only positive integers are allowed.");
    }

    // Only compute for the range (maxComputed+1) to n
    // If n <= maxComputed, we've already computed everything up to n.
    for (int i = maxComputed + 1; i <= n; ++i) {
        computeSequence(i);
    }

    // Update maxComputed if needed
    if (n > maxComputed) {
        maxComputed = n;
    }
}

const std::vector<int>& CollatzConjecture::computeSequence(int num) {
    // If already in cache, return it
    auto it = collatzTree.find(num);
    if (it != collatzTree.end()) {
        return it->second;
    }

    // Base case
    if (num == 1) {
        collatzTree[num] = {1};
        allNodes.insert(num);
        return collatzTree[num];
    }

    // Recursive case
    int nextNum = applyCollatzFormula(num);
    const auto& nextSeq = computeSequence(nextNum);

    // Build the sequence for 'num'
    std::vector<int> seq;
    seq.reserve(nextSeq.size() + 1);
    seq.push_back(num);
    seq.insert(seq.end(), nextSeq.begin(), nextSeq.end());

    // Store in cache
    collatzTree[num] = std::move(seq);

    // Insert 'num' into allNodes
    allNodes.insert(num);

    // Return the newly inserted sequence
    return collatzTree[num];
}

const std::unordered_map<int, std::vector<int>>& CollatzConjecture::getCollatzTree() const {
    return collatzTree;
}

const std::unordered_set<int>& CollatzConjecture::getAllNodes() const {
    return allNodes;
}
