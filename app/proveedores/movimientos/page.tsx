'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function CuentasPorPagarPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string>('')
  const [branches, setBranches] = useState<any[]>([])
  const [historyBranchFilter, setHistoryBranchFilter] = useState<string>('ALL')
  const [purchasesHistory, setPurchasesHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Estado para Notificaciones Flotantes (Toast)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4000)
  }

  // Estados para Tema
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Estados para Modal de Abonos a Proveedores
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<any | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethodType, setPaymentMethodType] = useState('Efectivo')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Estados para Ver el Historial de Abonos y Productos de una Factura específica
  const [viewingPaymentsPurchase, setViewingPaymentsPurchase] = useState<any | null>(null)
  const [purchasePaymentsList, setPurchasePaymentsList] = useState<any[]>([])
  const [purchaseItemsList, setPurchaseItemsList] = useState<any[]>([])
  const [loadingModalData, setLoadingModalData] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('purchases_theme')
    if (savedTheme === 'light') setIsDarkMode(false)
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('purchases_theme', newMode ? 'dark' : 'light')
  }

  useEffect(() => {
    try {
      const bizStr = localStorage.getItem('currentBusiness')
      const staffDataStr = localStorage.getItem('currentStaff')

      let bId = ''
      if (bizStr) {
        try {
          const biz = JSON.parse(bizStr)
          bId = biz.id || biz.business_id || ''
        } catch (err) {}
      }

      if (!bId && staffDataStr) {
        try {
          const staff = JSON.parse(staffDataStr)
          bId = staff.business_id || staff.busines_id || ''
        } catch (err) {}
      }

      setBusinessId(bId)

      if (bId) {
        loadBranches(bId).then(async (loadedBranches) => {
          await loadCreditPurchases(bId, 'ALL', loadedBranches)
        })
      }
    } catch (e) {
      console.error("Error al cargar sesión:", e)
      setLoading(false)
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

  // Carga únicamente las compras realizadas a CRÉDITO
  const loadCreditPurchases = async (bId: string, branchFilter: string = 'ALL', currentBranchesList: any[] = branches) => {
    if (!bId) return
    setLoading(true)

    const { data, error } = await supabase.rpc('get_purchases_history', {
      p_business_id: bId,
      p_branch_id: branchFilter
    })

    if (error) {
      console.error("Error cargando historial con RPC:", error.message)
      setPurchasesHistory([])
    } else if (data) {
      // Filtramos estrictamente solo las compras con payment_method === 'Crédito'
      const creditOnly = data.filter((p: any) => p.payment_method === 'Crédito')

      const formatted = creditOnly.map((p: any) => {
        const foundBranch = currentBranchesList.find(b => b.id === p.branch_id)
        return {
          ...p,
          branch_name: foundBranch ? foundBranch.name : 'Sucursal Principal'
        }
      })
      setPurchasesHistory(formatted)
    } else {
      setPurchasesHistory([])
    }
    setLoading(false)
  }

  const openPurchaseDetailsModal = async (purchase: any) => {
    setViewingPaymentsPurchase(purchase)
    setLoadingModalData(true)
    
    try {
      const { data: paymentsData } = await supabase.rpc('get_purchase_payments', {
        p_purchase_id: purchase.id
      })
      setPurchasePaymentsList(paymentsData || [])

      const { data: itemsData, error: itemsError } = await supabase.rpc('get_purchase_items_safe', {
        p_purchase_id: purchase.id
      })

      if (!itemsError && itemsData) {
        setPurchaseItemsList(itemsData)
      } else {
        setPurchaseItemsList([])
      }
    } catch (err) {
      console.error("Error cargando detalles de compra:", err)
      setPurchaseItemsList([])
    } finally {
      setLoadingModalData(false)
    }
  }

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPurchaseForPayment) return
    const amount = parseFloat(paymentAmount) || 0

    if (amount <= 0) return showToast("Ingresa un monto de abono válido.", 'error')
    if (amount > selectedPurchaseForPayment.balance) {
      return showToast("El abono no puede superar el saldo pendiente de la factura.", 'error')
    }

    setSubmittingPayment(true)
    const { error } = await supabase.rpc('register_purchase_payment', {
      p_purchase_id: selectedPurchaseForPayment.id,
      p_amount_paid: amount,
      p_payment_method: paymentMethodType,
      p_reference: paymentReference.trim() || null,
      p_notes: paymentNotes.trim() || null
    })

    setSubmittingPayment(false)

    if (error) {
      showToast("Error al registrar el abono: " + error.message, 'error')
    } else {
      showToast("✅ ¡Abono registrado con éxito!", 'success')
      setSelectedPurchaseForPayment(null)
      setPaymentAmount('')
      setPaymentReference('')
      setPaymentNotes('')
      loadCreditPurchases(businessId, historyBranchFilter)
    }
  }

  const totalDebt = purchasesHistory
    .filter(p => p.status !== 'Pagado')
    .reduce((acc, p) => acc + Number(p.balance ?? p.total_amount), 0)

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-4 md:p-6 flex flex-col notranslate ${themeBg}`} translate="no">
      
      {/* TOAST FLOTANTE */}
      {toast && (
        <div className="fixed top-5 right-5 z-[99999] animate-bounce">
          <div className={`px-5 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR */}
      <header className={`p-4 rounded-xl shadow mb-6 flex justify-between items-center border w-full ${panelBg}`}>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-emerald-400">💸 Cuentas por Pagar (Proveedores a Crédito)</h1>
          <p className="text-xs text-slate-400">Control de deudas pendientes por compras de mercancía al crédito[cite: 4]</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-lg text-sm font-semibold border transition-colors ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors"
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className={`p-4 rounded-2xl border ${panelBg}`}>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Deuda Global Pendiente con Proveedores</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1" translate="no">Q {totalDebt.toFixed(2)}</p>
        </div>
        <div className={`p-4 rounded-2xl border ${panelBg}`}>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Créditos Mostrados</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1">{purchasesHistory.length}</p>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className={`p-5 rounded-xl border space-y-4 ${panelBg}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-sm font-bold text-slate-300">💡 Haz clic en cualquier tarjeta de crédito para ver los productos comprados y el historial de abonos[cite: 4].</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs opacity-75 whitespace-nowrap">Sucursal:</span>
            <select 
              value={historyBranchFilter} 
              onChange={e => { 
                setHistoryBranchFilter(e.target.value); 
                loadCreditPurchases(businessId, e.target.value); 
              }} 
              className={`border p-2 rounded-xl text-xs outline-none ${inputBg} w-full sm:w-48`}
            >
              <option value="ALL">🏢 Todas las Sucursales</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-12 text-sm opacity-75">Cargando cuentas por pagar...</p>
        ) : purchasesHistory.length === 0 ? (
          <p className="text-center py-12 text-sm text-slate-500">No hay compras al crédito registradas.</p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {purchasesHistory.map(p => (
              <div 
                key={p.id} 
                onClick={() => openPurchaseDetailsModal(p)}
                className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-sm cursor-pointer transition-all hover:border-emerald-500 ${subPanelBg}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-base text-emerald-400">Proveedor: {p.supplier_name || 'General'}</p>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      p.status === 'Pagado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 
                      p.status === 'Parcial' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-red-950 text-red-400 border border-red-800'
                    }`}>
                      {p.status || 'Pendiente'}
                    </span>
                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-semibold">📍 {p.branch_name}</span>
                  </div>
                  <p className="text-xs opacity-80">
                    Factura: <span className="text-amber-400 font-mono">{p.invoice_number}</span> | Fecha Compra: {new Date(p.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold text-amber-400">
                    Vencimiento del Crédito: {p.due_date || 'N/A'}
                  </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end" onClick={e => e.stopPropagation()}>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <span className="block text-[10px] opacity-75">Total Original</span>
                      <span className="font-bold text-slate-300 text-sm" translate="no">Q {p.total_amount}</span>
                    </div>
                    {p.status !== 'Pagado' && (
                      <div className="pl-3 border-l border-slate-700">
                        <span className="block text-[10px] opacity-75">Saldo Pendiente</span>
                        <span className="font-extrabold text-red-400 text-base" translate="no">Q {p.balance}</span>
                      </div>
                    )}
                  </div>
                  {p.status !== 'Pagado' && (
                    <button onClick={() => setSelectedPurchaseForPayment(p)} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-xl text-xs font-bold text-white shadow transition-colors">
                      💳 Abonar / Pagar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DETALLE DE PRODUCTOS Y ABONOS */}
      {viewingPaymentsPurchase && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-2xl border border-emerald-500 w-full max-w-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <div>
                <h3 className="text-base font-bold text-emerald-400">📦 Detalle de Compra y Abonos</h3>
                <p className="text-xs opacity-75">Factura: <span className="text-amber-400 font-mono">{viewingPaymentsPurchase.invoice_number}</span> | Saldo Actual: <strong className="text-red-400">Q {viewingPaymentsPurchase.balance}</strong></p>
              </div>
              <button onClick={() => setViewingPaymentsPurchase(null)} className="font-bold text-base opacity-75 hover:opacity-100">✕</button>
            </div>

            {loadingModalData ? (
              <p className="text-center py-8 text-xs opacity-75">Cargando información...</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">🛒 Artículos Comprados</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {purchaseItemsList.length === 0 ? (
                      <p className="text-xs opacity-75 italic">No hay productos registrados en el detalle.</p>
                    ) : (
                      purchaseItemsList.map((item: any, idx: number) => (
                        <div key={item.id || idx} className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${subPanelBg}`}>
                          <div>
                            <p className="font-bold">{item.product_name || 'Artículo'}</p>
                            <p className="opacity-75">Cantidad: <span className="text-emerald-400 font-bold">{item.quantity}</span> x Costo: Q {item.cost_price}</p>
                          </div>
                          <span className="font-bold text-emerald-400" translate="no">Q {(item.quantity * item.cost_price).toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">💳 Historial de Abonos Realizados</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {purchasePaymentsList.length === 0 ? (
                      <p className="text-xs opacity-75 italic">No hay abonos registrados todavía.</p>
                    ) : (
                      purchasePaymentsList.map((pay: any, idx: number) => (
                        <div key={pay.id || idx} className={`p-2.5 rounded-xl border text-xs space-y-1 ${subPanelBg}`}>
                          <div className="flex justify-between font-bold text-sm">
                            <span className="text-emerald-400">Abono #{idx + 1}</span>
                            <span className="text-emerald-500">Q {pay.amount}</span>
                          </div>
                          <p className="opacity-80">Método: <strong>{pay.payment_method}</strong> | Ref: {pay.reference || 'N/A'}</p>
                          {pay.notes && <p className="opacity-75 italic">Notas: {pay.notes}</p>}
                          <p className="text-[10px] opacity-60">Fecha: {new Date(pay.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-opacity-50 flex justify-end">
              <button onClick={() => setViewingPaymentsPurchase(null)} className="bg-slate-600 hover:bg-slate-500 px-5 py-2 rounded-xl text-xs font-bold text-white">
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR ABONO */}
      {selectedPurchaseForPayment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-2xl border border-emerald-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-400">💳 Registrar Abono a Proveedor</h3>
              <button onClick={() => setSelectedPurchaseForPayment(null)} className="font-bold text-base opacity-75 hover:opacity-100">✕</button>
            </div>

            <div className={`p-3 rounded-xl border text-xs space-y-1 ${subPanelBg}`}>
              <p className="font-bold">Factura: {selectedPurchaseForPayment.invoice_number}</p>
              <p className="text-amber-400 font-bold text-sm">Saldo Pendiente Actual: Q {selectedPurchaseForPayment.balance}</p>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs mb-1 opacity-75">Monto del Abono (Q) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  max={selectedPurchaseForPayment.balance} 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  placeholder="0.00" 
                  className={`w-full border p-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 ${inputBg}`} 
                  required 
                  autoFocus 
                />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-75">Forma de Pago</label>
                <select value={paymentMethodType} onChange={e => setPaymentMethodType(e.target.value)} className={`w-full border p-2.5 rounded-xl text-sm outline-none ${inputBg}`}>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-75">Referencia / No. de Boleta</label>
                <input type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Ej. REF-12345" className={`w-full border p-2.5 rounded-xl text-sm outline-none ${inputBg}`} />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-75">Notas</label>
                <input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Observaciones..." className={`w-full border p-2.5 rounded-xl text-sm outline-none ${inputBg}`} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submittingPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 shadow">
                  {submittingPayment ? 'Procesando...' : 'Confirmar Abono'}
                </button>
                <button type="button" onClick={() => setSelectedPurchaseForPayment(null)} className="bg-slate-600 hover:bg-slate-500 px-4 py-2.5 rounded-xl text-sm text-white">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}