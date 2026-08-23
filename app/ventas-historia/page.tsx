'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [businessId, setBusinessId] = useState<string>('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  
  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('sales_history_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('sales_history_theme', newMode ? 'dark' : 'light')
  }
  
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any[] | null>(null)
  const router = useRouter()

  useEffect(() => {
    const bizStr = localStorage.getItem('currentBusiness')
    const staffStr = localStorage.getItem('currentStaff')

    if (staffStr) {
      try {
        const staff = JSON.parse(staffStr)
        if (staff.business_id && staff.branch_id) {
          setIsStaff(true)
          setBusinessId(staff.business_id)
          setBranchId(staff.branch_id)
          loadHistorySales(staff.business_id, selectedDate, staff.branch_id)
          return
        }
      } catch (e) {}
    }

    if (bizStr) {
      try {
        const biz = JSON.parse(bizStr)
        const bId = biz.id || biz.business_id
        if (bId) {
          setIsStaff(false)
          setBusinessId(bId)
          setBranchId(null)
          loadHistorySales(bId, selectedDate, null)
          return
        }
      } catch (e) {}
    }

    router.push('/')
  }, [router, selectedDate])

  async function loadHistorySales(bId: string, dateStr: string, bIdFilter: string | null) {
    console.log("Cargando historial para:", { bId, dateStr, bIdFilter })
    const { data, error } = await supabase.rpc('get_sales_by_date_filtered', {
      p_business_id: bId,
      p_date: dateStr,
      p_branch_id: bIdFilter
    })
    
    if (error) {
      console.error("Error al cargar historial de ventas:", error.message)
      setSales([])
      return
    }

    if (data) {
      console.log("Ventas encontradas:", data)
      setSales(data)
    } else {
      setSales([])
    }
  }

  async function handleViewSaleDetails(saleId: string) {
    const { data, error } = await supabase.rpc('get_sale_details', {
      p_sale_id: saleId
    })
    if (!error && data) {
      setSelectedSaleDetails(data)
    } else {
      alert("Error al cargar los detalles de la venta.")
    }
  }

  const totalFilteredSales = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)

  // Clases dinámicas según el tema (Modo Oscuro vs Modo Claro)
  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-8 flex flex-col notranslate ${themeBg}`} translate="no">
      <header className={`p-4 rounded-lg shadow mb-6 flex justify-between items-center border ${panelBg}`}>
        <div>
          <h1 className="text-xl font-bold text-emerald-500">Historial y Ventas por Día</h1>
          {isStaff && <p className="text-xs text-amber-500 mt-0.5 font-medium">🔍 Vista restringida a tu sucursal asignada</p>}
        </div>
        
        <div className="flex items-center gap-2">
          {/* BOTÓN INTERRUPTOR DE TEMA (CLARO / OSCURO) */}
          <button 
            onClick={toggleTheme}
            className={`px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors border ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-amber-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'}`}
          >
            {isDarkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>

          <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-semibold text-sm text-white">
            ← Volver al POS
          </button>
        </div>
      </header>

      <div className={`p-6 rounded-lg shadow border space-y-6 ${panelBg}`}>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <label className="block text-xs opacity-75 mb-1">Seleccionar Fecha</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className={`border px-3 py-2 rounded text-sm outline-none focus:border-emerald-500 font-semibold ${inputBg}`}
            />
          </div>

          <div className={`px-5 py-3 rounded-lg border border-emerald-500/40 flex items-center gap-6 ${subPanelBg}`}>
            <div>
              <p className="text-[10px] opacity-75 uppercase tracking-wider">Total Fecha Seleccionada</p>
              <p className="text-lg font-extrabold text-emerald-500" translate="no">Q {totalFilteredSales}</p>
            </div>
            <div className="border-l border-opacity-50 pl-6">
              <p className="text-[10px] opacity-75 uppercase tracking-wider">Transacciones</p>
              <p className="text-lg font-bold">{sales.length}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {sales.length === 0 ? (
            <p className="opacity-75 text-center py-12">No hay ventas registradas para esta fecha en esta sucursal.</p>
          ) : (
            sales.map(sale => (
              <div 
                key={sale.sale_id} 
                onClick={() => handleViewSaleDetails(sale.sale_id)}
                className={`p-4 rounded-lg border hover:border-emerald-500 cursor-pointer transition-all flex justify-between items-center shadow ${subPanelBg}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold">NIT: {sale.customer_nit}</span>
                    <span className="text-xs opacity-75">({sale.customer_name})</span>
                  </div>
                  <p className="text-xs text-amber-500 font-medium">Sucursal: {sale.branch_name}</p>
                  <p className="text-[10px] opacity-75">Hora: {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Pago: <span className="uppercase opacity-85">{sale.payment_method}</span></p>
                </div>
                <span className="text-lg font-extrabold text-emerald-500" translate="no">Q {sale.total_amount}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 9999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-[420px] shadow-2xl ${panelBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-emerald-500">📦 Detalle de la Venta</h3>
              <button onClick={() => setSelectedSaleDetails(null)} className="font-bold text-sm opacity-75 hover:opacity-100">✕</button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
              {selectedSaleDetails.map((item, idx) => (
                <div key={idx} className={`p-2.5 rounded border flex justify-between items-center ${subPanelBg}`}>
                  <div>
                    <p className="font-semibold">{item.product_name}</p>
                    <p className="text-[10px] opacity-75">Cantidad: <span className="text-emerald-500 font-bold">{item.quantity}</span> x Q {item.price}</p>
                  </div>
                  <span className="font-bold text-emerald-500 text-sm" translate="no">Q {item.quantity * item.price}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedSaleDetails(null)} className="mt-6 w-full bg-slate-600 hover:bg-slate-500 text-white py-2.5 rounded-lg font-semibold text-xs">
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  )
}