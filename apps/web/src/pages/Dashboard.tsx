import { useEffect, useState } from 'react'
import { ArrowRight, MapPin, Clock, Trophy, Activity, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

// API base
export default function Dashboard() {
    const [nextSession, setNextSession] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Fetch sessions and pick the latest one
        // A better API would be /sessions/next but we can just list and sort.
        fetch(`${API_URL}/sessions`)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results.length > 0) {
                    // Sort by id desc or date desc. Assuming ID implies order.
                    const latest = data.results.sort((a: any, b: any) => b.id - a.id)[0]
                    setNextSession(latest)
                }
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="space-y-8 pb-10">
            {/* Hero Section - Cleaner/Minimal */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-blue-900 text-white p-8 md:p-12 shadow-2xl">
                <div className="relative z-10 max-w-2xl">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-bold border border-white/10 mb-6 inline-block backdrop-blur-sm">
                        Wednesday Futsal Club
                    </span>
                    <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight tracking-tight">
                        ?�요?�의 <span className="text-blue-400">?�정</span>??br />
                        기록?�고 공유?�세??
                    </h1>

                    <div className="flex flex-wrap gap-3">
                        <Link to="/sessions" className="px-5 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-white/10">
                            ?�정 ?�인?�기 <ArrowRight size={16} />
                        </Link>
                        <Link to="/me" className="px-5 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors text-sm border border-white/10 backdrop-blur-sm">
                            ??기록 보기
                        </Link>
                    </div>
                </div>
            </section>

            {/* Next Match Card - Dynamic */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                        <CalendarDays className="text-blue-600" size={20} />
                        ?�음 ?�정
                    </h2>
                </div>

                {loading ? (
                    <div className="h-40 bg-slate-100 rounded-2xl animate-pulse"></div>
                ) : nextSession ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>

                        <div className="flex flex-1 items-center gap-6 z-10">
                            <div className="bg-blue-50 text-blue-600 font-bold p-4 rounded-2xl text-center min-w-[80px]">
                                <span className="block text-xs text-blue-400 uppercase tracking-widest mb-1">Status</span>
                                <span className={cn("text-lg", nextSession.status === 'recruiting' ? "text-emerald-500" : "text-slate-500")}>
                                    {nextSession.status === 'recruiting' ? '모집�? : '마감'}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">{nextSession.session_date}</h3>
                                <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm font-medium">
                                    <span className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400" /> {nextSession.title || '?�기 ?�동'}</span>
                                    <span className="flex items-center gap-1.5"><MapPin size={16} className="text-slate-400" /> 경북?� A구장</span>
                                </div>
                            </div>
                        </div>

                        <Link
                            to={`/sessions/${nextSession.id}`}
                            className={cn(
                                "w-full md:w-auto px-6 py-3 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 z-10",
                                nextSession.status === 'recruiting'
                                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30 shadow-lg"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            {nextSession.status === 'recruiting' ? '참석 ?�표 / 변�? : '결과 보기'}
                        </Link>
                    </div>
                ) : (
                    <div className="bg-slate-50 rounded-2xl p-10 text-center border border-dashed border-slate-200">
                        <p className="text-slate-400 mb-4">?�정???�정???�습?�다.</p>
                        {localStorage.getItem('user_role') === 'admin' && (
                            <Link to="/sessions/new" className="text-blue-600 underline font-bold">???�정 만들�?/Link>
                        )}
                    </div>
                )}
            </section>

            {/* Quick Links / Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link to="/sessions" className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                    <Activity className="text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-slate-700">경기 결과</div>
                    <div className="text-xs text-slate-400">지??매치 ?�인</div>
                </Link>
                <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm opacity-60 cursor-not-allowed">
                    <Trophy className="text-yellow-500 mb-3" />
                    <div className="font-bold text-slate-700">명예???�당</div>
                    <div className="text-xs text-slate-400">준�?�?/div>
                </div>
            </div>
        </div>
    )
}


