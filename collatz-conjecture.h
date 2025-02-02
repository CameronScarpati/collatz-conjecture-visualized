#ifndef CODING_PROJECTS_COLLATZ_CONJECTURE_H
#define CODING_PROJECTS_COLLATZ_CONJECTURE_H

#include <unordered_map>
#include <vector>
#include <unordered_set>
#include <algorithm>
#include <stdexcept>
#include <string>

/**
 * @struct CollatzOverallStats
 * @brief Structure to hold overall statistics for Collatz sequences.
 */
struct CollatzOverallStats {
    int branchesDone;    ///< Total number of branches computed.
    int sumOfSteps;      ///< Sum of steps for all branches.
    int maxSteps;        ///< Maximum steps (i.e. the longest branch).
    int overallMaxPeak;  ///< Highest value reached among all branches.
};

/**
 * @class CollatzConjecture
 * @brief A class to compute and store Collatz sequences for a range of numbers.
 *
 * This class generates and maintains a map of Collatz sequences (memoization)
 * for numbers from 1 up to a specified maximum. In addition, as new sequences
 * are computed, overall (aggregated) statistics are also computed and cached.
 */
class CollatzConjecture {
private:
    /// A cache (memo) for storing computed Collatz sequences.
    std::unordered_map<int, std::vector<int>> collatzTree;

    /// The highest number up to which Collatz sequences have been computed.
    int maxComputed = 0;

    /// Cache overall statistics (for each computed n).
    std::unordered_map<int, CollatzOverallStats> overallStatsCache;

    /**
     * @brief Applies the Collatz formula to a given number.
     * @param num The input number.
     * @return The next number in the Collatz sequence.
     */
    static constexpr int applyCollatzFormula(int num);

    /**
     * @brief Recursively computes or retrieves from cache the Collatz sequence for a given number.
     * @param num The starting number.
     * @return A const reference to the Collatz sequence for @p num.
     */
    const std::vector<int>& computeSequence(int num);

public:
    /**
     * @brief Default constructor for the CollatzConjecture class.
     */
    CollatzConjecture() = default;

    /**
     * @brief Computes the Collatz sequences for all numbers from 1 to n (inclusive).
     *
     * If some or all sequences in [1..n] have already been computed (due to
     * previous calls), only the newly required ones are computed.
     *
     * As new sequences are computed, overall statistics (such as total steps,
     * maximum steps, and overall peak) are computed and memoized.
     *
     * @param n The upper limit of numbers to compute Collatz sequences for.
     * @throws std::runtime_error If n is less than 1.
     */
    void computeCollatz(int n);

    /**
     * @brief Returns a read-only reference to the Collatz tree (map of all computed sequences).
     * @return A const reference to the Collatz tree.
     */
    const std::unordered_map<int, std::vector<int>>& getCollatzBranches() const;

    /**
     * @brief Returns the overall statistics for Collatz sequences computed up to n.
     *
     * This method will ensure that the sequences for all numbers 1..n have been computed
     * (updating the cache as needed) and then return the aggregated overall stats.
     *
     * @param n The maximum starting number.
     * @return A const reference to a CollatzOverallStats structure.
     * @throws std::runtime_error If n is less than 1.
     */
    const CollatzOverallStats& getOverallStats(int n);
};

#endif //CODING_PROJECTS_COLLATZ_CONJECTURE_H
