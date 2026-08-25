'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function CreditAccountsPage() {
  const [credits, setCredits] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCredit, setSelectedCredit] = useState<any | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [businessId, setBusinessId] = useState<string>('')
  
  // Estados para Comprobante, Historial y Detalle
  const [receiptData, setReceiptData] = useState<any | null>(null)
  const [historyCredit, setHistoryCredit] = useState<any | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [saleItemsModal, setSaleItemsModal] = useState<any | null>(null)
  const [saleItemsList, setSaleItemsList] = useState<any[]>([])
  const [loadingSaleItems, setLoadingSaleItems] = useState(false)

  const router = useRouter()

  useEffect(() => {
    const staffStr = localStorage.getItem('currentStaff')
    const bizStr = localStorage.getItem('currentBusiness')

    let resolvedBizId = ''

    if (bizStr) {
      try {
        const biz = JSON.parse(bizStr)
        resolvedBizId = biz.id || biz.business_id || biz.busines_id
      } catch (e) {}
    }

    if (!resolvedBizId && staffStr) {
      try {
        const staff = JSON.parse(staffStr)
        const role = staff.role ? staff.role.toLowerCase() : ''
        
        if (role !== 'encargado' && role !== 'admin' && role !== 'administrador') {
          alert("⚠️ Acceso restringido: Solo el encargado o el dueño pueden ver el módulo de acreedores.")
          router.push('/pos')
          return
        }
        resolvedBizId = staff.business_id || staff.busines_id
      } catch (e) {}
    }

    if (!resolvedBizId) {
      resolvedBizId = 'a15d7206-589f-40d0-9ddc-2efea2b475ee'
    }

    if (resolvedBizId) {
      setBusinessId(resolvedBizId)
      loadBranches(resolvedBizId)
      loadCredits(resolvedBizId)
    } else {
      router.push('/')
    }
  }, [router])

  async function loadBranches(bId: string) {
    const { data, error } = await supabase.rpc('get_branches_safe', { p_business_id: bId })
    if (!error && data) {
      setBranches(data)
    }
  }

  async function loadCredits(bId: string) {
    const { data, error } = await supabase.rpc('get_business_credit_accounts', {
      p_business_id: bId
    })

    if (!error && data) {
      setCredits(data)
    } else {
      console.error("Error al cargar créditos vía RPC:", error?.message)
    }
  }

  async function handleOpenHistory(credit: any) {
    setHistoryCredit(credit)
    setLoadingHistory(true)
    const { data, error } = await supabase.rpc('get_credit_payments_safe', {
      p_credit_account_id: credit.id
    })
    setLoadingHistory(false)
    if (!error && data) {
      setPaymentHistory(data)
    } else {
      setPaymentHistory([])
    }
  }

  async function handleViewSaleDetails(credit: any) {
    setSaleItemsModal(credit)
    setLoadingSaleItems(true)
    const { data, error } = await supabase.rpc('get_credit_sale_items', {
      p_credit_account_id: credit.id
    })
    setLoadingSaleItems(false)
    if (!error && data) {
      setSaleItemsList(data)
    } else {
      setSaleItemsList([])
    }
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCredit || !paymentAmount) return

    const amountNum = parseFloat(paymentAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return alert("Ingresa un monto de abono válido.")
    }

    if (amountNum > selectedCredit.balance) {
      return alert("El abono no puede ser mayor al saldo pendiente actual.")
    }

    setIsSubmitting(true)

    const { data, error } = await supabase.rpc('register_credit_payment_safe', {
      p_credit_account_id: selectedCredit.id,
      p_amount: amountNum,
      p_payment_method: paymentMethod
    })

    setIsSubmitting(false)

    if (error || !data?.success) {
      alert("Error al registrar el abono: " + (error?.message || data?.message))
    } else {
      const currentCreditSnapshot = { ...selectedCredit }
      setSelectedCredit(null)
      setPaymentAmount('')
      setPaymentMethod('Efectivo')

      setReceiptData({
        customer: currentCreditSnapshot.customer,
        totalCreditAmount: data.total_amount,
        previousBalance: currentCreditSnapshot.balance,
        amountPaid: amountNum,
        newBalance: data.new_balance,
        status: data.status,
        paymentMethod: paymentMethod,
        saleDate: data.sale_date,
        saleItems: data.sale_items || [],
        date: new Date().toLocaleString()
      })

      loadCredits(businessId)
    }
  }

  const filteredCredits = credits.filter(c => {
    const branchMatch = selectedBranchFilter === 'ALL' || !c.sale?.branch_id || c.sale?.branch_id === selectedBranchFilter
    
    const custName = c.customer?.name?.toLowerCase() || ''
    const custNit = c.customer?.nit?.toLowerCase() || ''
    const custDpi = c.customer?.dpi?.toLowerCase() || ''
    const query = searchTerm.toLowerCase()
    
    const searchMatch = custName.includes(query) || custNit.includes(query) || custDpi.includes(query)

    return branchMatch && searchMatch
  })

  const totalDebt = filteredCredits.reduce((acc, c) => acc + Number(c.balance || 0), 0)

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 sm:p-6 notranslate" translate="no">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-emerald-400">📋 Módulo de Acreedores / Cuentas por Cobrar</h1>
            <p className="text-xs sm:text-sm text-slate-400">Control de créditos independientes, detalle de compras y abonos</p>
          </div>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            ← Volver al Dashboard
          </button>
        </div>

        {/* FILTRO POR SUCURSAL Y RESUMEN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#1e293b] border border-slate-700 p-4 rounded-2xl shadow flex flex-col justify-between">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">Filtrar por Sucursal</label>
            <select 
              value={selectedBranchFilter} 
              onChange={e => setSelectedBranchFilter(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-xs sm:text-sm font-semibold text-emerald-400 outline-none"
            >
              <option value="ALL">🏢 Todas las Sucursales</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-[#1e293b] border border-slate-700 p-4 rounded-2xl shadow">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Deuda Global Filtrada</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1" translate="no">Q {totalDebt.toFixed(2)}</p>
          </div>
          <div className="bg-[#1e293b] border border-slate-700 p-4 rounded-2xl shadow">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Créditos Mostrados</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1">{filteredCredits.length}</p>
          </div>
        </div>

        {/* Buscador y Tabla */}
        <div className="bg-[#1e293b] border border-slate-700 p-4 rounded-2xl shadow space-y-3">
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar por nombre del cliente, NIT o DPI..."
            className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded-xl text-sm outline-none focus:border-emerald-500 text-white"
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="p-3">Cliente</th>
                  <th className="p-3">NIT / DPI</th>
                  <th className="p-3">Detalle de Compra</th>
                  <th className="p-3">Total Crédito</th>
                  <th className="p-3">Saldo Pendiente</th>
                  <th className="p-3">Límite / Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredCredits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">No hay cuentas por cobrar registradas.</td>
                  </tr>
                ) : (
                  filteredCredits.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                      <td 
                        onClick={() => handleOpenHistory(c)}
                        className="p-3 font-semibold text-emerald-400 cursor-pointer hover:underline"
                        title="Ver historial de abonos"
                      >
                        {c.customer?.name || 'Cliente General'}
                        <span className="block text-[10px] text-slate-400">Ver historial de abonos ➔</span>
                      </td>
                      <td className="p-3 text-slate-300">NIT: {c.customer?.nit || 'CF'}<br/><span className="text-[10px] text-slate-500">DPI: {c.customer?.dpi || 'N/A'}</span></td>
                      <td className="p-3">
                        <button 
                          onClick={() => handleViewSaleDetails(c)}
                          className="bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/50 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          📦 Ver Productos
                        </button>
                      </td>
                      <td className="p-3" translate="no">Q {Number(c.total_amount).toFixed(2)}</td>
                      <td className="p-3 font-bold text-emerald-400" translate="no">Q {Number(c.balance).toFixed(2)}</td>
                      <td className="p-3">
                        <span className="text-amber-300 block text-[11px]">{c.due_date}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 inline-block ${c.status === 'Pagado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                          {c.status || 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {c.balance > 0 && (
                          <button 
                            onClick={() => setSelectedCredit(c)}
                            className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer"
                          >
                            💰 Abonar / Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL: DETALLE DE PRODUCTOS DE LA VENTA */}
      {saleItemsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e293b] border border-sky-500 p-5 rounded-2xl w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-sky-400">📦 Detalle de Productos de la Compra</h3>
                <p className="text-xs text-slate-300 font-semibold mt-0.5">Cliente: {saleItemsModal.customer?.name}</p>
              </div>
              <button onClick={() => setSaleItemsModal(null)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {loadingSaleItems ? (
                <p className="text-xs text-slate-500 text-center py-4">Cargando productos...</p>
              ) : saleItemsList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 bg-[#0f172a] rounded-xl border border-slate-800">
                  No se encontraron productos asociados a esta compra.
                </p>
              ) : (
                saleItemsList.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-[#0f172a] p-3 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <p className="font-semibold text-white">{item.product_name}</p>
                      <p className="text-[11px] text-slate-400">{item.quantity} unids. x Q {Number(item.price_at_sale).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400" translate="no">Q {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setSaleItemsModal(null)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL DE ABONOS */}
      {historyCredit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e293b] border border-slate-600 p-5 rounded-2xl w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-emerald-400">📜 Historial de Abonos</h3>
                <p className="text-xs text-slate-300 font-semibold mt-0.5">Cliente: {historyCredit.customer?.name}</p>
              </div>
              <button onClick={() => setHistoryCredit(null)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#0f172a] p-3 rounded-xl border border-slate-700">
              <div>
                <span className="text-slate-400 block">Total del Crédito:</span>
                <strong className="text-white text-sm" translate="no">Q {Number(historyCredit.total_amount).toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Saldo Pendiente Actual:</span>
                <strong className="text-emerald-400 text-sm" translate="no">Q {Number(historyCredit.balance).toFixed(2)}</strong>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <p className="text-xs font-bold text-slate-400 uppercase">Pagos Registrados:</p>
              {loadingHistory ? (
                <p className="text-xs text-slate-500 text-center py-4">Cargando abonos...</p>
              ) : paymentHistory.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 bg-[#0f172a] rounded-xl border border-slate-800">
                  No hay abonos registrados para este crédito todavía.
                </p>
              ) : (
                paymentHistory.map((pay, index) => (
                  <div key={pay.id || index} className="flex justify-between items-center bg-[#0f172a] p-3 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <p className="font-semibold text-emerald-400" translate="no">Q {Number(pay.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400">Método: {pay.payment_method || 'Efectivo'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-300">{new Date(pay.created_at).toLocaleString()}</p>
                      <span className="text-[9px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800 font-bold">Abono #{paymentHistory.length - index}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setHistoryCredit(null)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer">
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Registrar Abono */}
      {selectedCredit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e293b] border border-emerald-500 p-5 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-emerald-400">💰 Registrar Abono o Pago Parcial</h3>
            <div className="bg-[#0f172a] p-3 rounded-xl border border-slate-700 text-xs space-y-1">
              <p className="text-white font-semibold">Cliente: {selectedCredit.customer?.name}</p>
              <p className="text-slate-400">Saldo Actual Pendiente: <strong className="text-emerald-400" translate="no">Q {Number(selectedCredit.balance).toFixed(2)}</strong></p>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Monto del Abono (Q) *</label>
                <input 
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-sm font-bold text-emerald-400 outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Método de Pago</label>
                <select 
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded-xl text-xs font-semibold text-emerald-400 outline-none"
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Tarjeta">💳 Tarjeta</option>
                  <option value="Transferencia">📱 Transferencia</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer">
                  {isSubmitting ? 'Procesando...' : 'Confirmar Abono'}
                </button>
                <button type="button" onClick={() => { setSelectedCredit(null); setPaymentAmount(''); }} className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE COMPROBANTE / RECIBO DE ABONO */}
      {receiptData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white text-slate-900 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4 print:shadow-none">
            
            <div className="text-center border-b border-slate-200 pb-3 space-y-1">
              <h2 className="text-base font-extrabold text-emerald-700">🧾 COMPROBANTE DE ABONO</h2>
              <p className="text-[11px] text-slate-500">Fecha del Comprobante: {receiptData.date}</p>
            </div>

            <div className="text-xs space-y-1.5 border-b border-slate-200 pb-3">
              <p><strong>Cliente:</strong> {receiptData.customer?.name}</p>
              <p><strong>NIT:</strong> {receiptData.customer?.nit || 'CF'} | <strong>DPI:</strong> {receiptData.customer?.dpi || 'N/A'}</p>
              <p><strong>Fecha de Compra al Crédito:</strong> {receiptData.saleDate ? new Date(receiptData.saleDate).toLocaleString() : 'N/A'}</p>
              <p><strong>Método de Pago:</strong> {receiptData.paymentMethod}</p>
            </div>

            {/* Detalle de productos de la compra */}
            <div className="text-xs space-y-1 border-b border-slate-200 pb-3">
              <p className="font-bold text-slate-700 uppercase">Detalle de la Factura:</p>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {receiptData.saleItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span translate="no">Q {Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between border-b border-slate-200 pb-1 text-slate-700 font-semibold">
                <span>Total de Compra Original:</span>
                <span translate="no">Q {Number(receiptData.totalCreditAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Saldo Anterior:</span>
                <span className="font-semibold" translate="no">Q {Number(receiptData.previousBalance).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Monto Abonado:</span>
                <span translate="no">Q {Number(receiptData.amountPaid).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 font-extrabold text-slate-900">
                <span>Saldo Pendiente:</span>
                <span translate="no">Q {Number(receiptData.newBalance).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center py-1">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${receiptData.newBalance <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {receiptData.newBalance <= 0 ? '✨ ¡CUENTA PAGADA / AL DÍA!' : '📌 ESTADO: PENDIENTE'}
              </span>
            </div>

            <div className="flex gap-2 pt-2 print:hidden">
              <button onClick={() => window.print()} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow">
                🖨️ Imprimir Recibo
              </button>
              <button onClick={() => setReceiptData(null)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer">
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}