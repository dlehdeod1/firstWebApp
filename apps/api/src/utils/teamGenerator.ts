
export interface PlayerStats {
    id: number;
    name: string;
    shooting: number;
    offball_run: number;
    ball_keeping: number;
    passing: number;
    intercept: number;
    marking: number;
    stamina: number;
    speed: number;
    height_cm?: number;
    weight_kg?: number;
    // Join date for naming
    join_date?: string;
}

export interface ChemistryEdge {
    player_a_id: number;
    player_b_id: number;
    score: number;
}

export interface Team {
    id: string; // "A", "B", "C"
    name: string; // Calculated later
    players: PlayerStats[];
    stats: {
        attack: number;
        mid: number;
        def: number;
        base: number;
        physical: number;
        total: number;
    };
}

export interface GeneratorResult {
    teams: Team[];
    logs: string[];
    balanceScore: number; // 0-100
}

const WEIGHTS = {
    w1: 1.0, // Attack
    w2: 1.0, // Mid
    w3: 1.0, // Def
    w4: 0.8, // Base
    w5: 0.6  // Physical
};

function calculatePlayerScore(p: PlayerStats): number {
    const attack = p.shooting + p.offball_run;
    const mid = p.ball_keeping + p.passing;
    const def = p.intercept + p.marking;
    const base = p.stamina + p.speed;
    // Physical: normalize height/weight to 1-10 scale roughly? 
    // Requirement says physical is 1-10 input. 
    // Let's assume input 'physical' is derived or we just use stats directly.
    // Wait, requirement says: "physical(1~10): height, weight input -> auto calc".
    // So 'physical' should be a field in PlayerStats if pre-calculated.
    // If not, we need a calc. Let's assume it's pre-calculated in DB or passed as a field.
    // For now, I'll add 'physical_rating' to PlayerStats interface.
    const physical = (p as any).physical_rating || 5;

    return (
        WEIGHTS.w1 * attack +
        WEIGHTS.w2 * mid +
        WEIGHTS.w3 * def +
        WEIGHTS.w4 * base +
        WEIGHTS.w5 * physical
    );
}

function calculateTeamStats(players: PlayerStats[]) {
    let attack = 0, mid = 0, def = 0, base = 0, physical = 0, total = 0;
    for (const p of players) {
        const pScore = calculatePlayerScore(p);
        attack += (p.shooting + p.offball_run);
        mid += (p.ball_keeping + p.passing);
        def += (p.intercept + p.marking);
        base += (p.stamina + p.speed);
        physical += ((p as any).physical_rating || 5);
        total += pScore;
    }
    return { attack, mid, def, base, physical, total };
}

export class TeamBalancer {
    constructor(
        private players: PlayerStats[],
        private chemistry: ChemistryEdge[]
    ) { }

    generate(numTeams: number): GeneratorResult {
        const logs: string[] = [];
        logs.push(`Starting generation with ${this.players.length} players for ${numTeams} teams.`);

        // 1. Sort by Overall
        const sortedPlayers = [...this.players].sort((a, b) => calculatePlayerScore(b) - calculatePlayerScore(a));

        // 2. Greedy Distribution (Snake)
        const teams: PlayerStats[][] = Array(numTeams).fill(null).map(() => []);

        sortedPlayers.forEach((p, i) => {
            const snakeIndex = i % (numTeams * 2);
            let teamIndex = snakeIndex;
            if (snakeIndex >= numTeams) {
                teamIndex = (numTeams * 2) - 1 - snakeIndex;
            }
            teams[teamIndex].push(p);
        });

        logs.push("Initial Greedy Distribution done.");

        // 3. Optimization Loop (Swap)
        // Simple Hill Climbing: Try random swaps, if better, keep it.
        let currentVariance = this.calculateVariance(teams);
        let currentChemistry = this.calculateTotalChemistry(teams);
        let currentScore = currentVariance - (currentChemistry * 2.0);

        // logs.push(`Initial Score: ${currentScore.toFixed(1)} (Var: ${currentVariance.toFixed(1)}, Chem: ${currentChemistry})`);

        let iterations = 1000;

        for (let i = 0; i < iterations; i++) {
            // Pick two random teams
            const t1Idx = Math.floor(Math.random() * numTeams);
            const t2Idx = Math.floor(Math.random() * numTeams);
            if (t1Idx === t2Idx) continue;

            // Pick one player from each
            const p1Idx = Math.floor(Math.random() * teams[t1Idx].length);
            const p2Idx = Math.floor(Math.random() * teams[t2Idx].length);

            const p1 = teams[t1Idx][p1Idx];
            const p2 = teams[t2Idx][p2Idx];

            // Swap
            teams[t1Idx][p1Idx] = p2;
            teams[t2Idx][p2Idx] = p1;

            const newVariance = this.calculateVariance(teams);
            const newChemistry = this.calculateTotalChemistry(teams);

            // Objective: Minimize Variance, Maximize Chemistry
            // Cost = Variance - (Chemistry * 2.0)
            const newScore = newVariance - (newChemistry * 2.0);

            if (newScore < currentScore) {
                currentScore = newScore;
                currentVariance = newVariance;
                logs.push(`Swap ${p1.name} <-> ${p2.name}: Var ${newVariance.toFixed(1)}, Chem ${newChemistry}, Score ${newScore.toFixed(1)}`);
            } else {
                // Revert
                teams[t1Idx][p1Idx] = p1;
                teams[t2Idx][p2Idx] = p2;
            }
        }

        const finalChemistry = this.calculateTotalChemistry(teams);
        logs.push(`Final Variety: ${currentVariance.toFixed(2)}, Final Chemistry: ${finalChemistry}`);

        // formatting result
        const finalTeams: Team[] = teams.map((tp, idx) => ({
            id: String.fromCharCode(65 + idx), // A, B, C...
            name: `Team ${String.fromCharCode(65 + idx)}`, // Logic for name later
            players: tp,
            stats: calculateTeamStats(tp)
        }));

        return {
            teams: finalTeams,
            logs,
            balanceScore: Math.max(0, 100 - currentVariance)
        };
    }

    private calculateVariance(teams: PlayerStats[][]): number {
        const scores = teams.map(t => calculateTeamStats(t).total);
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        return max - min;
    }

    private calculateTotalChemistry(teams: PlayerStats[][]): number {
        let total = 0;
        // Pre-calculate map for O(1) lookup if needed, but array is small.
        // Or just iterate edges and check if both in same team? No, iterating players is safer.

        // Optimize: Convert chemistry list to Map<"id-id", score>
        const chemMap = new Map<string, number>();
        this.chemistry.forEach(c => {
            const key = [c.player_a_id, c.player_b_id].sort((a, b) => a - b).join('-');
            chemMap.set(key, c.score);
        });

        for (const team of teams) {
            for (let i = 0; i < team.length; i++) {
                for (let j = i + 1; j < team.length; j++) {
                    const p1 = team[i].id;
                    const p2 = team[j].id;
                    const key = [p1, p2].sort((a, b) => a - b).join('-');
                    total += (chemMap.get(key) || 0);
                }
            }
        }
        return total;
    }
}
