import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Pause, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'https://conerkicks-api.conerkicks.workers.dev'

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
    status?: string
}

interface EventLog {
    id: string
    time: number // elapsed seconds
    type: 'GOAL' | 'KEY_PASS' | 'BLOCK' | 'CLEARANCE' | 'DEFENSE'
    playerId: number
    playerName: string
    teamId: number
    assisterId?: number
    assisterName?: string
    recordedBy?: string // username of who recorded this event
}

export default function MatchRecordPage() {
    const { id: sessionId, matchId } = useParams()
    const navigate = useNavigate()

    const [match, setMatch] = useState<Match | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [loading, setLoading] = useState(true)
    const [actionMode, setActionMode] = useState<'goal' | 'assist' | 'key_pass' | 'block' | 'clearance' | null>(null)
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

                // Load saved events from DB
                const eventsRes = await fetch(`${API_URL}/matches/${matchId}/events`)
                const eventsData = await eventsRes.json()
                if (eventsData.events && eventsData.events.length > 0) {
                    setEventLogs(eventsData.events.map((e: any) => ({
                        id: e.id.toString(),
                        time: e.time || 0,
                        type: e.type,
                        playerId: e.playerId,
                        playerName: e.playerName,
                        teamId: e.teamId,
                        assisterId: e.assisterId,
                        assisterName: e.assisterName
                    })))
                }
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
            type: type as 'GOAL' | 'KEY_PASS' | 'BLOCK' | 'CLEARANCE',
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
                body: JSON.stringify({ type, scorerId, teamId, assisterId, eventTime: elapsedTime })
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
                // Get detailed error from API
                const errData = await res.json().catch(() => ({}))
                console.error('API Error:', res.status, errData)
                alert(`기록 실패: ${errData.error || res.statusText}${errData.details ? ` (${errData.details})` : ''}`)
            } else {
                // Success - update recordedBy from API response
                const data = await res.json().catch(() => ({}))
                if (data.recordedBy) {
                    setEventLogs(prev => prev.map(e =>
                        e.id === newLog.id ? { ...e, recordedBy: data.recordedBy } : e
                    ))
                }
            }
        } catch (e: any) {
            console.error('Network/Parse error:', e)
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
            alert(`기록 실패: ${e?.message || '네트워크 오류'}`)
        }
    }

    const deleteEvent = async (log: EventLog) => {
        const typeLabels: Record<string, string> = { GOAL: '골', KEY_PASS: '킬패스', BLOCK: '차단', CLEARANCE: '클리어링' }
        if (!confirm(`${log.playerName}의 ${typeLabels[log.type] || log.type} 기록을 삭제하시겠습니까?`)) return

        const token = localStorage.getItem('auth_token') || localStorage.getItem('token')

        // Optimistic update - remove from local logs
        setEventLogs(prev => prev.filter(e => e.id !== log.id))

        // Optimistic update - rollback score for goals
        if (log.type === 'GOAL') {
            setMatch(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    team1_score: log.teamId === prev.team1_id ? Math.max(0, (prev.team1_score || 0) - 1) : (prev.team1_score || 0),
                    team2_score: log.teamId === prev.team2_id ? Math.max(0, (prev.team2_score || 0) - 1) : (prev.team2_score || 0),
                }
            })
        }

        // Call API to delete event from database
        try {
            const res = await fetch(`${API_URL}/matches/${matchId}/events`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: log.type,
                    scorerId: log.playerId,
                    teamId: log.teamId,
                    assisterId: log.assisterId
                })
            })

            if (!res.ok) {
                // Rollback - re-add to logs
                setEventLogs(prev => [log, ...prev])
                if (log.type === 'GOAL') {
                    setMatch(prev => {
                        if (!prev) return prev
                        return {
                            ...prev,
                            team1_score: log.teamId === prev.team1_id ? (prev.team1_score || 0) + 1 : (prev.team1_score || 0),
                            team2_score: log.teamId === prev.team2_id ? (prev.team2_score || 0) + 1 : (prev.team2_score || 0),
                        }
                    })
                }
                const errData = await res.json().catch(() => ({}))
                alert(`삭제 실패: ${errData.error || res.statusText}`)
            }
        } catch (e: any) {
            console.error('Delete event error:', e)
            // Rollback
            setEventLogs(prev => [log, ...prev])
            if (log.type === 'GOAL') {
                setMatch(prev => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        team1_score: log.teamId === prev.team1_id ? (prev.team1_score || 0) + 1 : (prev.team1_score || 0),
                        team2_score: log.teamId === prev.team2_id ? (prev.team2_score || 0) + 1 : (prev.team2_score || 0),
                    }
                })
            }
            alert(`삭제 실패: ${e?.message || '네트워크 오류'}`)
        }
    }

    // handlePlayerClick removed - now using direct attack/defense section clicks

    const resetMatch = async () => {
        if (!confirm('⚠️ 이 경기의 모든 기록(로그, 점수)을 초기화하시겠습니까?\n(되돌릴 수 없습니다)')) return

        const token = localStorage.getItem('auth_token') || localStorage.getItem('token')

        try {
            const res = await fetch(`${API_URL}/matches/${matchId}/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (res.ok) {
                setEventLogs([])
                setMatch(prev => prev ? { ...prev, team1_score: 0, team2_score: 0 } : prev)
                setElapsedTime(0)
                setTimerRunning(false)
                alert('✅ 경기 기록이 초기화되었습니다.')
            } else {
                const err = await res.json().catch(() => ({}))
                alert(`초기화 실패: ${err.error || res.statusText}`)
            }
        } catch (e: any) {
            alert(`초기화 실패: ${e?.message || '네트워크 오류'}`)
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
            <div className="text-slate-400">로딩 중...</div>
        </div>
    )
    if (!match) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-slate-400">경기를 찾을 수 없습니다.</div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-100 pb-28">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/sessions/${sessionId}?tab=scoreboard`)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div className="flex-1">
                        <div className="text-xs text-slate-400 font-medium">#{match.match_no}경기</div>
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
                        <button
                            onClick={resetMatch}
                            className="p-2 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
                            title="경기 초기화"
                        >
                            🔄
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
                            <div className="text-xs text-slate-400 mt-1 font-medium truncate max-w-[120px] mx-auto">{team1?.name}</div>
                        </div>
                        <div className="px-4">
                            <span className="text-2xl font-bold text-slate-500">vs</span>
                        </div>
                        <div className="flex-1 text-center">
                            <div className="text-5xl font-black tabular-nums">{match.team2_score ?? 0}</div>
                            <div className="text-xs text-slate-400 mt-1 font-medium truncate max-w-[120px] mx-auto">{team2?.name}</div>
                        </div>
                    </div>
                </div>

                {/* Match Complete Button */}
                <button
                    onClick={async () => {
                        const token = localStorage.getItem('auth_token') || localStorage.getItem('token')
                        try {
                            const res = await fetch(`${API_URL}/matches/${matchId}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ status: 'completed' })
                            })
                            if (res.ok) {
                                // Update local match state
                                setMatch(prev => prev ? { ...prev, status: 'completed' } : prev)
                                alert('경기가 완료 처리되었습니다!')
                                navigate(`/sessions/${sessionId}?tab=scoreboard`)
                            } else {
                                alert('경기 완료 처리 실패')
                            }
                        } catch (e) {
                            console.error(e)
                            alert('경기 완료 처리 실패')
                        }
                    }}
                    disabled={match.status === 'completed'}
                    className={cn(
                        "w-full py-3 rounded-xl font-bold text-sm transition-colors",
                        match.status === 'completed'
                            ? "bg-green-100 text-green-600 cursor-default"
                            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                    )}
                >
                    {match.status === 'completed' ? '✅ 경기 완료됨' : '🏁 경기 완료 처리'}
                </button>

                {/* Action Mode Indicator */}
                {actionMode && (
                    <div className={cn(
                        "p-3 rounded-2xl text-center font-bold shadow-sm text-sm",
                        actionMode === 'goal' && "bg-emerald-500 text-white",
                        actionMode === 'assist' && "bg-amber-500 text-white",
                        actionMode === 'key_pass' && "bg-orange-500 text-white",
                        actionMode === 'block' && "bg-violet-500 text-white",
                        actionMode === 'clearance' && "bg-blue-500 text-white"
                    )}>
                        {actionMode === 'goal' && "⚽ 득점자를 선택하세요"}
                        {actionMode === 'assist' && (
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                <span>🅰️ {pendingGoal?.scorerName} 골 → 어시스트?</span>
                                <button
                                    onClick={handleGoalWithoutAssist}
                                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs"
                                >
                                    없음
                                </button>
                            </div>
                        )}
                        {actionMode === 'key_pass' && "⚡ 킬패스 선수를 선택하세요"}
                        {actionMode === 'block' && "🛡️ 차단 선수를 선택하세요"}
                        {actionMode === 'clearance' && "🧹 클리어링 선수를 선택하세요"}
                    </div>
                )}

                {/* Teams with Attack/Defense Sections */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Team 1 */}
                    <div className="space-y-3">
                        {/* Team Header */}
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{team1?.name}</h3>
                        </div>

                        {/* Attack Section */}
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-3 border border-emerald-100">
                            <div className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1">
                                ⚽ 공격
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {team1?.players?.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            if (actionMode === 'assist' && pendingGoal) {
                                                recordEvent('GOAL', pendingGoal.scorerId, pendingGoal.teamId, pendingGoal.scorerName, p.id, p.name)
                                                setActionMode(null)
                                                setPendingGoal(null)
                                            } else {
                                                setActionMode('assist')
                                                setPendingGoal({ scorerId: p.id, teamId: team1.id, scorerName: p.name })
                                            }
                                        }}
                                        className={cn(
                                            "px-2 py-2 rounded-lg text-xs font-bold text-center transition-all",
                                            pendingGoal?.scorerId === p.id
                                                ? "bg-amber-400 text-white ring-2 ring-amber-500"
                                                : "bg-white text-emerald-800 hover:bg-emerald-100 active:scale-95 shadow-sm"
                                        )}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                            {actionMode === 'assist' && pendingGoal?.teamId === team1?.id && (
                                <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg flex items-center justify-between">
                                    <span>🎯 {pendingGoal!.scorerName} 골! 어시?</span>
                                    <button
                                        onClick={() => {
                                            if (!pendingGoal) return
                                            recordEvent('GOAL', pendingGoal.scorerId, pendingGoal.teamId, pendingGoal.scorerName)
                                            setActionMode(null)
                                            setPendingGoal(null)
                                        }}
                                        className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 rounded text-amber-800 font-bold"
                                    >
                                        없음
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Defense Section */}
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-3 border border-violet-100">
                            <div className="text-xs font-bold text-violet-700 mb-2 flex items-center gap-1">
                                🛡️ 수비
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {team1?.players?.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => recordEvent('DEFENSE', p.id, team1.id, p.name)}
                                        className="px-2 py-2 rounded-lg text-xs font-bold text-center bg-white text-violet-800 hover:bg-violet-100 active:scale-95 transition-all shadow-sm"
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Team 2 */}
                    <div className="space-y-3">
                        {/* Team Header */}
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{team2?.name}</h3>
                        </div>

                        {/* Attack Section */}
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-3 border border-emerald-100">
                            <div className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1">
                                ⚽ 공격
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {team2?.players?.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            if (actionMode === 'assist' && pendingGoal) {
                                                recordEvent('GOAL', pendingGoal.scorerId, pendingGoal.teamId, pendingGoal.scorerName, p.id, p.name)
                                                setActionMode(null)
                                                setPendingGoal(null)
                                            } else {
                                                setActionMode('assist')
                                                setPendingGoal({ scorerId: p.id, teamId: team2.id, scorerName: p.name })
                                            }
                                        }}
                                        className={cn(
                                            "px-2 py-2 rounded-lg text-xs font-bold text-center transition-all",
                                            pendingGoal?.scorerId === p.id
                                                ? "bg-amber-400 text-white ring-2 ring-amber-500"
                                                : "bg-white text-emerald-800 hover:bg-emerald-100 active:scale-95 shadow-sm"
                                        )}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                            {actionMode === 'assist' && pendingGoal?.teamId === team2?.id && (
                                <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg flex items-center justify-between">
                                    <span>🎯 {pendingGoal!.scorerName} 골! 어시?</span>
                                    <button
                                        onClick={() => {
                                            if (!pendingGoal) return
                                            recordEvent('GOAL', pendingGoal.scorerId, pendingGoal.teamId, pendingGoal.scorerName)
                                            setActionMode(null)
                                            setPendingGoal(null)
                                        }}
                                        className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 rounded text-amber-800 font-bold"
                                    >
                                        없음
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Defense Section */}
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-3 border border-violet-100">
                            <div className="text-xs font-bold text-violet-700 mb-2 flex items-center gap-1">
                                🛡️ 수비
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {team2?.players?.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => recordEvent('DEFENSE', p.id, team2.id, p.name)}
                                        className="px-2 py-2 rounded-lg text-xs font-bold text-center bg-white text-violet-800 hover:bg-violet-100 active:scale-95 transition-all shadow-sm"
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Event Logs - Team Aligned */}
                {eventLogs.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                            📋 기록 로그
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {eventLogs.map(log => {
                                const isTeam1 = log.teamId === team1?.id
                                const icon = log.type === 'GOAL' ? '⚽' : log.type === 'KEY_PASS' ? '⚡' : log.type === 'DEFENSE' ? '🛡️' : log.type === 'BLOCK' ? '🛡️' : '🧹'

                                return (
                                    <div key={log.id} className="flex items-center gap-2 text-sm">
                                        {/* Team 1 Side */}
                                        <div className={cn(
                                            "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg",
                                            isTeam1 ? "bg-red-50 justify-end" : "opacity-0"
                                        )}>
                                            {isTeam1 && (
                                                <>
                                                    {log.assisterName && (
                                                        <span className="text-slate-500 text-xs">{log.assisterName} →</span>
                                                    )}
                                                    <span className="font-bold text-red-800">{log.playerName}</span>
                                                    <span className="text-slate-400 font-mono text-xs">{formatTime(log.time)}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* Center Icon */}
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg shadow-sm">
                                            {icon}
                                        </div>

                                        {/* Team 2 Side */}
                                        <div className={cn(
                                            "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg",
                                            !isTeam1 ? "bg-blue-50 justify-start" : "opacity-0"
                                        )}>
                                            {!isTeam1 && (
                                                <>
                                                    <span className="text-slate-400 font-mono text-xs">{formatTime(log.time)}</span>
                                                    <span className="font-bold text-blue-800">{log.playerName}</span>
                                                    {log.assisterName && (
                                                        <span className="text-slate-500 text-xs">← {log.assisterName}</span>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Delete Button */}
                                        <button
                                            onClick={() => deleteEvent(log)}
                                            className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed Bottom Bar - Simple */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-2xl">
                <div className="max-w-lg mx-auto p-4">
                    <button
                        onClick={() => navigate(`/sessions/${sessionId}?tab=scoreboard`)}
                        className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        ← 현황판으로 돌아가기
                    </button>
                </div>
            </div>
        </div>
    )
}
