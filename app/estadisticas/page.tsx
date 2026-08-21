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
  
  // Estados para métricas
  const [totalSalesAmount, setTotalSalesAmount] = useState(0)
  const [totalPurchasesAmount, setTotalPurchasesAmount] = useState(0)
  const [inventoryValue, setInventoryValue] = useState(0)
  const [grossMargin, setGrossMargin] = useState(0)
  const [topProducts, setTopProducts] = useState<any[]>([])
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
        setTopProducts(data.top_products || [])
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

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-6 lg:p-8 text-white flex flex-col w-full max-w-[1600px] mx-auto notranslate" translate="no">
      
      {/* HEADER PANORÁMICO */}
      <header className="bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow mb-6 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border border-slate-700 w-full">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-emerald-400">📈 Business Intelligence & Estadísticas</h1>
          <select 
            value={selectedBranch} 
            onChange={e => handleBranchFilterChange(e.target.value)}
            className="bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-white text-sm font-semibold outline-none focus:border-emerald-500"
          >
            <option value="ALL">🌐 Todas las Sucursales</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/inventario')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors">
            🗄️ Inventario
          </button>
          <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors">
            ← Volver al POS
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="text-slate-400 text-base animate-pulse">Calculando indicadores seguros de negocio...</p>
        </div>
      ) : (
        <div className="space-y-6 w-full">
          
          {/* TARJETAS KPI PRINCIPALES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 shadow flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase font-bold">Ventas Totales</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2" translate="no">Q {totalSalesAmount.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500 mt-1">Ingresos brutos registrados</span>
            </div>

            <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 shadow flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase font-bold">Inversión en Compras</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-2" translate="no">Q {totalPurchasesAmount.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500 mt-1">Facturas de proveedores</span>
            </div>

            <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 shadow flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase font-bold">Margen Bruto Estimado</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-400 mt-2" translate="no">
                Q {grossMargin.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">Ganancia neta sobre ventas</span>
            </div>

            <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 shadow flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase font-bold">Capital en Inventario</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-400 mt-2" translate="no">Q {inventoryValue.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500 mt-1">Valor potencial de stock</span>
            </div>
          </div>

          {/* SECCIÓN DETALLADA EXPANDIDA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            
            {/* TOP 5 PRODUCTOS MÁS VENDIDOS */}
            <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 shadow flex flex-col">
              <h2 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
                🔥 Top 5 Artículos Más Vendidos
              </h2>
              
              <div className="space-y-3 flex-1">
                {topProducts.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No hay registros de ventas aún.</p>
                ) : (
                  topProducts.map((p: any, idx: number) => (
                    <div key={idx} className="bg-[#0f172a] p-3.5 rounded border border-slate-700 flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-white">{p.name}</p>
                          <p className="text-xs text-slate-400">Cantidad vendida: <span className="text-emerald-400 font-bold">{p.qty} unidades</span></p>
                        </div>
                      </div>
                      <span className="font-extrabold text-emerald-400" translate="no">Q {Number(p.total).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AUDITORÍA DE AJUSTES Y MERMAS */}
            <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 shadow flex flex-col">
              <h2 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
                ⚠️ Historial de Ajustes y Mermas (Justificaciones)
              </h2>
              
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px]">
                {adjustmentsSummary.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No hay ajustes manuales registrados.</p>
                ) : (
                  adjustmentsSummary.map((m: any, idx: number) => (
                    <div key={idx} className="bg-[#0f172a] p-3 rounded border border-slate-700 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-bold text-white">{m.product_name || 'Producto'}</p>
                        <p className="text-xs text-amber-300 font-medium">Motivo: {m.movement_type}</p>
                        <p className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`font-extrabold text-base ${Number(m.quantity) > 0 ? 'text-emerald-400' : 'text-red-400'}`} translate="no">
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