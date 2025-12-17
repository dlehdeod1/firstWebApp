import { useState } from 'react';
import { API_URL } from "@/lib/api";\r
import { useNavigate } from 'react-router-dom';
import { API_URL } from "@/lib/api";\r
import { Save, RefreshCw, Wand2, AlertCircle } from 'lucide-react';
import { API_URL } from "@/lib/api";\r
import { cn } from '@/lib/utils';
import { API_URL } from "@/lib/api";\r

interface ParsedResult {
    date: string;
    count: number;
    matched: any[];
    unknown: string[];
}

export default function SessionNew() {
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ParsedResult | null>(null);

    const handleParse = async () => {
        setLoading(true);
        try {
            const res = await fetch('${API_URL}/sessions/parse', { // Local dev URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            setResult(data);
        } catch (e) {
            alert('Failed to parse: ' + e);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (name: string) => {
        if (!confirm(`'${name}' ?†ÏàòÎ•??àÎ°ú ?±Î°ù?òÏãúÍ≤†Ïäµ?àÍπå?`)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('${API_URL}/players', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name })
            });
            const data = await res.json();

            if (data.success || data.exists) {
                // Determine ID (data.id)
                const newPlayer = { id: data.id, name };

                // Update State
                if (result) {
                    setResult({
                        ...result,
                        matched: [...result.matched, newPlayer],
                        unknown: result.unknown.filter(u => u !== name),
                        count: result.count // Count stays same, just identified
                    });
                }
            } else {
                alert('?±Î°ù ?§Ìå®: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error: ' + e);
        }
    };

    const handleSave = async () => {
        if (!result) return;
        if (!confirm(`${result.date} ?ºÏ†ï???ùÏÑ±?òÏãúÍ≤†Ïäµ?àÍπå?\nÏ∞∏ÏÑù?? ${result.matched.length}Î™?)) return;

        setLoading(true);
        try {
            const res = await fetch('${API_URL}/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: result.date,
                    title: '?ïÍ∏∞ ?¥Îèô',
                    pot_total: 0,
                    base_fee: 0,
                    player_ids: result.matched.map(p => p.id)
                })
            });
            const data = await res.json();
            if (data.success) {
                navigate(`/sessions/${data.id}`);
            } else {
                alert('?∏ÏÖò ?ùÏÑ± ?§Ìå®');
            }
        } catch (e) {
            console.error(e);
            alert('?§Î•òÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§: ' + e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center md:text-left">
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">???ºÏ†ï ?ùÏÑ±</h1>
                <p className="text-slate-500">Ïπ¥Ïπ¥?§ÌÜ° ?¨Ìëú Í≤∞Í≥ºÎ•?Î∂ôÏó¨?£Ïñ¥ Ï∞∏ÏÑù?êÎ? ?êÎèô?ºÎ°ú ?ïÎ¶¨?òÏÑ∏??</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Wand2 size={16} className="text-purple-600" />
                            Ïπ¥Ïπ¥?§ÌÜ° ?¨Ìëú Î∂ôÏó¨?£Í∏∞
                        </label>
                        <button
                            onClick={handleParse}
                            disabled={loading}
                            className={cn(
                                "px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 flex items-center gap-2 transition-all",
                                loading ? "opacity-70 cursor-wait" : "shadow-lg shadow-slate-900/10"
                            )}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            {loading ? 'Î∂ÑÏÑù Ï§?..' : 'Îß§ÏßÅ ?åÏã± ?§Ìñâ'}
                        </button>
                    </div>

                    <div className="relative group">
                        <textarea
                            className="w-full h-[400px] p-4 bg-white border border-slate-200 rounded-2xl font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm group-hover:shadow-md"
                            placeholder={"[?¨Ìëú] 12/17 ?ïÍ∏∞?¥Îèô\n\n1. ?êÌù•ÎØ?n2. ?¥Í∞ï??n3. ÍπÄÎØºÏû¨\n..."}
                            value={text}
                            onChange={e => setText(e.target.value)}
                        />
                        <div className="absolute bottom-4 right-4 text-xs text-slate-400 font-medium bg-slate-100/80 px-2 py-1 rounded">
                            {text.length}??
                        </div>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 block">ÎØ∏Î¶¨Î≥¥Í∏∞ & Í≤∞Í≥º</label>
                    <div className={cn(
                        "h-[400px] border rounded-2xl p-6 overflow-y-auto transition-all bg-white relative",
                        !result ? "border-dashed border-slate-300 flex flex-col items-center justify-center text-center" : "border-slate-200 shadow-sm"
                    )}>
                        {!result ? (
                            <div className="space-y-3 opacity-50">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Wand2 className="text-slate-400" size={32} />
                                </div>
                                <p className="text-slate-900 font-bold">?ÑÏßÅ ?∞Ïù¥?∞Í? ?ÜÏäµ?àÎã§.</p>
                                <p className="text-sm text-slate-500">Ï¢åÏ∏°???çÏä§?∏Î? ?ÖÎ†•?òÍ≥† ?åÏã± Î≤ÑÌäº???åÎü¨Ï£ºÏÑ∏??</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Date Section */}
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">?†Ïßú Í∞êÏ???/span>
                                    <p className="text-lg font-bold text-blue-900">{result.date || '?†Ïßú ?ÜÏùå'}</p>
                                </div>

                                {/* Players Section */}
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <span className="text-sm font-bold text-slate-700">Ï∞∏ÏÑù??Î™ÖÎã®</span>
                                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{result.count}Î™?/span>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {result.matched.map((p, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-sm font-bold flex items-center gap-1">
                                                {p.name}
                                            </span>
                                        ))}
                                        {result.unknown.map((name, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleRegister(name)}
                                                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm font-bold flex items-center gap-1 animate-pulse hover:bg-red-100 transition-colors"
                                                title="?¥Î¶≠?òÏó¨ ?†Ïàò ?±Î°ù"
                                            >
                                                <AlertCircle size={12} />
                                                {name}?
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-50">
                                    <button
                                        onClick={handleSave}
                                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                                    >
                                        <Save size={20} />
                                        ?∏ÏÖò ?Ä??Î∞??Ä ?ùÏÑ± Ï§ÄÎπ?
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


