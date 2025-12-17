import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Pause, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Player {
    id: number
    name: string
}

interface Team {
    id: number
    name: string
    players: Player[]
}

interface Match {
    id: number
    match_no: number
    team1_id: number
    team2_id: number
    team1_score: number
    team2_score: number
}

interface EventLog {
    id: string
    time: number // elapsed seconds
    type: 'GOAL' | 'DEFENSE'
    playerId: number
    playerName: string
    teamId: number
    assisterId?: number
    assisterName?: string
}

export default function MatchRecordPage() {
    const { id: sessionId, matchId } = useParams()
    const navigate = useNavigate()

    const [match, setMatch] = useState<Match | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [actionMode, setActionMode] = useState<'goal' | 'assist' | 'defense' | null>(null)
    const [pendingGoal, setPendingGoal] = useState<{ scorerId: number, teamId: number, scorerName: string } | null>(null)

    // Timer state
    const [timerRunning, setTimerRunning] = useState(false)
    const [elapsedTime, setElapsedTime] = useState(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Event logs
    const [eventLogs, setEventLogs] = useState<EventLog[]>([])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`${API_URL}/sessions/${sessionId}`)
                const data = await res.json()

                const m = data.matches?.find((m: any) => m.id === Number(matchId))
                setMatch(m || null)
                setTeams(data.teams || [])
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [sessionId, matchId])

    // Timer effect
    useEffect(() => {
        if (timerRunning) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1)
            }, 1000)
        } else if (timerRef.current) {
            clearInterval(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [timerRunning])

    const formatTime = (seconds: number) => {
        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }

    const team1 = teams.find(t => t.id === match?.team1_id)
    const team2 = teams.find(t => t.id === match?.team2_id)

    const recordEvent = async (type: string, scorerId: number, teamId: number, scorerName: string, assisterId?: number, assisterName?: string) => {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token')

        // Add to local logs immediately
        const newLog: EventLog = {
            id: Date.now().toString(),
            time: elapsedTime,
            type: type as 'GOAL' | 'DEFENSE',
            playerId: scorerId,
            playerName: scorerName,
            teamId,
            assisterId,
            assisterName
        }
        setEventLogs(prev => [newLog, ...prev])

        // Optimistic update for goals
        if (type === 'GOAL') {
            setMatch(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    team1_score: teamId === prev.team1_id ? (prev.team1_score || 0) + 1 : (prev.team1_score || 0),
                    team2_score: teamId === prev.team2_id ? (prev.team2_score || 0) + 1 : (prev.team2_score || 0),
                }
            })
        }

        try {
            const res = await fetch(`${API_URL}/matches/${matchId}/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type, scorerId, teamId, assisterId })
            })

            if (!res.ok) {
                // Rollback
                setEventLogs(prev => prev.filter(e => e.id !== newLog.id))
                if (type === 'GOAL') {
                    setMatch(prev => {
                        if (!prev) return prev
                        return {
                            ...prev,
                            team1_score: teamId === prev.team1_id ? Math.max(0, (prev.team1_score || 0) - 1) : (prev.team1_score || 0),
                            team2_score: teamId === prev.team2_id ? Math.max(0, (prev.team2_score || 0) - 1) : (prev.team2_score || 0),
                        }
                    })
                }
                alert('Í∏∞Î°ù ?§Ìå®')
            }
        } catch (e) {
            console.error(e)
            setEventLogs(prev => prev.filter(el => el.id !== newLog.id))
            if (type === 'GOAL') {
                setMatch(prev => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        team1_score: teamId === prev.team1_id ? Math.max(0, (prev.team1_score || 0) - 1) : (prev.team1_score || 0),
                        team2_score: teamId === prev.team2_id ? Math.max(0, (prev.team2_score || 0) - 1) : (prev.team2_score || 0),
                    }
                })
            }
            alert('Í∏∞Î°ù ?§Ìå®')
        }
    }

    const deleteEvent = async (log: EventLog) => {
        if (!confirm(`${log.playerName}??${log.type === 'GOAL' ? 'Í≥? : '?∏ÏàòÎπ?} Í∏∞Î°ù????†ú?òÏãúÍ≤†Ïäµ?àÍπå?`)) return

        // Remove from local logs
        setEventLogs(prev => prev.filter(e => e.id !== log.id))

        // Rollback score for goals
        if (log.type === 'GOAL') {
            setMatch(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    team1_score: log.teamId === prev.team1_id ? Math.max(0, (prev.team1_score || 0) - 1) : (prev.team1_score || 0),
                    team2_score: log.teamId === prev.team2_id ? Math.max(0, (prev.team2_score || 0) - 1) : (prev.team2_score || 0),
                }
            })

            // TODO: Call API to delete event from database
            // For now, just update local state (DB will be updated when session closes)
        }
    }

    const handlePlayerClick = (player: Player, teamId: number) => {
        if (actionMode === 'goal') {
            setPendingGoal({ scorerId: player.id, teamId, scorerName: player.name })
            setActionMode('assist')
        } else if (actionMode === 'assist' && pendingGoal) {
            recordEvent('GOAL', pendingGoal.scorerId, pendingGoal.teamId, pendingGoal.scorerName, player.id, player.name)
            setPendingGoal(null)
            setActionMode(null)
        } else if (actionMode === 'defense') {
            recordEvent('DEFENSE', player.id, teamId, player.name)
            setActionMode(null)
        }
    }

    const handleGoalWithoutAssist = () => {
        if (pendingGoal) {
            recordEvent('GOAL', pendingGoal.scorerId, pendingGoal.teamId, pendingGoal.scorerName)
            setPendingGoal(null)
            setActionMode(null)
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-slate-400">Î°úÎî© Ï§?..</div>
        </div>
    )
    if (!match) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-slate-400">Í≤ΩÍ∏∞Î•?Ï∞æÏùÑ ???ÜÏäµ?àÎã§.</div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-100 pb-28">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/sessions/${sessionId}`)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div className="flex-1">
                        <div className="text-xs text-slate-400 font-medium">#{match.match_no}Í≤ΩÍ∏∞</div>
                        <div className="font-bold text-slate-900">{team1?.name} vs {team2?.name}</div>
                    </div>
                    {/* Timer */}
                    <div className="flex items-center gap-2">
                        <div className="text-2xl font-mono font-bold text-slate-700 tabular-nums">
                            {formatTime(elapsedTime)}
                        </div>
                        <button
                            onClick={() => setTimerRunning(!timerRunning)}
                            className={cn(
                                "p-2 rounded-full transition-colors",
                                timerRunning
                                    ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                                    : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                            )}
                        >
                            {timerRunning ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
                {/* Score Display */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 text-center">
                            <div className="text-5xl font-black tabular-nums">{match.team1_score ?? 0}</div>
                            <div className="text-xs text-slate-400 mt-1 font-medium">{team1?.name}</div>
                        </div>
                        <div className="px-4">
                            <span className="text-2xl font-bold text-slate-500">vs</span>
                        </div>
                        <div className="flex-1 text-center">
                            <div className="text-5xl font-black tabular-nums">{match.team2_score ?? 0}</div>
                            <div className="text-xs text-slate-400 mt-1 font-medium">{team2?.name}</div>
                        </div>
                    </div>
                </div>

                {/* Action Mode Indicator */}
                {actionMode && (
                    <div className={cn(
                        "p-3 rounded-2xl text-center font-bold shadow-sm text-sm",
                        actionMode === 'goal' && "bg-emerald-500 text-white",
                        actionMode === 'assist' && "bg-amber-500 text-white",
                        actionMode === 'defense' && "bg-violet-500 text-white"
                    )}>
                        {actionMode === 'goal' && "???ùÏ†ê?êÎ? ?†ÌÉù?òÏÑ∏??}
                        {actionMode === 'assist' && (
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                <span>?Ö∞Ô∏?{pendingGoal?.scorerName} Í≥????¥Ïãú?§Ìä∏?</span>
                                <button
                                    onClick={handleGoalWithoutAssist}
                                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs"
                                >
                                    ?ÜÏùå
                                </button>
                            </div>
                        )}
                        {actionMode === 'defense' && "?õ°Ô∏??∏ÏàòÎπ??†ÏàòÎ•??†ÌÉù?òÏÑ∏??}
                    </div>
                )}

                {/* Teams Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Team 1 */}
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                            <h3 className="font-bold text-slate-800 text-xs">{team1?.name}</h3>
                        </div>
                        <div className="space-y-1.5">
                            {team1?.players?.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handlePlayerClick(p, team1.id)}
                                    disabled={!actionMode}
                                    className={cn(
                                        "w-full px-2 py-2 rounded-lg text-xs font-medium text-center transition-all border",
                                        actionMode
                                            ? "bg-red-50 border-red-100 text-red-900 hover:bg-red-100 active:scale-95"
                                            : "bg-slate-50 border-slate-100 text-slate-400",
                                        pendingGoal?.scorerId === p.id && "ring-2 ring-amber-400 bg-amber-50"
                                    )}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Team 2 */}
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                            <h3 className="font-bold text-slate-800 text-xs">{team2?.name}</h3>
                        </div>
                        <div className="space-y-1.5">
                            {team2?.players?.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handlePlayerClick(p, team2.id)}
                                    disabled={!actionMode}
                                    className={cn(
                                        "w-full px-2 py-2 rounded-lg text-xs font-medium text-center transition-all border",
                                        actionMode
                                            ? "bg-blue-50 border-blue-100 text-blue-900 hover:bg-blue-100 active:scale-95"
                                            : "bg-slate-50 border-slate-100 text-slate-400",
                                        pendingGoal?.scorerId === p.id && "ring-2 ring-amber-400 bg-amber-50"
                                    )}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Event Logs */}
                {eventLogs.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                            ?ìã Í∏∞Î°ù Î°úÍ∑∏
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {eventLogs.map(log => (
                                <div key={log.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 font-mono text-xs">{formatTime(log.time)}</span>
                                        <span className="font-medium text-slate-800">{log.playerName}</span>
                                        <span>{log.type === 'GOAL' ? '?? : '?õ°Ô∏?}</span>
                                        {log.assisterName && (
                                            <span className="text-slate-500 text-xs">??{log.assisterName}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => deleteEvent(log)}
                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-2xl">
                <div className="max-w-lg mx-auto p-4 grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            setActionMode(actionMode === 'goal' || actionMode === 'assist' ? null : 'goal')
                            setPendingGoal(null)
                        }}
                        className={cn(
                            "py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                            actionMode === 'goal' || actionMode === 'assist'
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        )}
                    >
                        <span className="text-lg">??/span> Í≥?Í∏∞Î°ù
                    </button>
                    <button
                        onClick={() => {
                            setActionMode(actionMode === 'defense' ? null : 'defense')
                            setPendingGoal(null)
                        }}
                        className={cn(
                            "py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                            actionMode === 'defense'
                                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                                : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                        )}
                    >
                        <span className="text-lg">?õ°Ô∏?/span> ?∏ÏàòÎπ?
                    </button>
                </div>
            </div>
        </div>
    )
}


