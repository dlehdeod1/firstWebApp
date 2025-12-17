import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
    text: string
    children: React.ReactNode
    align?: 'center' | 'right' | 'left'
}

export function Tooltip({ text, children, align = 'center' }: TooltipProps) {
    const [show, setShow] = useState(false)
    return (
        <div className="relative inline-flex items-center justify-center gap-1 cursor-help group"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onClick={(e) => {
                e.preventDefault()
                setShow(!show)
            }}
        >
            {children}
            {(show) && (
                <div className={cn(
                    "absolute top-full mt-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-xl border border-slate-700",
                    align === 'center' && "left-1/2 -translate-x-1/2",
                    align === 'right' && "right-0",
                    align === 'left' && "left-0"
                )}>
                    {text}
                    {/* Arrow */}
                    <div className={cn(
                        "absolute bottom-full -mb-1 border-4 border-transparent border-b-slate-800",
                        align === 'center' && "left-1/2 -translate-x-1/2",
                        align === 'right' && "right-3",
                        align === 'left' && "left-3"
                    )}></div>
                </div>
            )}
        </div>
    )
}
