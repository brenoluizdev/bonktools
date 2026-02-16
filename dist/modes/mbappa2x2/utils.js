"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuzzyMatch = fuzzyMatch;
function fuzzyMatch(query, names) {
    const q = query.toLowerCase().trim();
    if (!q)
        return [];
    const results = [];
    for (const name of names) {
        const n = name.toLowerCase();
        let score = 0;
        let qi = 0;
        for (let i = 0; i < n.length && qi < q.length; i++) {
            if (n[i] === q[qi]) {
                score += i === 0 ? 2 : 1;
                qi++;
            }
        }
        if (qi === q.length)
            results.push({ name, score });
    }
    results.sort((a, b) => b.score - a.score);
    const bestScore = results[0]?.score;
    return results.filter(r => r.score === bestScore && bestScore !== undefined).map(r => r.name);
}
