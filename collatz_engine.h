#ifndef COLLATZ_ENGINE_H
#define COLLATZ_ENGINE_H

#include <unordered_map>
#include <vector>
#include <stdexcept>

class CollatzEngine {
private:
    // Cache for computed sequences.
    std::unordered_map<unsigned long long, std::vector<unsigned long long>> cache;

    // Apply the Collatz formula.
    static constexpr unsigned long long applyCollatzFormula(unsigned long long num) {
        return (num % 2 == 0) ? (num / 2) : (3 * num + 1);
    }
public:
    // Compute (or return from cache) the Collatz sequence for a given starting number.
    const std::vector<unsigned long long>& getSequence(unsigned long long start) {
        if (start < 1)
            throw std::runtime_error("CollatzEngine: Only positive integers allowed.");

        auto it = cache.find(start);
        if (it != cache.end())
            return it->second;

        std::vector<unsigned long long> seq;
        unsigned long long current = start;
        do {
            seq.push_back(current);
            current = applyCollatzFormula(current);
        } while (current != 1);
        seq.push_back(1);

        auto res = cache.emplace(start, std::move(seq));
        return res.first->second;
    }
};

#endif // COLLATZ_ENGINE_H
