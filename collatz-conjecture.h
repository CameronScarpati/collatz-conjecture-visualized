#ifndef CODING_PROJECTS_COLLATZ_CONJECTURE_H
#define CODING_PROJECTS_COLLATZ_CONJECTURE_H

#include <unordered_map>
#include <vector>
#include <unordered_set>

/**
 * @class CollatzConjecture
 * @brief A class to compute and store Collatz sequences for a range of numbers.
 *
 * This class generates and maintains a map of Collatz sequences (memoization)
 * for numbers from 1 up to a specified maximum. The sequences are stored
 * in a map where each key represents a starting number and the value is the
 * sequence of numbers leading down to 1.
 */
class CollatzConjecture {
private:
    /**
     * @brief A cache (memo) for storing computed Collatz sequences.
     *        Key: an integer n, Value: the Collatz sequence starting from n down to 1.
     */
    std::unordered_map<int, std::vector<int>> collatzTree;

    /**
     * @brief A set of all unique numbers encountered in all computed sequences.
     */
    std::unordered_set<int> allNodes;

    /**
     * @brief The highest number up to which Collatz sequences have been computed.
     */
    int maxComputed = 0;

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
     * @param n The upper limit of numbers to compute Collatz sequences for.
     * @throws std::runtime_error If n is less than 1.
     */
    void computeCollatz(int n);

    /**
     * @brief Returns a read-only reference to the Collatz tree (map of all computed sequences).
     * @return A const reference to the Collatz tree.
     */
    const std::unordered_map<int, std::vector<int>>& getCollatzTree() const;

    /**
     * @brief Returns a read-only reference to the set of all unique nodes encountered.
     * @return A const reference to the set of all unique nodes.
     */
    const std::unordered_set<int>& getAllNodes() const;
};

#endif //CODING_PROJECTS_COLLATZ_CONJECTURE_H
