'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts'

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
  const [topCustomers, setTopCustomers] = useState<any[]>([])
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
          // Cambiamos para que por defecto sea 'ALL' en lugar de usar brId o la primera sucursal
          const initialBranch = 'ALL' 
          setSelectedBranch(initialBranch)
          loadAnalytics(bId, null, Number(selectedYear))
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
      // 1. Cargamos las analíticas generales del negocio vía RPC
      const { data, error } = await supabase.rpc('get_business_analytics', {
        p_business_id: bId,
        p_branch_id: branchId === 'ALL' || !branchId ? null : branchId,
        p_year: year
      })

      if (!error && data) {
        const res = Array.isArray(data) ? data[0] : (typeof data === 'object' ? data : {})

        if (res) {
          setTotalSalesAmount(Number(res.total_sales ?? res.totalSales ?? 0))
          setInventoryValue(Number(res.inventory_value ?? res.inventoryValue ?? 0))
          setGrossMargin(Number(res.gross_margin ?? res.grossMargin ?? 0))
          setAvgTicket(Number(res.avg_ticket ?? res.avgTicket ?? 0))
          setLowStockCount(Number(res.low_stock_count ?? res.lowStockCount ?? 0))
          setTopProducts(res.top_products ?? res.topProducts ?? [])
          setTopProfitable(res.top_profitable ?? res.topProfitable ?? [])
          setTopCustomers(res.top_customers ?? res.topCustomers ?? [])
          setSalesByDay(res.sales_by_day ?? res.salesByDay ?? [])
          setMonthlySales(res.monthly_sales ?? res.monthlySales ?? [])
          setPaymentMethods(res.payment_methods ?? res.paymentMethods ?? [])
          setAdjustmentsSummary(res.adjustments ?? [])
        }
      }

      // 2. Cuentas por Cobrar (Sincronizado con acreedores)
      const { data: creditsData } = await supabase.rpc('get_business_credit_accounts', {
        p_business_id: bId
      })

      if (creditsData) {
        const filteredCreds = creditsData.filter((c: any) => {
          const branchMatch = branchId === 'ALL' || !branchId || c.sale?.branch_id === branchId || c.branch_id === branchId
          const isPaid = (c.status || '').toLowerCase() === 'pagado' || Number(c.balance || 0) <= 0
          return branchMatch && !isPaid
        })
        setAccountsReceivable(filteredCreds.reduce((acc: number, c: any) => acc + Number(c.balance || 0), 0))
      } else {
        setAccountsReceivable(0)
      }

      // 3. Inversión Compras y Cuentas por Pagar (Sincronizado con el historial de compras)
      const { data: purchasesData } = await supabase.rpc('get_purchases_history', {
        p_business_id: bId,
        p_branch_id: branchId === 'ALL' || !branchId ? 'ALL' : branchId
      })

      if (purchasesData) {
        // Filtrar por año si se seleccionó uno específico
        const filteredPurchases = purchasesData.filter((p: any) => {
          if (!year || year.toString() === 'ALL') return true;
          const purchaseYear = new Date(p.created_at).getFullYear();
          return purchaseYear === Number(year);
        });

        // Inversión Compras: Suma total de contado y crédito sin exclusiones
        const totalPurchasesSum = filteredPurchases.reduce((acc: number, p: any) => acc + Number(p.total_amount ?? 0), 0);
        setTotalPurchasesAmount(totalPurchasesSum);

        // Cuentas por Pagar: Solo crédito y pendientes
        const creditPurchases = filteredPurchases.filter((p: any) => 
          p.payment_method === 'Crédito' && p.status !== 'Pagado'
        );
        const exactPayableSum = creditPurchases.reduce((acc: number, p: any) => acc + Number(p.balance ?? p.total_amount ?? 0), 0);
        setAccountsPayable(exactPayableSum);
      } else {
        setTotalPurchasesAmount(0);
        setAccountsPayable(0);
      }

    } catch (err) {
      console.error("Error al cargar analíticas:", err)
    } finally {
      setLoading(false)
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

  const formattedMonthlySales = monthlySales.map((m: any) => ({
    name: (m.month_name || '').trim(),
    monto: Number(m.total_amount || 0),
    ordenes: Number(m.total_orders || 0)
  }))

  const formattedSalesByDay = salesByDay.map((d: any) => {
    const rawDay = (d.day_name || '').trim()
    return {
      dia: dayNamesMap[rawDay] || rawDay,
      monto: Number(d.total_amount || 0),
      ordenes: Number(d.total_orders || 0)
    }
  })
const handleFilterChange = (branchId: string, yearStr: string) => {
    setSelectedBranch(branchId)
    setSelectedYear(yearStr)
    if (businessId) {
      loadAnalytics(businessId, branchId === 'ALL' ? null : branchId, yearStr === 'ALL' ? null : Number(yearStr))
    }
  }
  const paymentColors: { [key: string]: string } = {
    'efectivo': '#10b981',
    'contado': '#06b6d4',
    'tarjeta': '#3b82f6',
    'crédito': '#f59e0b',
    'mixto': '#8b5cf6'
  }

  const formattedPaymentMethods = paymentMethods.map((p: any) => ({
    name: p.method.charAt(0).toUpperCase() + p.method.slice(1),
    value: Number(p.total || 0),
    color: paymentColors[p.method.toLowerCase()] || '#ec4899'
  }))

  const totalPaymentSum = formattedPaymentMethods.reduce((sum, p) => sum + p.value, 0)

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-750 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-2 md:p-4 flex flex-col notranslate pb-20 lg:pb-4 ${themeBg}`} translate="no">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1">
        
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
                <span className="text-[11px] opacity-75 uppercase font-bold">Venta Promedio</span>
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
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={formattedMonthlySales} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#cbd5e1'} />
                      <XAxis dataKey="name" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                      <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#475569' : '#cbd5e1', borderRadius: '8px', color: isDarkMode ? '#fff' : '#000' }}
                        formatter={(value: any) => [`Q ${Number(value).toFixed(2)}`, 'Ventas']}
                      />
                      <Area type="monotone" dataKey="monto" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMonto)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

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
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedSalesByDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#cbd5e1'} />
                        <XAxis dataKey="dia" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                        <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#475569' : '#cbd5e1', borderRadius: '8px', color: isDarkMode ? '#fff' : '#000' }}
                          formatter={(value: any) => [`Q ${Number(value).toFixed(2)}`, 'Ingresos']}
                        />
                        <Bar dataKey="monto" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-lg border shadow flex flex-col justify-between ${panelBg}`}>
                <div>
                  <h2 className="text-sm font-bold text-emerald-500 mb-1 flex items-center gap-2">
                    🥧 Ingresos por Método de Pago
                  </h2>
                  <p className="text-xs opacity-75 mb-3">Proporción de efectivo, contado, tarjeta, crédito y mixto.</p>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="opacity-75 text-xs text-center py-12">No hay datos de pago registrados.</p>
                ) : (
                  <div className="flex flex-col items-center justify-center my-auto">
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={formattedPaymentMethods}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {formattedPaymentMethods.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#475569' : '#cbd5e1', borderRadius: '8px', color: isDarkMode ? '#fff' : '#000' }}
                            formatter={(value: any) => [`Q ${Number(value).toFixed(2)}`, 'Monto']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="w-full space-y-1.5 pt-2">
                      {formattedPaymentMethods.map((p: any, idx: number) => {
                        const pct = totalPaymentSum > 0 ? ((p.value / totalPaymentSum) * 100).toFixed(1) : '0'

                        return (
                          <div key={idx} className={`p-2 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></span>
                              <span className="font-semibold capitalize">{p.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-emerald-500 mr-1.5" translate="no">Q {p.value.toFixed(2)}</span>
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
                <h2 className="text-sm font-bold text-amber-500 mb-3 flex items-center gap-2">
                  🏆 Top 5 Mejores Compradores (Clientes)
                </h2>
                <div className="space-y-2.5 flex-1">
                  {topCustomers.length === 0 ? (
                    <p className="opacity-75 text-xs text-center py-8">No hay registros de clientes frecuentes aún.</p>
                  ) : (
                    topCustomers.map((c: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded border flex justify-between items-center text-xs ${subPanelBg}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center text-[11px]">{idx + 1}</span>
                          <div>
                            <p className="font-bold">{c.name || 'Cliente General'}</p>
                            <p className="text-[11px] opacity-75">Compras: <span className="text-amber-500 font-bold">{c.orders_count || 0} tkts</span></p>
                          </div>
                        </div>
                        <span className="font-extrabold text-amber-500" translate="no">Q {Number(c.total || 0).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            <div className={`p-4 rounded-lg border shadow flex flex-col ${panelBg} w-full`}>
              <h2 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                ⚠️ Historial de Ajustes Manuales y Mermas
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto pr-1">
                {adjustmentsSummary.filter((m: any) => {
                  const type = (m.movement_type || '').toLowerCase()
                  return type.includes('ajuste') || type.includes('merma') || type.includes('manual')
                }).length === 0 ? (
                  <p className="opacity-75 text-xs text-center py-4 col-span-full">No hay ajustes manuales registrados.</p>
                ) : (
                  adjustmentsSummary
                    .filter((m: any) => {
                      const type = (m.movement_type || '').toLowerCase()
                      return type.includes('ajuste') || type.includes('merma') || type.includes('manual')
                    })
                    .map((m: any, idx: number) => (
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
        )}

      </div>

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