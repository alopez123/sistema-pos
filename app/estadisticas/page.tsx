'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function EstadisticasPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string>('')
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL')
  
  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('stats_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('stats_theme', newMode ? 'dark' : 'light')
  }
  
  // Estados para métricas
  const [totalSalesAmount, setTotalSalesAmount] = useState(0)
  const [totalPurchasesAmount, setTotalPurchasesAmount] = useState(0)
  const [inventoryValue, setInventoryValue] = useState(0)
  const [grossMargin, setGrossMargin] = useState(0)
  const [avgTicket, setAvgTicket] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [topProfitable, setTopProfitable] = useState<any[]>([])
  const [salesByDay, setSalesByDay] = useState<any[]>([])
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [adjustmentsSummary, setAdjustmentsSummary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const staffDataStr = localStorage.getItem('currentStaff')
      const bizStr = localStorage.getItem('currentBusiness')

      let bId = ''
      let brId = ''
      if (staffDataStr) {
        const staff = JSON.parse(staffDataStr)
        bId = staff.business_id || staff.busines_id || ''
        brId = staff.branch_id || ''
      } else if (bizStr) {
        const biz = JSON.parse(bizStr)
        bId = biz.id || biz.business_id || biz.busines_id || ''
      }

      setBusinessId(bId)
      if (bId) {
        loadBranches(bId).then((branchesList) => {
          const initialBranch = brId || (branchesList && branchesList.length > 0 ? branchesList[0].id : 'ALL')
          setSelectedBranch(initialBranch)
          loadAnalytics(bId, initialBranch === 'ALL' ? null : initialBranch)
        })
      }
    } catch (e) {
      console.error("Error al cargar sesión:", e)
    }
  }, [])

  const loadBranches = async (bId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('business_id', bId)
    if (data) {
      setBranches(data)
      return data
    }
    return []
  }
  
  const loadAnalytics = async (bId: string, branchId: string | null) => {
    if (!bId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_business_analytics', {
        p_business_id: bId,
        p_branch_id: branchId === 'ALL' || !branchId ? null : branchId
      })

      if (error) {
        console.error("Detalle del Error RPC:", error.message, error.details, error.hint)
      }

      if (!error && data) {
        setTotalSalesAmount(Number(data.total_sales || 0))
        setTotalPurchasesAmount(Number(data.total_purchases || 0))
        setInventoryValue(Number(data.inventory_value || 0))
        setGrossMargin(Number(data.gross_margin || 0))
        setAvgTicket(Number(data.avg_ticket || 0))
        setLowStockCount(Number(data.low_stock_count || 0))
        setTopProducts(data.top_products || [])
        setTopProfitable(data.top_profitable || [])
        setSalesByDay(data.sales_by_day || [])
        setPaymentMethods(data.payment_methods || [])
        setAdjustmentsSummary(data.adjustments || [])
      }
    } catch (err) {
      console.error("Error al cargar analíticas:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleBranchFilterChange = (bId: string) => {
    setSelectedBranch(bId)
    if (businessId) loadAnalytics(businessId, bId === 'ALL' ? null : bId)
  }

  const dayNamesMap: { [key: string]: string } = {
    'Monday': 'Lunes',
    'Tuesday': 'Martes',
    'Wednesday': 'Miércoles',
    'Thursday': 'Jueves',
    'Friday': 'Viernes',
    'Saturday': 'Sábado',
    'Sunday': 'Domingo'
  }

  const maxDaySales = salesByDay.reduce((max, d) => Math.max(max, Number(d.total_amount || 0)), 1)

  const totalPaymentSum = paymentMethods.reduce((sum, p) => sum + Number(p.total || 0), 0)
  let currentAngle = 0
  const paymentColors: { [key: string]: string } = {
    'efectivo': '#10b981',
    'tarjeta': '#3b82f6'
  }

  const conicGradientParts = paymentMethods.map((p) => {
    const percentage = totalPaymentSum > 0 ? (Number(p.total) / totalPaymentSum) * 100 : 0
    const startAngle = currentAngle
    currentAngle += percentage
    const color = paymentColors[p.method.toLowerCase()] || '#8b5cf6'
    return `${color} ${startAngle}% ${currentAngle}%`
  })

  const conicGradientStyle = conicGradientParts.length > 0 ? `conic-gradient(${conicGradientParts.join(', ')})` : '#334155'

  // Clases dinámicas según el tema (Modo Oscuro vs Modo Claro)
  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-750 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col w-full max-w-[1600px] mx-auto notranslate ${themeBg}`} translate="no">
      
      {/* HEADER PANORÁMICO */}
      <header className={`p-4 sm:p-6 rounded-lg shadow mb-6 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border w-full ${panelBg}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-emerald-500">📈 Business Intelligence & Estadísticas</h1>
          <select 
            value={selectedBranch} 
            onChange={e => handleBranchFilterChange(e.target.value)}
            className={`border px-3 py-2 rounded text-sm font-semibold outline-none focus:border-emerald-500 ${inputBg}`}
          >
            <option value="ALL">🌐 Todas las Sucursales</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          {/* BOTÓN INTERRUPTOR DE TEMA (CLARO / OSCURO) */}
          <button 
            onClick={toggleTheme}
            className={`px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors border ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-amber-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'}`}
          >
            {isDarkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>

          <button onClick={() => router.push('/inventario')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors text-white">
            🗄️ Inventario
          </button>
          <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors text-white">
            ← Volver al POS
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="opacity-75 text-base animate-pulse">Calculando indicadores seguros de negocio...</p>
        </div>
      ) : (
        <div className="space-y-6 w-full">
          
          {/* TARJETAS KPI PRINCIPALES (6 MÉTRICAS CLAVE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
            <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <span className="text-[11px] opacity-75 uppercase font-bold">Ventas Totales</span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-500 mt-2" translate="no">Q {totalSalesAmount.toFixed(2)}</span>
              <span className="text-[10px] opacity-60 mt-1">Ingresos brutos</span>
            </div>

            <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <span className="text-[11px] opacity-75 uppercase font-bold">Inversión Compras</span>
              <span className="text-xl sm:text-2xl font-extrabold text-amber-500 mt-2" translate="no">Q {totalPurchasesAmount.toFixed(2)}</span>
              <span className="text-[10px] opacity-60 mt-1">Facturas proveedor</span>
            </div>

            <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <span className="text-[11px] opacity-75 uppercase font-bold">Margen Bruto</span>
              <span className="text-xl sm:text-2xl font-extrabold text-blue-500 mt-2" translate="no">Q {grossMargin.toFixed(2)}</span>
              <span className="text-[10px] opacity-60 mt-1">Ganancia neta</span>
            </div>

            <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <span className="text-[11px] opacity-75 uppercase font-bold">Ticket Promedio</span>
              <span className="text-xl sm:text-2xl font-extrabold text-cyan-500 mt-2" translate="no">Q {avgTicket.toFixed(2)}</span>
              <span className="text-[10px] opacity-60 mt-1">Valor medio por venta</span>
            </div>

            <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <span className="text-[11px] opacity-75 uppercase font-bold">Capital Inventario</span>
              <span className="text-xl sm:text-2xl font-extrabold text-purple-500 mt-2" translate="no">Q {inventoryValue.toFixed(2)}</span>
              <span className="text-[10px] opacity-60 mt-1">Valor potencial stock</span>
            </div>

            <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <span className="text-[11px] opacity-75 uppercase font-bold">Stock Crítico</span>
              <span className={`text-xl sm:text-2xl font-extrabold mt-2 ${lowStockCount > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
              </span>
              <span className="text-[10px] opacity-60 mt-1">Productos ≤ 3 en stock</span>
            </div>
          </div>

          {/* SECCIÓN DE GRÁFICAS: BARRAS Y PASTEL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            
            {/* GRÁFICA DE BARRAS: VENTAS POR DÍA */}
            <div className={`lg:col-span-2 p-5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <div>
                <h2 className="text-base font-bold text-emerald-500 mb-1 flex items-center gap-2">
                  📊 Rendimiento de Ventas por Día de la Semana
                </h2>
                <p className="text-xs opacity-75 mb-4">Comportamiento de ingresos según el día en que se realizaron las transacciones.</p>
              </div>
              
              {salesByDay.length === 0 ? (
                <p className="opacity-75 text-sm text-center py-12">No hay registros suficientes para graficar por día.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-end pt-2 pb-1">
                  {salesByDay.map((d: any, idx: number) => {
                    const rawDay = (d.day_name || '').trim()
                    const spanishDay = dayNamesMap[rawDay] || rawDay
                    const amount = Number(d.total_amount || 0)
                    const percentage = Math.round((amount / maxDaySales) * 100)

                    return (
                      <div key={idx} className={`p-2.5 rounded-lg border flex flex-col items-center justify-end h-48 ${subPanelBg}`}>
                        <span className="text-[11px] font-extrabold text-emerald-500 mb-1" translate="no">Q {amount.toFixed(0)}</span>
                        
                        <div className="w-full bg-slate-700 rounded-t h-28 flex items-end p-1">
                          <div 
                            className="w-full bg-emerald-500 rounded-t transition-all duration-500" 
                            style={{ height: `${Math.max(percentage, 8)}%` }}
                          ></div>
                        </div>

                        <span className="text-xs font-bold mt-2">{spanishDay}</span>
                        <span className="text-[9px] opacity-75">{d.total_orders} tkts</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* GRÁFICA DE PASTEL (DONUT): MÉTODOS DE PAGO */}
            <div className={`p-5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <div>
                <h2 className="text-base font-bold text-emerald-500 mb-1 flex items-center gap-2">
                  🥧 Ingresos por Método de Pago
                </h2>
                <p className="text-xs opacity-75 mb-4">Proporción de efectivo y tarjeta.</p>
              </div>

              {paymentMethods.length === 0 ? (
                <p className="opacity-75 text-sm text-center py-12">No hay datos de pago registrados.</p>
              ) : (
                <div className="flex flex-col items-center justify-center my-auto space-y-4">
                  <div 
                    className="w-36 h-36 rounded-full relative flex items-center justify-center shadow-inner"
                    style={{ background: conicGradientStyle }}
                  >
                    <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow ${panelBg}`}>
                      <span className="text-[10px] opacity-75 uppercase font-bold">Total</span>
                      <span className="text-xs font-extrabold text-emerald-500" translate="no">Q {totalPaymentSum.toFixed(0)}</span>
                    </div>
                  </div>

                  <div className="w-full space-y-2 pt-2">
                    {paymentMethods.map((p: any, idx: number) => {
                      const amount = Number(p.total || 0)
                      const pct = totalPaymentSum > 0 ? ((amount / totalPaymentSum) * 100).toFixed(1) : '0'
                      const colorClass = p.method.toLowerCase() === 'tarjeta' ? 'bg-blue-500' : 'bg-emerald-500'

                      return (
                        <div key={idx} className={`p-2 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${colorClass}`}></span>
                            <span className="font-semibold capitalize">{p.method}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-emerald-500 mr-2" translate="no">Q {amount.toFixed(2)}</span>
                            <span className="text-[10px] opacity-75 font-bold">({pct}%)</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* SECCIÓN DETALLADA: TOP PRODUCTOS, RENTABILIDAD Y MERMAS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            
            {/* TOP 5 PRODUCTOS MÁS VENDIDOS */}
            <div className={`p-5 rounded-lg border shadow flex flex-col ${panelBg}`}>
              <h2 className="text-base font-bold text-emerald-500 mb-4 flex items-center gap-2">
                🔥 Top 5 Artículos Más Vendidos
              </h2>
              
              <div className="space-y-3 flex-1">
                {topProducts.length === 0 ? (
                  <p className="opacity-75 text-sm text-center py-8">No hay registros de ventas aún.</p>
                ) : (
                  topProducts.map((p: any, idx: number) => (
                    <div key={idx} className={`p-3.5 rounded border flex justify-between items-center text-sm ${subPanelBg}`}>
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-xs opacity-75">Cantidad: <span className="text-emerald-500 font-bold">{p.qty} unids</span></p>
                        </div>
                      </div>
                      <span className="font-extrabold text-emerald-500" translate="no">Q {Number(p.total).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TOP 5 ARTÍCULOS CON MAYOR GANANCIA */}
            <div className={`p-5 rounded-lg border shadow flex flex-col ${panelBg}`}>
              <h2 className="text-base font-bold text-blue-500 mb-4 flex items-center gap-2">
                💎 Top 5 Mayor Ganancia (Rentabilidad)
              </h2>
              
              <div className="space-y-3 flex-1">
                {topProfitable.length === 0 ? (
                  <p className="opacity-75 text-sm text-center py-8">No hay registros de ganancia aún.</p>
                ) : (
                  topProfitable.map((p: any, idx: number) => (
                    <div key={idx} className={`p-3.5 rounded border flex justify-between items-center text-sm ${subPanelBg}`}>
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-xs opacity-75">Volumen: <span className="text-blue-500 font-bold">{p.qty} unids</span></p>
                        </div>
                      </div>
                      <span className="font-extrabold text-blue-500" translate="no">Q {Number(p.profit).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AUDITORÍA DE AJUSTES Y MERMAS */}
            <div className={`p-5 rounded-lg border shadow flex flex-col ${panelBg}`}>
              <h2 className="text-base font-bold text-emerald-500 mb-4 flex items-center gap-2">
                ⚠️ Historial de Ajustes y Mermas
              </h2>
              
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px]">
                {adjustmentsSummary.length === 0 ? (
                  <p className="opacity-75 text-sm text-center py-8">No hay ajustes manuales registrados.</p>
                ) : (
                  adjustmentsSummary.map((m: any, idx: number) => (
                    <div key={idx} className={`p-3 rounded border flex justify-between items-center text-sm ${subPanelBg}`}>
                      <div>
                        <p className="font-bold">{m.product_name || 'Producto'}</p>
                        <p className="text-xs text-amber-500 font-medium">Motivo: {m.movement_type}</p>
                        <p className="text-[10px] opacity-60">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`font-extrabold text-base ${Number(m.quantity) > 0 ? 'text-emerald-500' : 'text-red-400'}`} translate="no">
                        {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  )
}