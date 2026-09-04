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
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()))

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
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
  
  // Estados para métricas completas
  const [totalSalesAmount, setTotalSalesAmount] = useState(0)
  const [totalPurchasesAmount, setTotalPurchasesAmount] = useState(0)
  const [inventoryValue, setInventoryValue] = useState(0)
  const [grossMargin, setGrossMargin] = useState(0)
  const [avgTicket, setAvgTicket] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [accountsReceivable, setAccountsReceivable] = useState(0)
  const [accountsPayable, setAccountsPayable] = useState(0)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [topProfitable, setTopProfitable] = useState<any[]>([])
  const [salesByDay, setSalesByDay] = useState<any[]>([])
  const [monthlySales, setMonthlySales] = useState<any[]>([])
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
        setIsAdmin(true)
      }

      setBusinessId(bId)
      if (bId) {
        loadBranches(bId).then((branchesList) => {
          const initialBranch = brId || (branchesList && branchesList.length > 0 ? branchesList[0].id : 'ALL')
          setSelectedBranch(initialBranch)
          loadAnalytics(bId, initialBranch === 'ALL' ? null : initialBranch, Number(selectedYear))
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
  
  const loadAnalytics = async (bId: string, branchId: string | null, year: number | null) => {
    if (!bId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_business_analytics', {
        p_business_id: bId,
        p_branch_id: branchId === 'ALL' || !branchId ? null : branchId,
        p_year: year
      })

      if (error) {
        console.error("Detalle del Error RPC:", error.message)
      }

      if (!error && data) {
        setTotalSalesAmount(Number(data.total_sales || 0))
        setTotalPurchasesAmount(Number(data.total_purchases || 0))
        setInventoryValue(Number(data.inventory_value || 0))
        setGrossMargin(Number(data.gross_margin || 0))
        setAvgTicket(Number(data.avg_ticket || 0))
        setLowStockCount(Number(data.low_stock_count || 0))
        setAccountsReceivable(Number(data.accounts_receivable || 0))
        setAccountsPayable(Number(data.accounts_payable || 0))
        setTopProducts(data.top_products || [])
        setTopProfitable(data.top_profitable || [])
        setSalesByDay(data.sales_by_day || [])
        setMonthlySales(data.monthly_sales || [])
        setPaymentMethods(data.payment_methods || [])
        setAdjustmentsSummary(data.adjustments || [])
      }
    } catch (err) {
      console.error("Error al cargar analíticas:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (branchId: string, yearStr: string) => {
    setSelectedBranch(branchId)
    setSelectedYear(yearStr)
    if (businessId) {
      loadAnalytics(businessId, branchId === 'ALL' ? null : branchId, yearStr === 'ALL' ? null : Number(yearStr))
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('currentBusiness')
    localStorage.removeItem('currentStaff')
    await supabase.auth.signOut()
    router.push('/')
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
  const maxMonthSales = monthlySales.reduce((max, m) => Math.max(max, Number(m.total_amount || 0)), 1)

  // Configuración de colores para métodos de pago actualizados
  const totalPaymentSum = paymentMethods.reduce((sum, p) => sum + Number(p.total || 0), 0)
  let currentAngle = 0
  const paymentColors: { [key: string]: string } = {
    'efectivo': '#10b981',      // Esmeralda
    'tarjeta': '#3b82f6',       // Azul
    'transferencia': '#f59e0b', // Ámbar
    'mixto': '#8b5cf6'          // Morado
  }

  const conicGradientParts = paymentMethods.map((p) => {
    const percentage = totalPaymentSum > 0 ? (Number(p.total) / totalPaymentSum) * 100 : 0
    const startAngle = currentAngle
    currentAngle += percentage
    const color = paymentColors[p.method.toLowerCase()] || '#8b5cf6'
    return `${color} ${startAngle}% ${currentAngle}%`
  })

  const conicGradientStyle = conicGradientParts.length > 0 ? `conic-gradient(${conicGradientParts.join(', ')})` : '#334155'

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-750 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-2 md:p-4 flex flex-col notranslate pb-20 lg:pb-4 ${themeBg}`} translate="no">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1">
        
        {/* BARRA SUPERIOR CON FILTROS Y TEMA */}
        <header className={`p-3 rounded-lg shadow mb-4 flex flex-wrap justify-between items-center gap-2 border w-full ${panelBg}`}>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center shadow transition-colors"
            >
              ☰
            </button>
            <h1 className="text-xs md:text-sm font-bold text-emerald-500">📈 Estadísticas y Reportes</h1>
            
            <select 
              value={selectedBranch} 
              onChange={e => handleFilterChange(e.target.value, selectedYear)}
              className={`border px-2.5 py-1 rounded text-xs font-semibold outline-none focus:border-emerald-500 ${inputBg}`}
            >
              <option value="ALL">🌐 Todas las Sucursales</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select 
              value={selectedYear} 
              onChange={e => handleFilterChange(selectedBranch, e.target.value)}
              className={`border px-2.5 py-1 rounded text-xs font-semibold outline-none focus:border-emerald-500 ${inputBg}`}
            >
              <option value="ALL">📅 Todos los Años</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg text-sm font-semibold border transition-colors ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="opacity-75 text-sm animate-pulse">Calculando indicadores seguros de negocio...</p>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            
            {/* 8 TARJETAS KPI PRINCIPALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Ventas Totales</span>
                <span className="text-lg sm:text-xl font-extrabold text-emerald-500 mt-2" translate="no">Q {totalSalesAmount.toFixed(2)}</span>
                <span className="text-[10px] opacity-60 mt-1">Ingresos brutos</span>
              </div>

              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Inversión Compras</span>
                <span className="text-lg sm:text-xl font-extrabold text-amber-500 mt-2" translate="no">Q {totalPurchasesAmount.toFixed(2)}</span>
                <span className="text-[10px] opacity-60 mt-1">Facturas proveedor</span>
              </div>

              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Margen Bruto</span>
                <span className="text-lg sm:text-xl font-extrabold text-blue-500 mt-2" translate="no">Q {grossMargin.toFixed(2)}</span>
                <span className="text-[10px] opacity-60 mt-1">Ganancia neta</span>
              </div>

              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Ticket Promedio</span>
                <span className="text-lg sm:text-xl font-extrabold text-cyan-500 mt-2" translate="no">Q {avgTicket.toFixed(2)}</span>
                <span className="text-[10px] opacity-60 mt-1">Valor medio por venta</span>
              </div>

              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Capital Inventario</span>
                <span className="text-lg sm:text-xl font-extrabold text-purple-500 mt-2" translate="no">Q {inventoryValue.toFixed(2)}</span>
                <span className="text-[10px] opacity-60 mt-1">Valor potencial stock</span>
              </div>

              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Stock Crítico</span>
                <span className={`text-lg sm:text-xl font-extrabold mt-2 ${lowStockCount > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                  {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
                </span>
                <span className="text-[10px] opacity-60 mt-1">Productos ≤ 3 en stock</span>
              </div>

              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Cuentas por Cobrar</span>
                <span className="text-lg sm:text-xl font-extrabold text-amber-400 mt-2" translate="no">Q {accountsReceivable.toFixed(2)}</span>
                <span className="text-[10px] opacity-60 mt-1">Créditos pendientes clientes</span>
              </div>

              <div className={`p-3.5 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <span className="text-[11px] opacity-75 uppercase font-bold">Cuentas por Pagar</span>
                <span className="text-lg sm:text-xl font-extrabold text-red-400 mt-2" translate="no">Q {accountsPayable.toFixed(2)}</span>
                <span className="text-[10px] opacity-60 mt-1">Saldos pendientes proveedores</span>
              </div>
            </div>

            {/* GRÁFICA DE LÍNEA DE TENDENCIA Y TIEMPO MENSUAL */}
            <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
              <div>
                <h2 className="text-sm font-bold text-emerald-500 mb-1 flex items-center gap-2">
                  📈 Ventas hasta la Fecha (Línea de Tendencia Mensual)
                </h2>
                <p className="text-xs opacity-75 mb-4">Comportamiento e ingresos consolidados mes a mes con área de tendencia.</p>
              </div>

              {monthlySales.length === 0 ? (
                <p className="opacity-75 text-xs text-center py-12">No hay registros de ventas para el período seleccionado.</p>
              ) : (
                <div className="relative h-72 w-full pt-8 pb-4 px-2 border-b border-slate-700 flex flex-col justify-end">
                  <div className="absolute inset-x-0 top-2 border-b border-slate-700/40 text-[10px] opacity-60 px-2 flex justify-between">
                    <span>Máx: Q {maxMonthSales.toFixed(2)}</span>
                  </div>
                  <div className="absolute inset-x-0 top-1/2 border-b border-slate-700/40 text-[10px] opacity-40 px-2 flex justify-between">
                    <span>Med: Q {(maxMonthSales / 2).toFixed(2)}</span>
                  </div>

                  {/* SVG Container para la Línea de Tendencia corregida */}
                  <div className="relative w-full h-48 flex items-end">
                    <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      
                      {monthlySales.length > 1 && (() => {
                        const totalPoints = monthlySales.length
                        const pts = monthlySales.map((m, idx) => {
                          const x = (idx / (totalPoints - 1)) * 100
                          const y = 100 - Math.min(Math.max((Number(m.total_amount || 0) / maxMonthSales) * 85, 5), 90)
                          return `${x},${y}`
                        })

                        const polylinePoints = pts.join(' ')
                        const areaPoints = `0,100 ${polylinePoints} 100,100`

                        return (
                          <>
                            <polygon points={areaPoints} fill="url(#trendGradient)" />
                            <polyline 
                              fill="none" 
                              stroke="#10b981" 
                              strokeWidth="2.5" 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              points={polylinePoints}
                            />
                          </>
                        )
                      })()}
                    </svg>

                    {/* Puntos interactivos sobre la línea */}
                    <div className="absolute inset-0 flex justify-between items-end pb-1 px-4">
                      {monthlySales.map((m: any, idx: number) => {
                        const amount = Number(m.total_amount || 0)
                        const heightPct = Math.round((amount / maxMonthSales) * 75)

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div className="absolute -top-10 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30 pointer-events-none">
                              {m.month_name.trim()}: Q {amount.toFixed(2)} ({m.total_orders} tkts)
                            </div>
                            <div 
                              className="w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full shadow-md z-10 group-hover:scale-125 transition-transform cursor-pointer mb-1"
                              style={{ transform: `translateY(-${Math.max(heightPct, 8)}px)` }}
                            ></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-700/60">
                    {monthlySales.map((m: any, idx: number) => (
                      <span key={idx} className="text-[11px] font-bold text-slate-300 flex-1 text-center">{m.month_name.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN DE GRÁFICAS: BARRAS POR DÍA Y PASTEL DE PAGOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
              
              <div className={`lg:col-span-2 p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <div>
                  <h2 className="text-sm font-bold text-emerald-500 mb-1 flex items-center gap-2">
                    📊 Rendimiento de Ventas por Día de la Semana
                  </h2>
                  <p className="text-xs opacity-75 mb-3">Comportamiento de ingresos según el día en que se realizaron las transacciones.</p>
                </div>
                
                {salesByDay.length === 0 ? (
                  <p className="opacity-75 text-xs text-center py-12">No hay registros suficientes para graficar por día.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-end pt-2 pb-1">
                    {salesByDay.map((d: any, idx: number) => {
                      const rawDay = (d.day_name || '').trim()
                      const spanishDay = dayNamesMap[rawDay] || rawDay
                      const amount = Number(d.total_amount || 0)
                      const percentage = Math.round((amount / maxDaySales) * 100)

                      return (
                        <div key={idx} className={`p-2 rounded-lg border flex flex-col items-center justify-end h-44 ${subPanelBg}`}>
                          <span className="text-[10px] font-extrabold text-emerald-500 mb-1" translate="no">Q {amount.toFixed(0)}</span>
                          <div className="w-full bg-slate-700 rounded-t h-24 flex items-end p-1">
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

              {/* GRÁFICA DE PASTEL */}
              <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <div>
                  <h2 className="text-sm font-bold text-emerald-500 mb-1 flex items-center gap-2">
                    🥧 Ingresos por Método de Pago
                  </h2>
                  <p className="text-xs opacity-75 mb-3">Proporción de efectivo, tarjeta, transferencia y mixto.</p>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="opacity-75 text-xs text-center py-12">No hay datos de pago registrados.</p>
                ) : (
                  <div className="flex flex-col items-center justify-center my-auto space-y-3">
                    <div 
                      className="w-32 h-32 rounded-full relative flex items-center justify-center shadow-inner"
                      style={{ background: conicGradientStyle }}
                    >
                      <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center shadow ${panelBg}`}>
                        <span className="text-[9px] opacity-75 uppercase font-bold">Total</span>
                        <span className="text-xs font-extrabold text-emerald-500" translate="no">Q {totalPaymentSum.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="w-full space-y-1.5 pt-1">
                      {paymentMethods.map((p: any, idx: number) => {
                        const amount = Number(p.total || 0)
                        const pct = totalPaymentSum > 0 ? ((amount / totalPaymentSum) * 100).toFixed(1) : '0'
                        const colorClass = paymentColors[p.method.toLowerCase()] || 'bg-emerald-500'

                        return (
                          <div key={idx} className={`p-2 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorClass }}></span>
                              <span className="font-semibold capitalize">{p.method}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-emerald-500 mr-1.5" translate="no">Q {amount.toFixed(2)}</span>
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

            {/* SECCIÓN INFERIOR: TOP PRODUCTOS, RENTABILIDAD Y MERMAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
              
              <div className={`p-4 rounded-lg border shadow flex flex-col ${panelBg}`}>
                <h2 className="text-sm font-bold text-emerald-500 mb-3 flex items-center gap-2">
                  🔥 Top 5 Artículos Más Vendidos
                </h2>
                <div className="space-y-2.5 flex-1">
                  {topProducts.length === 0 ? (
                    <p className="opacity-75 text-xs text-center py-8">No hay registros de ventas aún.</p>
                  ) : (
                    topProducts.map((p: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 font-bold flex items-center justify-center text-[11px]">{idx + 1}</span>
                          <div>
                            <p className="font-bold">{p.name}</p>
                            <p className="text-[11px] opacity-75">Cantidad: <span className="text-emerald-500 font-bold">{p.qty} unids</span></p>
                          </div>
                        </div>
                        <span className="font-extrabold text-emerald-500" translate="no">Q {Number(p.total).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`p-4 rounded-lg border shadow flex flex-col ${panelBg}`}>
                <h2 className="text-sm font-bold text-blue-500 mb-3 flex items-center gap-2">
                  💎 Top 5 Mayor Ganancia (Rentabilidad)
                </h2>
                <div className="space-y-2.5 flex-1">
                  {topProfitable.length === 0 ? (
                    <p className="opacity-75 text-xs text-center py-8">No hay registros de ganancia aún.</p>
                  ) : (
                    topProfitable.map((p: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-500 font-bold flex items-center justify-center text-[11px]">{idx + 1}</span>
                          <div>
                            <p className="font-bold">{p.name}</p>
                            <p className="text-[11px] opacity-75">Volumen: <span className="text-blue-500 font-bold">{p.qty} unids</span></p>
                          </div>
                        </div>
                        <span className="font-extrabold text-blue-500" translate="no">Q {Number(p.profit).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={`p-4 rounded-lg border shadow flex flex-col ${panelBg}`}>
                <h2 className="text-sm font-bold text-emerald-500 mb-3 flex items-center gap-2">
                  ⚠️ Historial de Ajustes y Mermas
                </h2>
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[300px] pr-1">
                  {adjustmentsSummary.length === 0 ? (
                    <p className="opacity-75 text-xs text-center py-8">No hay ajustes manuales registrados.</p>
                  ) : (
                    adjustmentsSummary.map((m: any, idx: number) => (
                      <div key={idx} className={`p-2.5 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                        <div>
                          <p className="font-bold">{m.product_name || 'Producto'}</p>
                          <p className="text-[11px] text-amber-500 font-medium">Motivo: {m.movement_type}</p>
                          <p className="text-[10px] opacity-60">{new Date(m.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`font-extrabold text-sm ${Number(m.quantity) > 0 ? 'text-emerald-500' : 'text-red-400'}`} translate="no">
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

      {/* MENÚ LATERAL */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 flex z-[9999]" onClick={() => setIsDrawerOpen(false)}>
          <div className={`w-[380px] md:w-[420px] h-full p-6 flex flex-col shadow-2xl border-r ${panelBg}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-opacity-50">
              <h2 className="text-lg font-bold text-emerald-500">🛠️ Navegación General</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-xl font-bold opacity-75 hover:opacity-100 p-1">✕</button>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
              <div className="space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Módulos del Sistema</p>
                {isAdmin && (
                  <button onClick={() => { setIsDrawerOpen(false); router.push('/dashboard'); }} className="w-full bg-emerald-700 hover:bg-emerald-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                    <span>🏠 Panel del Dueño</span><span>➔</span>
                  </button>
                )}
                <button onClick={() => { setIsDrawerOpen(false); router.push('/pos'); }} className="w-full bg-sky-600 hover:bg-sky-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>🛒 Ir al POS</span><span>➔</span>
                </button>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/cajero'); }} className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>💵 Módulo de Caja</span><span>➔</span>
                </button>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/compras'); }} className="w-full bg-amber-600 hover:bg-amber-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>📦 Módulo de Compras</span><span>➔</span>
                </button>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/inventario'); }} className="w-full bg-emerald-700 hover:bg-emerald-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>📋 Administración de Inventario</span><span>➔</span>
                </button>
              </div>
              <div className="pt-3 border-t border-opacity-50 space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Sesión</p>
                <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left">
                  🚪 Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}