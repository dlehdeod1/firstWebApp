import { useEffect, useState } from 'react'
import { ArrowRight, MapPin, Clock, Trophy, Activity, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

// API base
const API_URL = import.meta.env.VITE_API_URL || 'https://conerkicks-api.conerkicks.workers.dev'

interface SeasonChampion {
    category: string
    categoryLabel: string
    icon: string
    playerId: number
    playerName: string
    value: number
    season: number
}

interface HallOfFameData {
    season: number
    isCurrentSeason: boolean
    champions: SeasonChampion[]
}

export default function Dashboard() {
    const [nextSession, setNextSession] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [hallOfFame, setHallOfFame] = useState<HallOfFameData | null>(null)
    const { actualTheme } = useTheme()

    useEffect(() => {
        // Fetch sessions and pick the latest one
        fetch(`${API_URL}/sessions`)
            .then(res => res.json())
            .then(data => {
                if (data.results && data.results.length > 0) {
                    const latest = data.results.sort((a: any, b: any) => b.id - a.id)[0]
                    setNextSession(latest)
                }
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false))

        // Fetch Hall of Fame data
        fetch(`${API_URL}/hall-of-fame`)
            .then(res => res.json())
            .then(data => {
                if (data.champions) {
                    setHallOfFame(data)
                }
            })
            .catch(e => console.error(e))
    }, [])

    return (
        <div className="space-y-8 pb-10">
            {/* Hero Section - Cleaner/Minimal */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-blue-900 text-white p-8 md:p-12 shadow-2xl">
                <div className="relative z-10 max-w-2xl">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-bold border border-white/10 mb-6 inline-block backdrop-blur-sm">
                        코너킥스 FC
                    </span>
                    <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight tracking-tight">
                        수요일의 <span className="text-blue-400">열정</span>을<br />
                        기록하고 공유하세요.
                    </h1>

                    <div className="flex flex-wrap gap-3">
                        <Link to="/sessions" className="px-5 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-white/10">
                            일정 확인하기 <ArrowRight size={16} />
                        </Link>
                        <Link to="/me" className="px-5 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors text-sm border border-white/10 backdrop-blur-sm">
                            내 기록 보기
                        </Link>
                    </div>
                </div>
            </section>

            {/* Next Match Card - Dynamic */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={cn("text-xl font-bold flex items-center gap-2", actualTheme === 'dark' ? "text-slate-100" : "text-slate-800")}>
                        <CalendarDays className="text-blue-600" size={20} />
                        다음 일정
                    </h2>
                </div>

                {loading ? (
                    <div className={cn("h-40 rounded-2xl animate-pulse", actualTheme === 'dark' ? "bg-slate-800" : "bg-slate-100")}></div>
                ) : nextSession ? (
                    <div className={cn("rounded-2xl shadow-sm border p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group hover:shadow-md transition-all",
                        actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                    )}>
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>

                        <div className="flex flex-1 items-center gap-6 z-10">
                            <div className={cn("font-bold p-4 rounded-2xl text-center min-w-[80px]",
                                actualTheme === 'dark' ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
                            )}>
                                <span className={cn("block text-xs uppercase tracking-widest mb-1",
                                    actualTheme === 'dark' ? "text-blue-300" : "text-blue-400"
                                )}>Status</span>
                                <span className={cn("text-lg", nextSession.status === 'recruiting' ? "text-emerald-500" :
                                    actualTheme === 'dark' ? "text-slate-400" : "text-slate-500"
                                )}>
                                    {nextSession.status === 'recruiting' ? '모집중' : '마감'}
                                </span>
                            </div>
                            <div>
                                <h3 className={cn("text-xl font-bold mb-2",
                                    actualTheme === 'dark' ? "text-slate-100" : "text-slate-900"
                                )}>{nextSession.session_date}</h3>
                                <div className={cn("flex flex-wrap items-center gap-4 text-sm font-medium",
                                    actualTheme === 'dark' ? "text-slate-400" : "text-slate-500"
                                )}>
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={16} className={actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"} />
                                        {nextSession.title || '정기 운동'}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <MapPin size={16} className={actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"} />
                                        경북대 A구장
                                    </span>
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
                            {nextSession.status === 'recruiting' ? '참석 투표 / 변경' : '결과 보기'}
                        </Link>
                    </div>
                ) : (
                    <div className={cn("rounded-2xl p-10 text-center border border-dashed",
                        actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}>
                        <p className={actualTheme === 'dark' ? "text-slate-500 mb-4" : "text-slate-400 mb-4"}>예정된 일정이 없습니다.</p>
                        {localStorage.getItem('user_role') === 'admin' && (
                            <Link to="/sessions/new" className="text-blue-600 underline font-bold">새 일정 만들기</Link>
                        )}
                    </div>
                )}
            </section>

            {/* Quick Links / Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link to="/sessions" className={cn("p-4 border rounded-2xl shadow-sm hover:shadow-md transition-all group",
                    actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                )}>
                    <Activity className="text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
                    <div className={cn("font-bold", actualTheme === 'dark' ? "text-slate-200" : "text-slate-700")}>경기 결과</div>
                    <div className={cn("text-xs", actualTheme === 'dark' ? "text-slate-500" : "text-slate-400")}>지난 매치 확인</div>
                </Link>
                <Link to="/rankings" className={cn("p-4 border rounded-2xl shadow-sm hover:shadow-md transition-all group",
                    actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                )}>
                    <Trophy className="text-yellow-500 mb-3 group-hover:scale-110 transition-transform" />
                    <div className={cn("font-bold", actualTheme === 'dark' ? "text-slate-200" : "text-slate-700")}>랭킹</div>
                    <div className={cn("text-xs", actualTheme === 'dark' ? "text-slate-500" : "text-slate-400")}>순위 확인</div>
                </Link>
            </div>

            {/* Hall of Fame Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={cn("text-xl font-bold flex items-center gap-2",
                        actualTheme === 'dark' ? "text-slate-100" : "text-slate-800"
                    )}>
                        <Trophy className="text-yellow-500" size={20} />
                        명예의 전당
                        {hallOfFame && (
                            <span className={cn("text-sm font-normal ml-2",
                                actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                            )}>
                                {hallOfFame.isCurrentSeason ? `${hallOfFame.season} 시즌 현재 리더` : `${hallOfFame.season} 시즌 챔피언`}
                            </span>
                        )}
                    </h2>
                    <Link to="/rankings" className="text-sm text-blue-600 font-bold hover:underline">
                        전체 보기 →
                    </Link>
                </div>

                {hallOfFame && hallOfFame.champions.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {hallOfFame.champions.map((champion) => (
                            <div
                                key={champion.category}
                                className={cn("rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-all border",
                                    actualTheme === 'dark'
                                        ? "bg-gradient-to-br from-yellow-900/30 to-amber-900/30 border-yellow-800/50"
                                        : "bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-100"
                                )}
                            >
                                <div className="text-2xl mb-2">{champion.icon}</div>
                                <div className={cn("text-xs font-bold mb-1",
                                    actualTheme === 'dark' ? "text-yellow-400" : "text-yellow-700"
                                )}>{champion.categoryLabel}</div>
                                <div className={cn("font-black truncate",
                                    actualTheme === 'dark' ? "text-slate-100" : "text-slate-900"
                                )}>{champion.playerName}</div>
                                <div className={cn("text-lg font-bold",
                                    actualTheme === 'dark' ? "text-yellow-400" : "text-yellow-600"
                                )}>{champion.value}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={cn("rounded-2xl p-8 text-center border border-dashed",
                        actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}>
                        <Trophy className={cn("mx-auto mb-3", actualTheme === 'dark' ? "text-slate-600" : "text-slate-300")} size={32} />
                        <p className={actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"}>아직 기록이 없습니다.</p>
                        <p className={cn("text-xs mt-1", actualTheme === 'dark' ? "text-slate-600" : "text-slate-300")}>경기에 참여하여 명예의 전당에 이름을 올려보세요!</p>
                    </div>
                )}
            </section>
        </div>
    )
}
