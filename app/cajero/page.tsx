'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function CashierPage() {
  const [businessId, setBusinessId] = useState<string>('')
  const [businessLogo, setBusinessLogo] = useState<string>('')
  const [businessName, setBusinessName] = useState<string>('Negocio')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [branchName, setBranchName] = useState<string>('Sucursal')
  const [staffId, setStaffId] = useState<string>('')
  const [staffName, setStaffName] = useState<string>('Cajero')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  
  // Estados para Cobro, Facturación y Vuelto
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta'>('efectivo')
  const [customerNit, setCustomerNit] = useState('CF')
  const [customerName, setCustomerName] = useState('Consumidor Final')
  const [voucherNumber, setVoucherNumber] = useState('')
  const [cashGiven, setCashGiven] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Estados para Apertura y Cierre de Caja (Día)
  const [cashRegister, setCashRegister] = useState<any>(null)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [openingAmountInput, setOpeningAmountInput] = useState('')
  const [closingPhysicalCash, setClosingPhysicalCash] = useState('')

  // Pestañas y reportes del turno
  const [rightTab, setRightTab] = useState<'gestion' | 'ventas'>('gestion')
  const [todaySales, setTodaySales] = useState<any[]>([])
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any[] | null>(null)

  const router = useRouter()

  useEffect(() => {
    const staffStr = localStorage.getItem('currentStaff')
    const bizStr = localStorage.getItem('currentBusiness')
    
    let resolvedBizId = ''
    let resolvedBranchId = ''
    let resolvedBranchName = 'Sucursal Asignada'
    let resolvedStaffId = ''
    let resolvedStaffName = 'Cajero'

    if (staffStr) {
      try {
        const staff = JSON.parse(staffStr)
        resolvedBizId = staff.business_id
        resolvedBranchId = staff.branch_id
        resolvedBranchName = staff.branch_name || 'Sucursal Asignada'
        resolvedStaffId = staff.id || ''
        resolvedStaffName = staff.name || 'Cajero'
      } catch (e) {}
    }

    if (!resolvedBizId && bizStr) {
      try {
        const biz = JSON.parse(bizStr)
        if (biz.id) resolvedBizId = biz.id
      } catch (e) {}
    }

    if (resolvedBizId) {
      setBusinessId(resolvedBizId)
      setStaffId(resolvedStaffId)
      setStaffName(resolvedStaffName)
      if (resolvedBranchId) {
        setSelectedBranch(resolvedBranchId)
        setBranchName(resolvedBranchName)
        loadPendingOrders(resolvedBranchId)
        checkCashRegisterStatus(resolvedBranchId, resolvedBizId)
      }
      fetchBusinessInfo(resolvedBizId)
    } else {
      router.push('/')
    }
  }, [router])

  // --- AUTOREFRESH CADA 10 SEGUNDOS (SI NO ESTÁ EN PLENA GESTIÓN DE COBRO) ---
  useEffect(() => {
    if (!selectedBranch || !cashRegister) return

    const interval = setInterval(() => {
      if (!selectedOrder) {
        loadPendingOrders(selectedBranch)
        if (cashRegister) {
          loadTodaySales(businessId, selectedBranch, cashRegister.opened_at)
        }
      }
    }, 10000) // 10 segundos[cite: 4]

    return () => clearInterval(interval)
  }, [selectedBranch, cashRegister, selectedOrder, businessId])

  async function fetchBusinessInfo(bId: string) {
    const { data, error } = await supabase.rpc('get_business_info_safe', { p_business_id: bId })
    if (!error && data && data.length > 0) {
      if (data[0].business_name) setBusinessName(data[0].business_name)
      if (data[0].logo_url) setBusinessLogo(data[0].logo_url)
    }
  }

  async function loadPendingOrders(branchId: string) {
    if (!branchId) return
    const { data, error } = await supabase.rpc('get_pending_orders_safe', { p_branch_id: branchId })
    if (!error && data) setPendingOrders(data)
  }

  async function checkCashRegisterStatus(branchId: string, bId?: string) {
    const { data, error } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('branch_id', branchId)
      .eq('status', 'abierta')
      .order('opened_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      setCashRegister(data[0])
      loadTodaySales(bId || businessId, branchId, data[0].opened_at)
    } else {
      setCashRegister(null)
      setTodaySales([])
    }
  }

  async function loadTodaySales(bId: string, branchId: string, openedAt: string) {
    if (!openedAt) return
    const { data, error } = await supabase.rpc('get_today_sales_safe', {
      p_business_id: bId || businessId,
      p_branch_id: branchId,
      p_since_timestamp: openedAt
    })

    if (!error && data) {
      setTodaySales(data)
    }
  }

  async function handleOpenDay(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(openingAmountInput)
    if (isNaN(amount) || amount < 0) {
      return alert("Ingresa un monto de apertura válido.")
    }

    const { error } = await supabase.from('cash_registers').insert({
      business_id: businessId,
      branch_id: selectedBranch,
      opened_by: staffId || null,
      opening_amount: amount,
      status: 'abierta'
    })

    if (error) {
      alert("Error al abrir la caja: " + error.message)
    } else {
      alert("¡Inicio de día registrado con éxito! Las ventas inician desde cero.")
      setShowOpenModal(false)
      setOpeningAmountInput('')
      checkCashRegisterStatus(selectedBranch, businessId)
    }
  }

  async function handleCloseDay(e: React.FormEvent, physicalCash: number, totalSalesRecord: number) {
    e.preventDefault()
    if (!cashRegister) return

    const { error } = await supabase.rpc('close_cash_register', {
      p_register_id: cashRegister.id,
      p_closing_amount: physicalCash,
      p_total_sales: totalSalesRecord,
      p_staff_id: staffId || null
    })

    if (error) {
      alert("Error al cerrar caja: " + error.message)
    } else {
      alert(`¡Cierre de día registrado con éxito!\nFondo Inicial: Q ${cashRegister.opening_amount}\nVentas Totales del Turno: Q ${totalSalesRecord.toFixed(2)}\nEfectivo Exacto en Caja: Q ${physicalCash.toFixed(2)}`)
      setShowCloseModal(false)
      setClosingPhysicalCash('')
      setCashRegister(null)
      setTodaySales([])
    }
  }

  // --- FUNCIÓN PARA ABRIR VENTANA EMERGENTE DE LA SAT ---
  const openSatPortal = () => {
    const width = 1050
    const height = 700
    const left = (window.innerWidth - width) / 2
    const top = (window.innerHeight - height) / 2
    const satUrl = 'https://portal.sat.gob.gt/'
    window.open(
      satUrl,
      'PortalSAT',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
    )
  }

  async function handleSelectOrder(order: any) {
    setSelectedOrder(order)
    setLoading(true)
    setRightTab('gestion')

    if (order.customer_nit) setCustomerNit(order.customer_nit)
    else setCustomerNit('CF')

    if (order.customer_name) setCustomerName(order.customer_name)
    else setCustomerName('Consumidor Final')

    setVoucherNumber('')
    setCashGiven('')

    const { data, error } = await supabase.rpc('get_order_details_safe', { p_order_id: order.id })
    setLoading(false)
    if (!error && data) setOrderItems(data)
    else setOrderItems([])
  }

  async function handleNitChange(nitText: string) {
    const nit = nitText.toUpperCase()
    setCustomerNit(nit)

    if (!nit.trim() || nit === 'CF') {
      setCustomerName('Consumidor Final')
      return
    }

    const { data, error } = await supabase.rpc('get_customer_by_nit', {
      p_business_id: businessId,
      p_customer_nit: nit.trim()
    })

    if (!error && data && data.length > 0) {
      setCustomerName(data[0].name)
    } else {
      setCustomerName('')
    }
  }

  async function handlePayOrder() {
    if (!cashRegister) {
      alert("La caja de esta sucursal está cerrada. Debes dar 'Inicio de Día' antes de cobrar.")
      return
    }

    if (!selectedOrder) return

    if (!customerNit.trim() || !customerName.trim()) {
      alert("Por favor ingresa el NIT y el Nombre del cliente.")
      return
    }

    if (paymentMethod === 'tarjeta' && !voucherNumber.trim()) {
      alert("Por favor ingresa el número de voucher de la tarjeta de crédito.")
      return
    }

    if (paymentMethod === 'efectivo') {
      const given = parseFloat(cashGiven)
      const total = Number(selectedOrder.total_amount)
      if (isNaN(given) || given < total) {
        return alert("El efectivo entregado por el cliente es menor al total a cobrar.")
      }
    }

    const { error } = await supabase.rpc('pay_and_close_order', {
      p_order_id: selectedOrder.id,
      p_payment_method: paymentMethod,
      p_customer_nit: customerNit,
      p_customer_name: customerName,
      p_voucher_number: paymentMethod === 'tarjeta' ? voucherNumber.trim() : null
    })

    if (error) {
      alert("Error al cobrar la orden: " + error.message)
    } else {
      alert("¡Cobro exitoso! Venta registrada correctamente.")
      setSelectedOrder(null)
      setOrderItems([])
      setCustomerNit('CF')
      setCustomerName('Consumidor Final')
      setVoucherNumber('')
      setCashGiven('')
      loadPendingOrders(selectedBranch)
      if (cashRegister) loadTodaySales(businessId, selectedBranch, cashRegister.opened_at)
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm("¿Estás seguro de cancelar esta orden?")) return

    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId })

    if (error) {
      alert("Error al cancelar: " + error.message)
    } else {
      alert("Orden cancelada correctamente.")
      setSelectedOrder(null)
      setOrderItems([])
      loadPendingOrders(selectedBranch)
    }
  }

  async function handleViewSaleDetails(saleId: string) {
    const { data, error } = await supabase.rpc('get_sale_details', { p_sale_id: saleId })
    if (!error && data) setSelectedSaleDetails(data)
  }

  const handleLogout = async () => {
    localStorage.clear()
    await supabase.auth.signOut()
    router.push('/')
  }

  const filteredOrders = pendingOrders.filter(order => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    const orderNum = (order.order_number || '').toLowerCase()
    const customerName = (order.customer_name || '').toLowerCase()
    const customerNit = (order.customer_nit || '').toLowerCase()
    return orderNum.includes(term) || customerName.includes(term) || customerNit.includes(term)
  })

  const totalTodaySales = todaySales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)
  const cashChange = paymentMethod === 'efectivo' && selectedOrder && cashGiven ? Math.max(0, parseFloat(cashGiven) - Number(selectedOrder.total_amount)) : 0

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-white flex flex-col w-full notranslate" translate="no">
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex flex-wrap justify-between items-center gap-4 border border-slate-750">
        <div className="flex items-center gap-4">
          {businessLogo ? (
            <img src={businessLogo} alt="Logo" className="w-10 h-10 object-cover rounded-lg border border-slate-600 shadow" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center font-bold text-emerald-400 text-sm uppercase">
              {businessName ? businessName.substring(0, 2) : 'NE'}
            </div>
          )}

          <h1 className="text-xl font-bold text-emerald-400">💵 Caja / Control de Órdenes</h1>
          
          <div className="bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-emerald-300 font-bold text-sm flex items-center gap-2">
            <span>📍 {branchName}</span>
            <span className="text-xs text-slate-400 font-normal">({staffName})</span>
          </div>

          <div className="flex items-center gap-2 pl-4 border-l border-slate-750">
            {cashRegister ? (
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Caja Abierta (Inicio: Q {cashRegister.opening_amount})
                </span>
                <button 
                  onClick={() => setShowCloseModal(true)}
                  className="bg-amber-600 hover:bg-amber-500 text-xs px-3 py-1.5 rounded font-bold transition-colors"
                >
                  🔒 Cierre de Día
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  Caja Cerrada
                </span>
                <button 
                  onClick={() => setShowOpenModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-xs px-3 py-1.5 rounded font-bold transition-colors shadow"
                >
                  ☀️ Inicio de Día
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 max-w-xs">
          <input 
            type="text"
            placeholder="🔍 Buscar No. Orden, NIT o Nombre..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-white text-sm outline-none focus:border-emerald-500 placeholder-slate-500"
          />
        </div>
        
        <div className="flex gap-2 items-center">
          {/* BOTÓN RÁPIDO PARA ABRIR LA SAT EN VENTANA EMERGENTE */}
          <button 
            onClick={openSatPortal} 
            className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded font-semibold text-sm transition-colors shadow flex items-center gap-1.5 text-white"
            title="Abrir portal de la SAT para emitir factura"
          >
            🏛️ Facturar en SAT
          </button>

          <button onClick={() => { loadPendingOrders(selectedBranch); if(cashRegister) loadTodaySales(businessId, selectedBranch, cashRegister.opened_at); }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-semibold text-sm">
            🔄 Actualizar
          </button>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-semibold text-sm transition-colors shadow">
            🚪 Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Columna 1 y 2: Listado de Órdenes Pendientes */}
        <div className="lg:col-span-2 bg-[#1e293b] p-5 rounded-lg border border-slate-750 flex flex-col">
          <h2 className="text-base font-bold text-slate-300 mb-4">Comandas en Espera de Pago ({filteredOrders.length})</h2>

          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-lg">No hay órdenes pendientes en este momento.</p>
              </div>
            ) : (
              filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => handleSelectOrder(order)}
                  className={`bg-[#0f172a] p-4 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${
                    selectedOrder?.id === order.id ? 'border-emerald-500 shadow-lg bg-slate-800/60' : 'border-slate-750 hover:border-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="bg-emerald-500/20 text-emerald-400 font-mono font-bold px-2.5 py-0.5 rounded text-sm">
                        Orden #{order.order_number || 'S/N'}
                      </span>
                      <span className="text-xs bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded">Pendiente</span>
                      <span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="font-bold text-white text-base">Cliente: {order.customer_name || 'Consumidor Final'}</p>
                    <p className="text-xs text-slate-300">NIT: <span className="font-mono text-emerald-300">{order.customer_nit || 'CF'}</span></p>
                  </div>

                  <div className="text-right">
                    <span className="text-emerald-400 font-extrabold text-xl" translate="no">Q {order.total_amount}</span>
                    <p className="text-xs text-slate-400 mt-1">Clic para gestionar</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna 3: Pestañas de Cobro / Reporte de Ventas */}
        <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-750 flex flex-col justify-between">
          <div>
            <div className="grid grid-cols-2 gap-1.5 mb-4 bg-[#0f172a] p-1.5 rounded border border-slate-750 text-xs font-bold">
              <button 
                onClick={() => setRightTab('gestion')}
                className={`py-2 rounded transition-colors ${rightTab === 'gestion' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                💳 Cobrar Orden
              </button>
              <button 
                onClick={() => setRightTab('ventas')}
                className={`py-2 rounded transition-colors ${rightTab === 'ventas' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                📊 Ventas de mi Caja ({todaySales.length})
              </button>
            </div>

            {rightTab === 'gestion' && (
              <div>
                <h2 className="text-base font-bold text-emerald-400 mb-3">Detalle de la Orden y Cobro</h2>

                {selectedOrder ? (
                  <div className="space-y-3">
                    <div className="bg-[#0f172a] p-3 rounded border border-slate-750 text-xs space-y-1">
                      <p><span className="text-slate-400">Orden No:</span> <span className="font-bold font-mono text-emerald-400 text-sm">#{selectedOrder.order_number || 'S/N'}</span></p>
                    </div>

                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {loading ? (
                        <p className="text-center text-slate-400 py-2">Cargando...</p>
                      ) : orderItems.map((item, idx) => (
                        <div key={idx} className="bg-[#0f172a] p-2 rounded border border-slate-800 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-white">{item.product_name}</p>
                            <p className="text-slate-400">{item.quantity} x Q {item.price}</p>
                          </div>
                          <span className="font-bold text-emerald-400" translate="no">Q {item.quantity * item.price}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-750 space-y-2 text-xs">
                      <div>
                        <label className="text-slate-300 font-medium block mb-1">NIT del Cliente (o CF)</label>
                        <input 
                          type="text"
                          value={customerNit}
                          onChange={e => handleNitChange(e.target.value)}
                          placeholder="CF o Número de NIT"
                          className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white font-semibold uppercase outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Nombre / Razón Social</label>
                        <input 
                          type="text"
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="Nombre del cliente"
                          className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 font-medium block mb-1">Método de Pago</label>
                        <select 
                          value={paymentMethod} 
                          onChange={e => setPaymentMethod(e.target.value as any)} 
                          className="w-full bg-[#0f172a] p-2 rounded border border-slate-600 outline-none text-white font-medium"
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta">Tarjeta de Crédito / Débito</option>
                        </select>
                      </div>

                      {paymentMethod === 'efectivo' && (
                        <div className="bg-[#0f172a] p-2.5 rounded border border-emerald-500/40 space-y-2">
                          <div>
                            <label className="text-emerald-400 font-bold block mb-1">💵 Efectivo Recibido (Q)</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={cashGiven}
                              onChange={e => setCashGiven(e.target.value)}
                              placeholder="Monto entregado..."
                              className="w-full bg-[#1e293b] border border-slate-600 p-2 rounded text-white font-bold text-sm outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-bold text-sm">
                            <span className="text-slate-300">Vuelto:</span>
                            <span className="text-emerald-400" translate="no">Q {cashChange.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'tarjeta' && (
                        <div>
                          <label className="text-emerald-400 font-bold block mb-1">💳 No. de Voucher de Tarjeta</label>
                          <input 
                            type="text"
                            value={voucherNumber}
                            onChange={e => setVoucherNumber(e.target.value)}
                            placeholder="Ingrese número de baucher..."
                            className="w-full bg-[#0f172a] border border-emerald-500 p-2 rounded text-white outline-none font-mono"
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 text-sm">
                    Selecciona una orden de la lista para ver su detalle y cobrar.
                  </div>
                )}
              </div>
            )}

            {rightTab === 'ventas' && (
              <div className="space-y-3">
                <div className="bg-[#0f172a] p-3 rounded-lg border border-emerald-500/40 flex justify-between items-center shadow">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Ventas de mi Turno Actual</p>
                    <p className="text-base font-extrabold text-emerald-400" translate="no">Q {totalTodaySales}</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                    {todaySales.length} {todaySales.length === 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">💡 Clic en cualquier venta para ver los productos.</p>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {todaySales.length === 0 ? (
                    <p className="text-slate-400 text-center py-10 text-xs">No hay ventas registradas en este turno aún.</p>
                  ) : (
                    todaySales.map((sale) => (
                      <div 
                        key={sale.sale_id}
                        onClick={() => handleViewSaleDetails(sale.sale_id)}
                        className="bg-[#0f172a] p-3 rounded border border-slate-750 hover:border-emerald-500 cursor-pointer transition-all space-y-1 text-xs"
                      >
                        <div className="flex justify-between font-bold text-white">
                          <span>NIT: {sale.customer_nit}</span>
                          <span className="text-emerald-400" translate="no">Q {sale.total_amount}</span>
                        </div>
                        <p className="text-[11px] text-slate-300">Cliente: {sale.customer_name}</p>
                        <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                          <span className="uppercase text-amber-300 font-semibold">{sale.payment_method} {sale.voucher_number ? `(#${sale.voucher_number})` : ''}</span>
                          <span>{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {rightTab === 'gestion' && selectedOrder && (
            <div className="border-t border-slate-750 pt-3 mt-3 space-y-2">
              <div className="flex justify-between items-center font-bold text-base mb-1">
                <span>Total a Cobrar:</span>
                <span className="text-emerald-400 text-lg" translate="no">Q {selectedOrder.total_amount}</span>
              </div>

              <button 
                onClick={handlePayOrder}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-lg font-bold text-sm shadow transition-colors"
              >
                💳 Cobrar y Cerrar Orden
              </button>

              <button 
                onClick={() => handleCancelOrder(selectedOrder.id)}
                className="w-full bg-red-700 hover:bg-red-600 py-2 rounded-lg font-semibold text-xs shadow transition-colors"
              >
                ❌ Cancelar Orden (Devuelve Stock)
              </button>
            </div>
          )}
        </div>

      </div>

      {/* --- MODAL DETALLE DE VENTA --- */}
      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-sm text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="text-base font-bold text-emerald-400">📦 Detalle de la Venta</h3>
              <button onClick={() => setSelectedSaleDetails(null)} className="text-slate-400 hover:text-white font-bold text-base">✕</button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
              {selectedSaleDetails.map((item, idx) => (
                <div key={idx} className="bg-[#0f172a] p-2.5 rounded border border-slate-700 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white">{item.product_name}</p>
                    <p className="text-slate-400">{item.quantity} x Q {item.price_at_sale}</p>
                  </div>
                  <span className="font-bold text-emerald-400" translate="no">Q {item.quantity * item.price_at_sale}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedSaleDetails(null)} className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded text-sm font-semibold">
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL INICIO DE DÍA --- */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-sm text-white shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-emerald-400">☀️ Apertura de Caja</h3>
            <p className="text-xs text-slate-300">Ingresa el fondo inicial en efectivo para esta sucursal:</p>
            
            <form onSubmit={handleOpenDay} className="space-y-3">
              <input 
                type="number"
                step="0.01"
                value={openingAmountInput}
                onChange={e => setOpeningAmountInput(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#0f172a] border border-slate-600 p-3 rounded text-white font-bold text-lg outline-none focus:border-emerald-500"
                required
                autoFocus
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded font-bold text-sm">Abrir Caja</button>
                <button type="button" onClick={() => setShowOpenModal(false)} className="bg-slate-700 px-4 py-2.5 rounded text-sm">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL CIERRE DE DÍA / ARQUEO ESTRICTO --- */}
      {showCloseModal && (() => {
        const totalEfectivo = todaySales
          .filter(s => s.payment_method === 'efectivo')
          .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
          
        const totalTarjeta = todaySales
          .filter(s => s.payment_method === 'tarjeta')
          .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
          
        const totalVentasGeneral = totalEfectivo + totalTarjeta;
        const expectedCash = Number(cashRegister?.opening_amount || 0) + totalEfectivo;

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <div className="bg-[#1e293b] p-6 rounded-xl border border-amber-500 w-full max-w-sm text-white shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-amber-400">🔒 Cierre de Caja / Arqueo</h3>
              
              <div className="bg-[#0f172a] p-3 rounded border border-slate-700 text-xs space-y-1.5">
                <p><span className="text-slate-400">Cajero en Turno:</span> <span className="font-bold text-white">{staffName}</span></p>
                <p><span className="text-slate-400">Fondo Inicial:</span> <span className="font-bold text-emerald-400">Q {Number(cashRegister?.opening_amount || 0).toFixed(2)}</span></p>
                
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <p><span className="text-slate-400">Ventas en Efectivo:</span> <span className="font-bold text-emerald-400">Q {totalEfectivo.toFixed(2)}</span></p>
                  <p><span className="text-slate-400">Ventas con Tarjeta:</span> <span className="font-bold text-blue-400">Q {totalTarjeta.toFixed(2)}</span></p>
                  <p className="font-bold text-white pt-1">Total de Ventas (Referencia): Q {totalVentasGeneral.toFixed(2)}</p>
                </div>
                
                <p className="pt-2 border-t border-slate-800 font-bold text-amber-300">
                  Efectivo Teórico Esperado en Gaveta: Q {expectedCash.toFixed(2)}
                </p>
              </div>

              <form onSubmit={(e) => {
                 e.preventDefault();
                 const physicalCash = parseFloat(closingPhysicalCash);
                 if (Math.abs(physicalCash - expectedCash) > 0.01) {
                   return alert(`❌ Error: El efectivo físico (Q ${physicalCash.toFixed(2)}) no cuadra con el efectivo esperado (Q ${expectedCash.toFixed(2)}). Revisa el dinero en caja.`);
                 }
                 handleCloseDay(e, physicalCash, totalVentasGeneral);
              }} className="space-y-3 text-xs">
                <div>
                  <label className="text-emerald-400 font-bold block mb-1">💵 Efectivo Físico Contado (Q)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={closingPhysicalCash}
                    onChange={e => setClosingPhysicalCash(e.target.value)}
                    placeholder="Monto exacto contado..."
                    className="w-full bg-[#0f172a] border border-amber-500 p-3 rounded text-white font-bold text-base outline-none focus:border-emerald-500"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-500 py-2.5 rounded font-bold text-sm">Confirmar Cierre de Día</button>
                  <button type="button" onClick={() => setShowCloseModal(false)} className="bg-slate-700 px-4 py-2.5 rounded text-sm">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  )
}