import { useState, useRef } from 'react'
import { X, Download, Share2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import { cn } from '@/lib/utils'

interface ShareCardProps {
    type: 'match' | 'standings' | 'teams'
    sessionDate: string
    data: any
    onClose: () => void
}

export default function ShareCard({ type, sessionDate, data, onClose }: ShareCardProps) {
    const cardRef = useRef<HTMLDivElement>(null)
    const [downloading, setDownloading] = useState(false)

    const handleDownload = async () => {
        if (!cardRef.current) return
        setDownloading(true)

        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                backgroundColor: '#0f172a',
                useCORS: true
            })

            const link = document.createElement('a')
            link.download = `cornerkicks_${sessionDate}_${type}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (e) {
            console.error('Download failed:', e)
            alert('이미지 저장 실패')
        } finally {
            setDownloading(false)
        }
    }

    const handleShare = async () => {
        if (!cardRef.current) return

        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                backgroundColor: '#0f172a',
                useCORS: true
            })

            canvas.toBlob(async (blob) => {
                if (!blob) return

                if (navigator.share) {
                    const file = new File([blob], `cornerkicks_${sessionDate}.png`, { type: 'image/png' })
                    await navigator.share({
                        files: [file],
                        title: '코너킥스 경기 결과',
                        text: `${sessionDate} 경기 결과입니다!`
                    })
                } else {
                    // Fallback to download
                    handleDownload()
                }
            })
        } catch (e) {
            console.error('Share failed:', e)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white font-bold text-lg">📤 공유 카드</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Card Preview */}
                <div
                    ref={cardRef}
                    className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 rounded-2xl p-6 text-white"
                >
                    {/* Brand Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">⚽</span>
                            <span className="font-black text-lg">
                                <span className="text-emerald-400">Corner</span>
                                <span className="text-amber-400">K</span>
                                <span className="text-blue-400">i</span>
                                <span className="text-emerald-400">cks</span>
                            </span>
                        </div>
                        <span className="text-sm text-slate-400 font-medium">{sessionDate}</span>
                    </div>

                    {/* Content based on type */}
                    {type === 'standings' && data.standings && (
                        <div className="space-y-3">
                            <h3 className="font-bold text-center text-lg mb-4 text-emerald-300">🏆 오늘의 결과</h3>
                            {data.standings.map((team: any, i: number) => (
                                <div key={team.id} className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl",
                                    i === 0 ? "bg-yellow-500/20 border border-yellow-500/30" :
                                        i === 1 ? "bg-slate-500/20 border border-slate-500/30" :
                                            "bg-slate-700/30"
                                )}>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                                        i === 0 ? "bg-yellow-500 text-yellow-900" :
                                            i === 1 ? "bg-slate-400 text-slate-900" :
                                                "bg-orange-600 text-white"
                                    )}>
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                    </div>
                                    <span className="flex-1 font-bold">{team.name}</span>
                                    <div className="text-right">
                                        <div className="font-black text-xl text-emerald-400">{team.points}</div>
                                        <div className="text-xs text-slate-400">{team.won}승 {team.drawn}무 {team.lost}패</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {type === 'teams' && data.teams && (
                        <div className="space-y-3">
                            <h3 className="font-bold text-center text-lg mb-4 text-blue-300">⚽ 오늘의 팀 구성</h3>
                            {data.teams.map((team: any, i: number) => (
                                <div key={team.id} className={cn(
                                    "p-3 rounded-xl border",
                                    i === 0 ? "bg-red-500/10 border-red-500/30" :
                                        i === 1 ? "bg-blue-500/10 border-blue-500/30" :
                                            "bg-emerald-500/10 border-emerald-500/30"
                                )}>
                                    <div className="font-bold text-sm mb-2">{team.name}</div>
                                    <div className="text-xs text-slate-300 flex flex-wrap gap-1">
                                        {team.players?.map((p: any) => (
                                            <span key={p.id} className="bg-white/10 px-2 py-0.5 rounded">
                                                {p.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-700 text-center">
                        <p className="text-xs text-slate-500">코너킥스 풋살 동호회</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        <Download size={18} />
                        {downloading ? '저장 중...' : '이미지 저장'}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                        <Share2 size={18} />
                        공유하기
                    </button>
                </div>
            </div>
        </div>
    )
}
