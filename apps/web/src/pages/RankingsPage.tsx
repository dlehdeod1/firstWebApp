import { useState, useEffect } from 'react'
import { Trophy, Medal, Flame, Target, Shield, TrendingUp, Users, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://conerkicks-api.conerkicks.workers.dev'

interface RankItem {
    id: number
    rank: number
    name: string
    games: number
    goals: number
    assists: number
    points: number
    wins?: number
    defenses?: number
    key_passes?: number
    blocks?: number
    clearances?: number
    attendance?: number
    streak?: number
    ppm?: number // Points Per Match
}

type TabType = 'points' | 'goals' | 'assists' | 'ppm' | 'wins' | 'defenses' | 'attendance' | 'streak'

export default function RankingsPage() {
    const [tab, setTab] = useState<TabType>('points')
    const [data, setData] = useState<RankItem[]>([])
    const [loading, setLoading] = useState(false)
    const { actualTheme } = useTheme()

    useEffect(() => {
        fetchRankings(tab)
    }, [tab])

    const fetchRankings = async (type: string) => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/rankings/${type}`)
            const json = await res.json()
            if (Array.isArray(json)) {
                setData(json)
            } else {
                console.error('Invalid data format', json)
                setData([])
            }
        } catch (e) {
            console.error(e)
            setData([])
        } finally {
            setLoading(false)
        }
    }

    const tabs: { id: TabType; label: string; icon: any; color: string; bg: string; shortLabel: string }[] = [
        { id: 'points', label: '공격포인트', shortLabel: '공격P', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'ppm', label: 'PPM', shortLabel: 'PPM', icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-50' },
        { id: 'goals', label: '득점왕', shortLabel: '득점', icon: Target, color: 'text-yellow-500', bg: 'bg-yellow-50' },
        { id: 'assists', label: '도움왕', shortLabel: '도움', icon: Medal, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'wins', label: '다승왕', shortLabel: '다승', icon: Trophy, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { id: 'defenses', label: '수비왕', shortLabel: '수비', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-50' },
        { id: 'attendance', label: '출석왕', shortLabel: '출석', icon: Users, color: 'text-teal-500', bg: 'bg-teal-50' },
        { id: 'streak', label: '연속출석', shortLabel: '연속', icon: Zap, color: 'text-pink-500', bg: 'bg-pink-50' },
    ]

    const currentTab = tabs.find(t => t.id === tab)!

    // Get the main stat value for display based on current tab
    const getMainStat = (item: RankItem) => {
        switch (tab) {
            case 'goals': return item.goals
            case 'assists': return item.assists
            case 'ppm': return item.games > 0 ? (item.points / item.games).toFixed(2) : '0.00'
            case 'wins': return item.wins || 0
            case 'defenses': return item.defenses || 0
            case 'attendance': return item.attendance || 0
            case 'streak': return item.streak || 0
            default: return item.points
        }
    }

    // Filter and sort data based on tab
    const filteredData = tab === 'ppm'
        ? data.filter(item => item.games >= 20).sort((a, b) => {
            const ppmA = a.games > 0 ? a.points / a.games : 0
            const ppmB = b.games > 0 ? b.points / b.games : 0
            return ppmB - ppmA
        })
        : data

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24">
            <h1 className={cn("text-2xl font-black mb-6 flex items-center gap-2",
                actualTheme === 'dark' ? "text-slate-100" : "text-slate-900"
            )}>
                <Trophy className="text-yellow-500" /> 시즌 랭킹
            </h1>

            {/* Tabs - Mobile Friendly Scrollable */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex-shrink-0",
                            tab === t.id
                                ? `${t.bg} ${t.color} shadow-sm ring-1 ring-inset ring-black/5`
                                : actualTheme === 'dark'
                                    ? "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
                                    : "bg-white text-slate-400 hover:bg-slate-50 border border-slate-100"
                        )}
                    >
                        <t.icon size={14} />
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="sm:hidden">{t.shortLabel}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className={cn("py-20 text-center animate-pulse",
                    actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                )}>
                    랭킹 집계 중...
                </div>
            ) : (
                <>
                    {/* Mobile Card View */}
                    {tab === 'ppm' && filteredData.length === 0 && (
                        <div className={cn("text-center py-10 text-sm",
                            actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                        )}>
                            20경기 이상 참석한 선수가 없습니다.
                        </div>
                    )}
                    {tab === 'ppm' && filteredData.length > 0 && (
                        <div className={cn("mb-3 text-xs p-2 rounded-lg text-center",
                            actualTheme === 'dark' ? "text-rose-400 bg-rose-900/30" : "text-slate-500 bg-rose-50"
                        )}>
                            ⚡ 20경기 이상 참석자 대상 | Points Per Match
                        </div>
                    )}
                    <div className="md:hidden space-y-2">
                        {filteredData.map((item, i) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "rounded-xl p-3 border shadow-sm flex items-center gap-3",
                                    actualTheme === 'dark'
                                        ? i < 3 ? "bg-slate-800 border-yellow-700/50" : "bg-slate-800 border-slate-700"
                                        : i < 3 ? "bg-white border-yellow-200" : "bg-white border-slate-100"
                                )}
                            >
                                {/* Rank Badge */}
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0",
                                    i === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/30" :
                                        i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white" :
                                            i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-600 text-white" :
                                                "bg-slate-100 text-slate-500"
                                )}>
                                    {i + 1}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className={cn("font-bold truncate flex items-center gap-1",
                                        actualTheme === 'dark' ? "text-slate-100" : "text-slate-900"
                                    )}>
                                        {item.name}
                                        {i === 0 && <span className="text-xs">👑</span>}
                                    </div>
                                    <div className={cn("text-xs truncate",
                                        actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                                    )}>
                                        {/* Show different stats based on tab */}
                                        {(tab === 'points' || tab === 'goals' || tab === 'assists') && (
                                            <>{item.games}경기 | G {item.goals} | A {item.assists}</>
                                        )}
                                        {tab === 'ppm' && (
                                            <>{item.games}경기 | {item.points}P | PPM {item.games > 0 ? (item.points / item.games).toFixed(2) : '0.00'}</>
                                        )}
                                        {tab === 'wins' && (
                                            <>{item.games}경기 | 1등 {item.wins || 0}회</>
                                        )}
                                        {tab === 'defenses' && (
                                            <>차단 {item.blocks || 0} | 클리어링 {item.clearances || 0} | 킬패스 {item.key_passes || 0}</>
                                        )}
                                        {tab === 'attendance' && (
                                            <>출석 {item.attendance || 0}회</>
                                        )}
                                        {tab === 'streak' && (
                                            <>최대 연속 {item.streak || 0}회</>
                                        )}
                                    </div>
                                </div>

                                {/* Main Stat */}
                                <div className={cn(
                                    "text-right flex-shrink-0 px-3 py-1.5 rounded-lg",
                                    actualTheme === 'dark' ? "bg-slate-700/50" : currentTab.bg
                                )}>
                                    <div className={cn("text-lg font-black", currentTab.color)}>
                                        {getMainStat(item)}
                                    </div>
                                    <div className={cn("text-[10px] uppercase",
                                        actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                                    )}>{currentTab.shortLabel}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className={cn("hidden md:block rounded-2xl shadow-sm border overflow-hidden",
                        actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                    )}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className={cn("border-b font-bold text-xs uppercase tracking-wider",
                                    actualTheme === 'dark' ? "bg-slate-900/50 border-slate-700 text-slate-400" : "bg-slate-50 border-slate-100 text-slate-500"
                                )}>
                                    <tr>
                                        <th className="px-3 py-3 w-10 text-center">#</th>
                                        <th className="px-3 py-3 text-left">선수</th>
                                        <th className="px-2 py-3 text-center">경기</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'goals' && (actualTheme === 'dark' ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-50 text-yellow-700")
                                        )}>득점</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'assists' && (actualTheme === 'dark' ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700")
                                        )}>도움</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'points' && (actualTheme === 'dark' ? "bg-orange-900/30 text-orange-400" : "bg-orange-50 text-orange-700")
                                        )}>공격P</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'ppm' && (actualTheme === 'dark' ? "bg-rose-900/30 text-rose-400" : "bg-rose-50 text-rose-700")
                                        )}>PPM</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'defenses' && (actualTheme === 'dark' ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-700")
                                        )}>수비</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'wins' && (actualTheme === 'dark' ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-50 text-emerald-700")
                                        )}>1등</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'attendance' && (actualTheme === 'dark' ? "bg-teal-900/30 text-teal-400" : "bg-teal-50 text-teal-700")
                                        )}>출석</th>
                                        <th className={cn("px-2 py-3 text-center",
                                            tab === 'streak' && (actualTheme === 'dark' ? "bg-pink-900/30 text-pink-400" : "bg-pink-50 text-pink-700")
                                        )}>연속</th>
                                    </tr>
                                </thead>
                                <tbody className={cn("divide-y",
                                    actualTheme === 'dark' ? "divide-slate-700" : "divide-slate-100"
                                )}>
                                    {filteredData.map((item, i) => (
                                        <tr key={item.id} className={cn("transition-colors",
                                            actualTheme === 'dark'
                                                ? i < 3 ? "bg-slate-900/30 hover:bg-slate-900/50" : "hover:bg-slate-900/30"
                                                : i < 3 ? "bg-slate-50/30 hover:bg-slate-50" : "hover:bg-slate-50"
                                        )}>
                                            <td className="px-3 py-3 text-center">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mx-auto",
                                                    i === 0 ? "bg-yellow-100 text-yellow-700" :
                                                        i === 1 ? "bg-slate-200 text-slate-700" :
                                                            i === 2 ? "bg-orange-100 text-orange-700" :
                                                                actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                                                )}>
                                                    {i + 1}
                                                </div>
                                            </td>
                                            <td className={cn("px-3 py-3 font-bold truncate max-w-[120px]",
                                                actualTheme === 'dark' ? "text-slate-100" : "text-slate-900"
                                            )}>
                                                {item.name}
                                                {i === 0 && <span className="ml-1 text-xs">👑</span>}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center",
                                                actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                                            )}>{item.games}</td>
                                            <td className={cn("px-2 py-3 text-center font-bold",
                                                tab === 'goals'
                                                    ? actualTheme === 'dark' ? "text-yellow-400 bg-yellow-900/20" : "text-slate-900 bg-yellow-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.goals}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold",
                                                tab === 'assists'
                                                    ? actualTheme === 'dark' ? "text-blue-400 bg-blue-900/20" : "text-slate-900 bg-blue-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.assists}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-extrabold",
                                                tab === 'points'
                                                    ? actualTheme === 'dark' ? "text-orange-400 bg-orange-900/20" : "text-orange-600 bg-orange-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.points}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold",
                                                tab === 'ppm'
                                                    ? actualTheme === 'dark' ? "text-rose-400 bg-rose-900/20" : "text-rose-600 bg-rose-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.games > 0 ? (item.points / item.games).toFixed(2) : '0.00'}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold",
                                                tab === 'defenses'
                                                    ? actualTheme === 'dark' ? "text-purple-400 bg-purple-900/20" : "text-purple-600 bg-purple-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.defenses || 0}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold",
                                                tab === 'wins'
                                                    ? actualTheme === 'dark' ? "text-emerald-400 bg-emerald-900/20" : "text-emerald-600 bg-emerald-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.wins || 0}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold",
                                                tab === 'attendance'
                                                    ? actualTheme === 'dark' ? "text-teal-400 bg-teal-900/20" : "text-teal-600 bg-teal-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.attendance || 0}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold",
                                                tab === 'streak'
                                                    ? actualTheme === 'dark' ? "text-pink-400 bg-pink-900/20" : "text-pink-600 bg-pink-50/50"
                                                    : actualTheme === 'dark' ? "text-slate-600" : "text-slate-300"
                                            )}>
                                                {item.streak || 0}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <tr>
                                            <td colSpan={11} className={cn("py-10 text-center",
                                                actualTheme === 'dark' ? "text-slate-500" : "text-slate-400"
                                            )}>
                                                {tab === 'ppm' ? '20경기 이상 참석한 선수가 없습니다.' : '데이터가 없습니다.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Empty State for Mobile */}
                    {data.length === 0 && (
                        <div className={cn("md:hidden py-10 text-center rounded-xl border",
                            actualTheme === 'dark' ? "text-slate-500 bg-slate-800 border-slate-700" : "text-slate-400 bg-white border-slate-100"
                        )}>
                            데이터가 없습니다.
                        </div>
                    )}

                    {/* Stats Summary */}
                    {data.length > 0 && (
                        <div className={cn("mt-4 p-4 rounded-xl border",
                            actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"
                        )}>
                            <div className={cn("flex items-center gap-2 text-sm",
                                actualTheme === 'dark' ? "text-slate-400" : "text-slate-500"
                            )}>
                                <TrendingUp size={14} />
                                <span>총 {data.length}명의 선수가 기록되어 있습니다.</span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
