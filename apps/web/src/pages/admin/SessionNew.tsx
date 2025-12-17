import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, RefreshCw, Wand2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
            const res = await fetch('http://localhost:8787/sessions/parse', { // Local dev URL
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
        if (!confirm(`'${name}' 선수를 새로 등록하시겠습니까?`)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:8787/players', {
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
                alert('등록 실패: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error: ' + e);
        }
    };

    const handleSave = async () => {
        if (!result) return;
        if (!confirm(`${result.date} 일정을 생성하시겠습니까?\n참석자: ${result.matched.length}명`)) return;

        setLoading(true);
        try {
            const res = await fetch('http://localhost:8787/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: result.date,
                    title: '정기 운동',
                    pot_total: 0,
                    base_fee: 0,
                    player_ids: result.matched.map(p => p.id)
                })
            });
            const data = await res.json();
            if (data.success) {
                navigate(`/sessions/${data.id}`);
            } else {
                alert('세션 생성 실패');
            }
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다: ' + e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center md:text-left">
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">새 일정 생성</h1>
                <p className="text-slate-500">카카오톡 투표 결과를 붙여넣어 참석자를 자동으로 정리하세요.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Wand2 size={16} className="text-purple-600" />
                            카카오톡 투표 붙여넣기
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
                            {loading ? '분석 중...' : '매직 파싱 실행'}
                        </button>
                    </div>

                    <div className="relative group">
                        <textarea
                            className="w-full h-[400px] p-4 bg-white border border-slate-200 rounded-2xl font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm group-hover:shadow-md"
                            placeholder={"[투표] 12/17 정기운동\n\n1. 손흥민\n2. 이강인\n3. 김민재\n..."}
                            value={text}
                            onChange={e => setText(e.target.value)}
                        />
                        <div className="absolute bottom-4 right-4 text-xs text-slate-400 font-medium bg-slate-100/80 px-2 py-1 rounded">
                            {text.length}자
                        </div>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 block">미리보기 & 결과</label>
                    <div className={cn(
                        "h-[400px] border rounded-2xl p-6 overflow-y-auto transition-all bg-white relative",
                        !result ? "border-dashed border-slate-300 flex flex-col items-center justify-center text-center" : "border-slate-200 shadow-sm"
                    )}>
                        {!result ? (
                            <div className="space-y-3 opacity-50">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Wand2 className="text-slate-400" size={32} />
                                </div>
                                <p className="text-slate-900 font-bold">아직 데이터가 없습니다.</p>
                                <p className="text-sm text-slate-500">좌측에 텍스트를 입력하고 파싱 버튼을 눌러주세요.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Date Section */}
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">날짜 감지됨</span>
                                    <p className="text-lg font-bold text-blue-900">{result.date || '날짜 없음'}</p>
                                </div>

                                {/* Players Section */}
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <span className="text-sm font-bold text-slate-700">참석자 명단</span>
                                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{result.count}명</span>
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
                                                title="클릭하여 선수 등록"
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
                                        세션 저장 및 팀 생성 준비
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
