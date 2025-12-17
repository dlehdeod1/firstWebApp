export interface ParsedSession {
    date: string;
    names: string[];
}

export function parseSessionText(text: string): ParsedSession {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
        return { date: '', names: [] };
    }

    let date = '';
    const names: string[] = [];

    // Regex for date: 12.17 or 12/17
    const dateRegex = /(\d{1,2})[\.\/](\d{1,2})/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Try to find date
        if (!date) {
            const dateMatch = line.match(dateRegex);
            if (dateMatch) {
                const month = dateMatch[1].padStart(2, '0');
                const day = dateMatch[2].padStart(2, '0');
                const year = new Date().getFullYear();
                date = `${year}-${month}-${day}`;
                // If this line was purely a date header (contains balls or brackets), skip name parsing on this line
                // unless it also looks like it has names.
                // For the user's example "12.17(수)⚽️⚽️⚽️⚽️", it's a header.
                if (line.includes('(') || line.includes('⚽')) {
                    continue;
                }
            }
        }

        // 2. Extract names
        // Remove "N명" at the end of the line
        let cleanLine = line.replace(/\d+명$/, '');
        cleanLine = cleanLine.replace(/\d+명\s*$/, ''); // "18명" at end

        // Remove emojis and special chars
        cleanLine = cleanLine
            .replace(/[⚽️]+/g, '')
            // eslint-disable-next-line no-control-regex
            .replace(/[^\u0000-\u007F\uAC00-\uD7A3\u3130-\u318F\s]/g, '') // Keep ASCII + Korean
            .replace(/[\(\)\[\]]/g, ' ')
            .trim();

        const tokens = cleanLine.split(/\s+/).filter(Boolean);

        tokens.forEach(token => {
            // Ignore if it looks like a date
            if (token.match(dateRegex)) return;
            // Ignore pure numbers
            if (token.match(/^\d+$/)) return;

            // Heuristic: Korean Names are usually 2-4 chars.
            // But let's be permissive.
            if (token.length >= 1) {
                names.push(token);
            }
        });
    }

    return {
        date,
        names
    };
}
