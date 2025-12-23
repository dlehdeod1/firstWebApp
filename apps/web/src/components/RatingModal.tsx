import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'https://conerkicks-api.conerkicks.workers.dev'

interface Props {
    player: { id: number, name: string }
    sessionId?: number
    onClose: () => void
    onSaved?: () => void
}

const STATS = [
    { key: 'shooting', label: '슈팅', emoji: '🎯' },
    { key: 'offball_run', label: '무빙', emoji: '🏃' },
    { key: 'ball_keeping', label: '볼유지', emoji: '⚽' },
    { key: 'passing', label: '패스', emoji: '🎯' },
    { key: 'intercept', label: '인터셉트', emoji: '🛡️' },
    { key: 'marking', label: '마킹', emoji: '👤' },
    { key: 'stamina', label: '스태미나', emoji: '❤️' },
    { key: 'speed', label: '스피드', emoji: '⚡' },
]

export default function RatingModal({ player, sessionId, onClose, onSaved }: Props) {
    const [ratings, setRatings] = useState<Record<string, number>>({})
    const [comment, setComment] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Load existing rating
    useEffect(() => {
        const fetchMyRating = async () => {
            const token = localStorage.getItem('auth_token')
            if (!token) return

            setLoading(true)
            try {
                const res = await fetch(`${API_URL}/ratings/my/${player.id}${sessionId ? `?session_id=${sessionId}` : ''}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                const data = await res.json()
                if (data.rating) {
                    const r = data.rating
                    setRatings({
                        shooting: r.shooting,
                        offball_run: r.offball_run,
                        ball_keeping: r.ball_keeping,
                        passing: r.passing,
                        intercept: r.intercept,
                        marking: r.marking,
                        stamina: r.stamina,
                        speed: r.speed,
                    })
                    setComment(r.comment || '')
                }
            } catch (e) {
                console.error('Failed to load rating:', e)
            } finally {
                setLoading(false)
            }
        }
        fetchMyRating()
    }, [player.id, sessionId])

    const handleRatingChange = (stat: string, value: number) => {
        setRatings(prev => ({ ...prev, [stat]: value }))
    }

    const handleSubmit = async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            alert('로그인이 필요합니다')
            return
        }

        // Calculate overall as average
        const values = Object.values(ratings).filter(v => v > 0)
        const overall = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null

        setSaving(true)
        try {
            const res = await fetch(`${API_URL}/ratings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    player_id: player.id,
                    session_id: sessionId,
                    ...ratings,
                    overall,
                    comment
                })
            })

            if (res.ok) {
                alert('평가가 저장되었습니다!')
                onSaved?.()
                onClose()
            } else {
                const err = await res.json()
                alert(`평가 저장 실패: ${err.error || '알 수 없는 오류'}`)
            }
        } catch (e: any) {
            alert(`평가 저장 실패: ${e?.message || '네트워크 오류'}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-lg text-slate-900">선수 평가</h2>
                        <p className="text-sm text-slate-500">{player.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-400">로딩 중...</div>
                ) : (
                    <div className="p-4 space-y-4">
                        {/* Slider Ratings (0-100) */}
                        {STATS.map(stat => (
                            <div key={stat.key} className="flex items-center gap-3">
                                <span className="text-lg">{stat.emoji}</span>
                                <span className="text-sm font-medium text-slate-700 w-16">{stat.label}</span>
                                <div className="flex-1 flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={ratings[stat.key] || 50}
                                        onChange={(e) => handleRatingChange(stat.key, Number(e.target.value))}
                                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                    <span className={cn(
                                        "text-sm font-bold w-8 text-right",
                                        (ratings[stat.key] || 50) >= 70 ? "text-emerald-600" :
                                            (ratings[stat.key] || 50) >= 40 ? "text-amber-600" : "text-red-600"
                                    )}>
                                        {ratings[stat.key] || 50}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Comment */}
                        <div className="pt-4 border-t border-slate-100">
                            <label className="text-sm font-medium text-slate-700 block mb-2">코멘트 (선택)</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="선수에 대한 의견..."
                                className="w-full p-3 border border-slate-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                        >
                            {saving ? '저장 중...' : '평가 저장'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
