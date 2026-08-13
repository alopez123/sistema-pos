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

  return (
    <div className="min-h-screen bg-[#0f172a] p-8 text-white notranslate" translate="no">
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex justify-between items-center border border-slate-700">
        <div>
          <h1 className="text-xl font-bold text-emerald-400">Historial y Ventas por Día</h1>
          {isStaff && <p className="text-xs text-amber-400 mt-0.5">🔍 Vista restringida a tu sucursal asignada</p>}
        </div>
        <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-semibold text-sm">
          ← Volver al POS
        </button>
      </header>

      <div className="bg-[#1e293b] p-6 rounded-lg shadow border border-slate-700 space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Seleccionar Fecha</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-white text-sm outline-none focus:border-emerald-500 font-semibold"
            />
          </div>

          <div className="bg-[#0f172a] px-5 py-3 rounded-lg border border-emerald-500/40 flex items-center gap-6">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Fecha Seleccionada</p>
              <p className="text-lg font-extrabold text-emerald-400" translate="no">Q {totalFilteredSales}</p>
            </div>
            <div className="border-l border-slate-700 pl-6">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Transacciones</p>
              <p className="text-lg font-bold text-white">{sales.length}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {sales.length === 0 ? (
            <p className="text-slate-400 text-center py-12">No hay ventas registradas para esta fecha en esta sucursal.</p>
          ) : (
            sales.map(sale => (
              <div 
                key={sale.sale_id} 
                onClick={() => handleViewSaleDetails(sale.sale_id)}
                className="bg-[#0f172a] p-4 rounded-lg border border-slate-700 hover:border-emerald-500 cursor-pointer transition-all flex justify-between items-center shadow"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">NIT: {sale.customer_nit}</span>
                    <span className="text-xs text-slate-300">({sale.customer_name})</span>
                  </div>
                  <p className="text-xs text-amber-400 font-medium">Sucursal: {sale.branch_name}</p>
                  <p className="text-[10px] text-slate-400">Hora: {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Pago: <span className="uppercase text-slate-300">{sale.payment_method}</span></p>
                </div>
                <span className="text-lg font-extrabold text-emerald-400" translate="no">Q {sale.total_amount}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-[420px] text-white shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-emerald-400">📦 Detalle de la Venta</h3>
              <button onClick={() => setSelectedSaleDetails(null)} className="text-slate-400 hover:text-white font-bold text-sm">✕</button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
              {selectedSaleDetails.map((item, idx) => (
                <div key={idx} className="bg-[#0f172a] p-2.5 rounded border border-slate-700 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">{item.product_name}</p>
                    <p className="text-[10px] text-slate-400">Cantidad: <span className="text-emerald-400 font-bold">{item.quantity}</span> x Q {item.price}</p>
                  </div>
                  <span className="font-bold text-emerald-400 text-sm" translate="no">Q {item.quantity * item.price}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedSaleDetails(null)} className="mt-6 w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded-lg font-semibold text-xs">
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  )
}