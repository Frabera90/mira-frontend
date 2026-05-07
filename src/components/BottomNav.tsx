import { LayoutDashboard, Package, Bot, ShoppingCart, Bell } from 'lucide-react'
import type { Page } from '../App'

const tabs: { id: Page; label: string; Icon: React.ElementType }[] = [
  { id: 'casa',       label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'magazzino',  label: 'Scorte',    Icon: Package },
  { id: 'assistente', label: 'MIRA',      Icon: Bot },
  { id: 'ordini',     label: 'Ordini',    Icon: ShoppingCart },
  { id: 'notifiche',  label: 'Avvisi',    Icon: Bell },
]

interface Props {
  active: Page
  onChange: (p: Page) => void
  badge?: number
}

export default function BottomNav({ active, onChange, badge = 0 }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-slate-200 flex z-50">
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors relative ${
              isActive ? 'text-terra' : 'text-slate-400'
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
            <span>{label}</span>
            {id === 'notifiche' && badge > 0 && (
              <span className="absolute top-1.5 right-[14%] bg-rose-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-terra rounded-full" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
