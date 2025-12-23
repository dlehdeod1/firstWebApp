import { useState, useEffect } from 'react'
import { Star, User, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import RatingModal from '@/components/RatingModal'

const API_URL = import.meta.env.VITE_API_URL || 'https://conerkicks-api.conerkicks.workers.dev'

interface Player {
    id: number
    name: string
    shooting?: number
    offball_run?: number
    ball_keeping?: number
    passing?: number
    intercept?: number
    marking?: number
    stamina?: number
    speed?: number
}

interface AggregatedRating {
    playerId: number
    playerName: string
    aggregated: {
        shooting?: number
        offball_run?: number
        ball_keeping?: number
        passing?: number
        intercept?: number
        marking?: number
        stamina?: number
        speed?: number
        overall?: number
    } | null
    count: number
    adminCount: number
    regularCount: number
}

export default function RatingsPage() {
    const [activeTab, setActiveTab] = useState<'summary' | 'my'>('summary')
    const [players, setPlayers] = useState<Player[]>([])
    const [aggregatedRatings, setAggregatedRatings] = useState<Record<number, AggregatedRating>>({})
    const [myRatedPlayerIds, setMyRatedPlayerIds] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(true)
    const [ratingPlayer, setRatingPlayer] = useState<Player | null>(null)

    const token = localStorage.getItem('auth_token')

    // Fetch all players
    useEffect(() => {
        fetchPlayers()
    }, [])

    // Fetch ratings based on tab
    useEffect(() => {
        if (activeTab === 'summary') {
            fetchAllRatings()
        } else {
            fetchMyRatings()
        }
    }, [activeTab, players])

    const fetchPlayers = async () => {
        try {
            const res = await fetch(`${API_URL}/players`)
            const data = await res.json()
            setPlayers(data || [])
        } catch (e) {
            console.error('Failed to fetch players:', e)
        } finally {
            setLoading(false)
        }
    }

    const fetchAllRatings = async () => {
        // Fetch aggregated ratings for all players
        const ratings: Record<number, AggregatedRating> = {}

        for (const player of players) {
            try {
                const res = await fetch(`${API_URL}/ratings/player/${player.id}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                })
                const data = await res.json()
                ratings[player.id] = {
                    playerId: player.id,
                    playerName: player.name,
                    aggregated: data.aggregated,
                    count: data.count || 0,
                    adminCount: data.adminCount || 0,
                    regularCount: data.regularCount || 0
                }
            } catch (e) {
                console.error(`Failed to fetch rating for player ${player.id}:`, e)
            }
        }

        setAggregatedRatings(ratings)
    }

    const fetchMyRatings = async () => {
        if (!token) return

        const ratedIds = new Set<number>()

        for (const player of players) {
            try {
                const res = await fetch(`${API_URL}/ratings/my/${player.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const data = await res.json()
                if (data.rating) {
                    ratedIds.add(player.id)
                }
            } catch (e) {
                console.error(`Failed to fetch my rating for player ${player.id}:`, e)
            }
        }

        setMyRatedPlayerIds(ratedIds)
    }

    const handleRatingSaved = () => {
        if (activeTab === 'summary') {
            fetchAllRatings()
        } else {
            fetchMyRatings()
        }
    }

    const STAT_LABELS: Record<string, { label: string, emoji: string }> = {
        shooting: { label: '슈팅', emoji: '🎯' },
        offball_run: { label: '무빙', emoji: '🏃' },
        ball_keeping: { label: '볼유지', emoji: '⚽' },
        passing: { label: '패스', emoji: '🎯' },
        intercept: { label: '인터셉트', emoji: '🛡️' },
        marking: { label: '마킹', emoji: '👤' },
        stamina: { label: '스태미나', emoji: '❤️' },
        speed: { label: '스피드', emoji: '⚡' },
    }

    const getStatColor = (value: number | undefined) => {
        if (value === undefined) return 'text-slate-400'
        if (value >= 70) return 'text-emerald-600'
        if (value >= 40) return 'text-amber-600'
        return 'text-red-600'
    }

    if (loading) {
        return <div className="p-8 text-center text-slate-400">로딩 중...</div>
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Star className="text-amber-500" size={28} />
                    선수 능력치 평가
                </h1>
                <p className="text-slate-500 mt-1">선수들의 능력치를 평가하고 종합 결과를 확인하세요.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={cn(
                        "px-4 py-2 rounded-xl font-bold transition-all",
                        activeTab === 'summary'
                            ? "bg-blue-600 text-white shadow-lg"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                >
                    📊 종합 (전체 평가)
                </button>
                <button
                    onClick={() => setActiveTab('my')}
                    className={cn(
                        "px-4 py-2 rounded-xl font-bold transition-all",
                        activeTab === 'my'
                            ? "bg-amber-500 text-white shadow-lg"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                >
                    ✏️ 내 평가
                </button>
            </div>

            {activeTab === 'summary' ? (
                /* Summary Tab */
                <div className="space-y-3">
                    <p className="text-sm text-slate-500 mb-4">
                        운영진 평가 50% + 일반 멤버 평가 50%로 계산된 종합 능력치입니다.
                    </p>
                    {players.map(player => {
                        const rating = aggregatedRatings[player.id]
                        const hasRating = rating && rating.count > 0

                        return (
                            <div key={player.id} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                            <User size={20} className="text-slate-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">{player.name}</h3>
                                            <p className="text-xs text-slate-400">
                                                {hasRating ? `${rating.count}명 평가 (운영진 ${rating.adminCount}, 멤버 ${rating.regularCount})` : '아직 평가 없음'}
                                            </p>
                                        </div>
                                    </div>
                                    {hasRating && rating.aggregated?.overall && (
                                        <div className={cn("text-2xl font-black", getStatColor(rating.aggregated.overall))}>
                                            {rating.aggregated.overall}
                                        </div>
                                    )}
                                </div>

                                {hasRating && rating.aggregated && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries(STAT_LABELS).map(([key, { label, emoji }]) => (
                                            <div key={key} className="text-center">
                                                <div className="text-xs text-slate-500">{emoji} {label}</div>
                                                <div className={cn("font-bold", getStatColor(rating.aggregated?.[key as keyof typeof rating.aggregated] as number))}>
                                                    {rating.aggregated?.[key as keyof typeof rating.aggregated] ?? '-'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* My Ratings Tab */
                <div className="space-y-3">
                    {!token ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                            <p className="text-amber-700 font-medium">로그인하면 선수들을 평가할 수 있습니다.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-500 mb-4">
                                선수를 클릭하여 능력치를 평가하세요. 평가 완료된 선수는 녹색으로 표시됩니다.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {players.map(player => {
                                    const isRated = myRatedPlayerIds.has(player.id)

                                    return (
                                        <button
                                            key={player.id}
                                            onClick={() => setRatingPlayer(player)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 transition-all text-left hover:shadow-md",
                                                isRated
                                                    ? "bg-emerald-50 border-emerald-200 hover:border-emerald-400"
                                                    : "bg-white border-slate-200 hover:border-blue-400"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                                        isRated ? "bg-emerald-100" : "bg-slate-100"
                                                    )}>
                                                        {isRated ? (
                                                            <Check size={16} className="text-emerald-600" />
                                                        ) : (
                                                            <User size={16} className="text-slate-400" />
                                                        )}
                                                    </div>
                                                    <span className={cn(
                                                        "font-bold",
                                                        isRated ? "text-emerald-700" : "text-slate-700"
                                                    )}>
                                                        {player.name}
                                                    </span>
                                                </div>
                                                {isRated && (
                                                    <span className="text-xs text-emerald-600 font-medium">평가완료</span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Rating Modal */}
            {ratingPlayer && (
                <RatingModal
                    player={ratingPlayer}
                    onClose={() => setRatingPlayer(null)}
                    onSaved={handleRatingSaved}
                />
            )}
        </div>
    )
}
