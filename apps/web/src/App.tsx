import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Dashboard from '@/pages/Dashboard'
import SessionList from '@/pages/sessions/SessionList'
import SessionDetail from '@/pages/sessions/SessionDetail'
import MatchRecordPage from '@/pages/sessions/MatchRecordPage'
import SessionNew from '@/pages/admin/SessionNew'
import PlayerEditor from '@/pages/admin/PlayerEditor'
import LoginPage from '@/pages/login/LoginPage'
import SignupPage from '@/pages/login/SignupPage'
import MePage from '@/pages/MePage'
import RankingsPage from '@/pages/RankingsPage'

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const role = localStorage.getItem('user_role')
    const isAdmin = ['ADMIN', 'OWNER', 'admin', 'owner'].includes(role || '')
    return isAdmin ? <>{children}</> : <div className="p-20 text-center">접근 권한이 없습니다. (구단주 또는 관리자 로그인 필요)</div>
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/sessions" element={<SessionList />} />
                    <Route path="/sessions/:id" element={<SessionDetail />} />
                    <Route path="/sessions/:id/match/:matchId/record" element={<MatchRecordPage />} />
                    <Route path="/rankings" element={<RankingsPage />} />
                    <Route path="/me" element={<MePage />} />

                    {/* Admin Routes */}
                    <Route path="/sessions/new" element={<AdminRoute><SessionNew /></AdminRoute>} />
                    <Route path="/admin/players" element={<AdminRoute><PlayerEditor /></AdminRoute>} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App
