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
  const [userRole, setUserRole] = useState<string>('')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  
  // Estado para el Menú Lateral Deslizante (Hamburguesa ☰) y Modal Móvil
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isMobileOrderModalOpen, setIsMobileOrderModalOpen] = useState(false)
  
  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Estado para Notificaciones Flotantes (Toast) modernas
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  // Estado para prevenir doble clic al cobrar orden
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  // Estado para Modal de Confirmación de Cancelación de Orden
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null)

  useEffect(() => {
    const savedTheme = localStorage.getItem('cashier_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('cashier_theme', newMode ? 'dark' : 'light')
  }
  
  // Estados para Cobro, Facturación, Vuelto y Pagos Mixtos
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'mixto'>('efectivo')
  const [customerNit, setCustomerNit] = useState('CF')
  const [customerName, setCustomerName] = useState('Consumidor Final')
  const [voucherNumber, setVoucherNumber] = useState('')
  const [cashGiven, setCashGiven] = useState<string>('')
  const [cardAmountMixed, setCardAmountMixed] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Estados para Apertura y Cierre de Caja (Día)
  const [cashRegister, setCashRegister] = useState<any>(null)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [openingAmountInput, setOpeningAmountInput] = useState('')
  const [closingPhysicalCash, setClosingPhysicalCash] = useState('')

  // Reportes del turno
  const [todaySales, setTodaySales] = useState<any[]>([])
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any[] | null>(null)

  const router = useRouter()

  useEffect(() => {
    async function checkBusinessStatusAndRedirect() {
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
          resolvedBizId = staff.business_id || staff.busines_id
          resolvedBranchId = staff.branch_id
          resolvedBranchName = staff.branch_name || 'Sucursal Asignada'
          resolvedStaffId = staff.id || ''
          resolvedStaffName = staff.name || 'Cajero'
          if (staff.role) {
            setUserRole(staff.role.toLowerCase())
          }
        } catch (e) {}
      }

      if (!resolvedBizId && bizStr) {
        try {
          const biz = JSON.parse(bizStr)
          if (biz.id) resolvedBizId = biz.id
        } catch (e) {}
      }

      if (!resolvedBizId) {
        router.push('/')
        return
      }

      const { data: bizDataList, error } = await supabase.rpc('get_business_status_by_id', { p_business_id: resolvedBizId })

      if (!error && bizDataList && bizDataList.length > 0) {
        const bizData = bizDataList[0]
        const bizStatus = (bizData.status || 'activo').toLowerCase()

        if (
          bizStatus !== 'activo' ||
          bizData.payment_status === 'Pendiente' ||
          bizData.payment_status === 'Atrasado'
        ) {
          localStorage.clear()
          showToast("Acceso bloqueado en Caja: Suscripción pendiente o suspendida.", 'error')
          setTimeout(() => router.push('/'), 2000)
          return
        }
      }

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
    }

    checkBusinessStatusAndRedirect()
  }, [router])

  useEffect(() => {
    if (!selectedBranch || !cashRegister) return

    const interval = setInterval(() => {
      if (!selectedOrder) {
        loadPendingOrders(selectedBranch)
        if (cashRegister) {
          loadTodaySales(businessId, selectedBranch, cashRegister.opened_at)
        }
      }
    }, 30000)

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
      return showToast("Ingresa un monto de apertura válido.", 'error')
    }

    const { error } = await supabase.from('cash_registers').insert({
      business_id: businessId,
      branch_id: selectedBranch,
      opened_by: staffId || null,
      opening_amount: amount,
      status: 'abierta'
    })

    if (error) {
      showToast("Error al abrir la caja: " + error.message, 'error')
    } else {
      showToast("¡Inicio de día registrado con éxito! Las ventas inician desde cero.", 'success')
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
      showToast("Error al cerrar caja: " + error.message, 'error')
    } else {
      showToast(`¡Cierre de día registrado con éxito! Ventas Totales: Q ${totalSalesRecord.toFixed(2)}`, 'success')
      setShowCloseModal(false)
      setClosingPhysicalCash('')
      setCashRegister(null)
      setTodaySales([])
    }
  }

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
    setIsMobileOrderModalOpen(true)

    if (order.customer_nit) setCustomerNit(order.customer_nit)
    else setCustomerNit('CF')

    if (order.customer_name) setCustomerName(order.customer_name)
    else setCustomerName('Consumidor Final')

    setVoucherNumber('')
    setCashGiven('')
    setCardAmountMixed('')

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
    if (isSubmittingPayment) return

    if (!cashRegister) {
      showToast("La caja de esta sucursal está cerrada. Debes dar 'Inicio de Día' antes de cobrar.", 'error')
      return
    }

    if (!selectedOrder) return

    if (!customerNit.trim() || !customerName.trim()) {
      showToast("Por favor ingresa el NIT y el Nombre del cliente.", 'error')
      return
    }

    const totalOrderAmount = Number(selectedOrder.total_amount)

    if (paymentMethod === 'tarjeta') {
      if (!voucherNumber.trim()) {
        return showToast("Por favor ingresa el número de voucher de la tarjeta de crédito.", 'error')
      }
    } else if (paymentMethod === 'efectivo') {
      const given = parseFloat(cashGiven)
      if (isNaN(given) || given < totalOrderAmount) {
        return showToast("El efectivo entregado por el cliente es menor al total a cobrar.", 'error')
      }
    } else if (paymentMethod === 'mixto') {
      const cardPart = parseFloat(cardAmountMixed) || 0
      const cashPart = parseFloat(cashGiven) || 0

      if (isNaN(cardPart) || cardPart <= 0) {
        return showToast("Ingresa un monto válido a pagar con tarjeta en el pago mixto.", 'error')
      }
      if (cardPart >= totalOrderAmount) {
        return showToast("El monto con tarjeta no puede ser mayor o igual al total.", 'error')
      }
      if (!voucherNumber.trim()) {
        return showToast("Por favor ingresa el número de voucher para la parte pagada con tarjeta.", 'error')
      }

      const remainingToCover = totalOrderAmount - cardPart
      if (cashPart < remainingToCover) {
        const missing = remainingToCover - cashPart
        return showToast(`El efectivo entregado es insuficiente. Falta Q ${missing.toFixed(2)}.`, 'error')
      }
    }

    setIsSubmittingPayment(true)

    const { error } = await supabase.rpc('pay_and_close_order', {
      p_order_id: selectedOrder.id,
      p_payment_method: paymentMethod,
      p_customer_nit: customerNit,
      p_customer_name: customerName,
      p_voucher_number: (paymentMethod === 'tarjeta' || paymentMethod === 'mixto') ? voucherNumber.trim() : null
    })

    setIsSubmittingPayment(false)

    if (error) {
      showToast("Error al cobrar la orden: " + error.message, 'error')
    } else {
      showToast("¡Cobro exitoso! Venta registrada correctamente.", 'success')
      setSelectedOrder(null)
      setOrderItems([])
      setCustomerNit('CF')
      setCustomerName('Consumidor Final')
      setVoucherNumber('')
      setCashGiven('')
      setCardAmountMixed('')
      setIsMobileOrderModalOpen(false)
      loadPendingOrders(selectedBranch)
      if (cashRegister) loadTodaySales(businessId, selectedBranch, cashRegister.opened_at)
    }
  }

  async function handleConfirmCancelOrder() {
    if (!orderToCancel) return

    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderToCancel.id })

    if (error) {
      showToast("Error al cancelar: " + error.message, 'error')
    } else {
      showToast("Orden cancelada correctamente.", 'success')
      setSelectedOrder(null)
      setOrderItems([])
      setIsMobileOrderModalOpen(false)
      loadPendingOrders(selectedBranch)
    }
    setOrderToCancel(null)
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
  
  const totalAmountNum = selectedOrder ? Number(selectedOrder.total_amount) : 0
  let cashChange = 0
  if (selectedOrder) {
    if (paymentMethod === 'efectivo' && cashGiven) {
      cashChange = Math.max(0, parseFloat(cashGiven) - totalAmountNum)
    } else if (paymentMethod === 'mixto' && cardAmountMixed && cashGiven) {
      const cardVal = parseFloat(cardAmountMixed) || 0
      const cashVal = parseFloat(cashGiven) || 0
      const remainingToCover = Math.max(0, totalAmountNum - cardVal)
      cashChange = Math.max(0, cashVal - remainingToCover)
    }
  }

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-750 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-750 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-2 md:p-4 flex flex-col w-full notranslate pb-20 lg:pb-4 relative ${themeBg}`} translate="no">
      
      {/* TOAST FLOTANTE PROFESIONAL CON Z-INDEX SUPERIOR (999999) */}
      {toast && (
        <div className="fixed top-5 right-5 z-[999999] animate-bounce">
          <div className={`px-5 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR CON TOTAL DE VENTAS Y BOTÓN MODO OSCURO/CLARO (ESTILO POS) */}
      <header className={`p-3 rounded-lg shadow mb-3 flex flex-wrap justify-between items-center gap-2 border w-full ${panelBg}`}>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center shadow transition-colors"
            title="Herramientas y Menú"
          >
            ☰
          </button>

          {businessLogo ? (
            <img src={businessLogo} alt="Logo" className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-xl border p-0.5 shadow-sm" />
          ) : (
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center font-bold text-emerald-500 text-sm uppercase shadow-sm">
              {businessName ? businessName.substring(0, 2) : 'NE'}
            </div>
          )}

          <div>
            <h1 className="text-xs md:text-sm font-bold leading-tight text-emerald-500">Módulo de Caja</h1>
            <div className={`border px-2 py-0.5 rounded-md font-semibold text-xs mt-1 flex items-center gap-1.5 ${inputBg}`}>
              <span>📍 {branchName}</span>
              <span className="opacity-75">({staffName})</span>
            </div>
          </div>
        </div>

        {/* TOTAL DE VENTAS DEL TURNO EN LA VISTA PRINCIPAL */}
        <div className={`px-4 py-1.5 rounded-lg border flex items-center gap-3 ${subPanelBg}`}>
          <div>
            <span className="text-[10px] uppercase font-semibold opacity-70 block leading-tight">Ventas del Turno</span>
            <span className="text-sm md:text-base font-extrabold text-emerald-500" translate="no">Q {totalTodaySales.toFixed(2)}</span>
          </div>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
            {todaySales.length} {todaySales.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {cashRegister ? (
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Abierta (Q {cashRegister.opening_amount})
              </span>
              <button 
                onClick={() => setShowCloseModal(true)}
                className="bg-amber-600 hover:bg-amber-500 text-[11px] px-2.5 py-1 rounded font-bold text-white shadow"
              >
                🔒 Cierre de Día
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="bg-red-500/20 text-red-400 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Cerrada
              </span>
              <button 
                onClick={() => setShowOpenModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-[11px] px-2.5 py-1 rounded font-bold text-white shadow"
              >
                ☀️ Inicio de Día
              </button>
            </div>
          )}

          {/* ÚNICO BOTÓN DE TEMA (SOLO ICONO COMO EN EL POS) */}
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-lg text-sm font-semibold border transition-colors ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* DISEÑO PRINCIPAL: ÓRDENES EN ESPERA (IZQ) Y GESTIÓN/COBRO (DER) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 w-full">
        
        {/* COLUMNA IZQUIERDA: ÓRDENES EN ESPERA */}
        <div className={`p-3 md:p-4 rounded-lg shadow border flex flex-col lg:col-span-7 order-2 lg:order-1 ${panelBg}`}>
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-opacity-50 gap-2">
            <h2 className="text-sm md:text-base font-bold text-emerald-500">🎟️ Órdenes en Espera ({filteredOrders.length})</h2>
            <input 
              type="text"
              placeholder="🔍 Buscar orden o NIT..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`border px-3 py-1 rounded text-xs outline-none focus:border-emerald-500 w-48 md:w-64 ${inputBg}`}
            />
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[65vh] lg:max-h-[60vh] pr-1 flex-1">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 opacity-75 text-sm">
                No hay órdenes pendientes en este momento.
              </div>
            ) : (
              filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  onClick={() => handleSelectOrder(order)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${subPanelBg} ${
                    selectedOrder?.id === order.id ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'hover:border-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-emerald-500/20 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded text-xs">
                        Orden #{order.order_number || 'S/N'}
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">Pendiente</span>
                      <span className="text-[10px] opacity-75">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="font-bold text-xs md:text-sm">Cliente: {order.customer_name || 'Consumidor Final'}</p>
                    <p className="text-[11px] opacity-75">NIT: <span className="font-mono text-emerald-500">{order.customer_nit || 'CF'}</span></p>
                  </div>

                  <div className="text-right">
                    <span className="text-emerald-500 font-extrabold text-sm md:text-base" translate="no">Q {order.total_amount}</span>
                    <p className="text-[10px] opacity-60 mt-0.5">Cobrar ➔</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: GESTIÓN Y COBRO (PC) */}
        <div className={`hidden lg:flex p-4 rounded-lg shadow border flex-col justify-between lg:col-span-5 order-1 lg:order-2 ${panelBg}`}>
          <div>
            <h2 className="text-base font-bold text-emerald-500 mb-3 pb-2 border-b border-opacity-50">💳 Detalle de Cobro</h2>

            {selectedOrder ? (
              <div className="space-y-3 text-xs">
                <div className={`p-2.5 rounded border space-y-1 ${subPanelBg}`}>
                  <p><span className="opacity-75">Orden No:</span> <span className="font-bold font-mono text-emerald-500 text-sm">#{selectedOrder.order_number || 'S/N'}</span></p>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {loading ? (
                    <p className="text-center opacity-75 py-2">Cargando...</p>
                  ) : orderItems.map((item, idx) => (
                    <div key={idx} className={`p-2 rounded border flex justify-between items-center ${subPanelBg}`}>
                      <div>
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="opacity-75">{item.quantity} x Q {item.price}</p>
                      </div>
                      <span className="font-bold text-emerald-500" translate="no">Q {item.quantity * item.price}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-1 border-t border-opacity-50">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium block mb-0.5">NIT</label>
                      <input 
                        type="text"
                        value={customerNit}
                        onChange={e => handleNitChange(e.target.value)}
                        placeholder="CF"
                        className={`w-full border p-1.5 rounded font-semibold uppercase outline-none ${inputBg}`}
                      />
                    </div>
                    <div>
                      <label className="font-medium block mb-0.5">Nombre</label>
                      <input 
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Cliente"
                        className={`w-full border p-1.5 rounded outline-none ${inputBg}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-medium block mb-0.5">Método de Pago</label>
                    <select 
                      value={paymentMethod} 
                      onChange={e => setPaymentMethod(e.target.value as any)} 
                      className={`w-full p-1.5 rounded border outline-none font-medium ${inputBg}`}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="mixto">Mixto (Tarjeta + Efectivo)</option>
                    </select>
                  </div>

                  {paymentMethod === 'efectivo' && (
                    <div className={`p-2.5 rounded border border-emerald-500/40 space-y-1.5 ${subPanelBg}`}>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💵 Efectivo Recibido (Q)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={cashGiven}
                          onChange={e => setCashGiven(e.target.value)}
                          placeholder="0.00"
                          className={`w-full border p-1.5 rounded font-bold text-sm outline-none ${inputBg}`}
                        />
                      </div>
                      <div className="flex justify-between items-center font-bold text-sm">
                        <span>Vuelto:</span>
                        <span className="text-emerald-500" translate="no">Q {cashChange.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'tarjeta' && (
                    <div>
                      <label className="text-emerald-500 font-bold block mb-0.5">💳 No. de Voucher</label>
                      <input 
                        type="text"
                        value={voucherNumber}
                        onChange={e => setVoucherNumber(e.target.value)}
                        placeholder="Voucher..."
                        className={`w-full border p-1.5 rounded outline-none font-mono ${inputBg}`}
                        required
                      />
                    </div>
                  )}

                  {paymentMethod === 'mixto' && (
                    <div className={`p-2.5 rounded border border-emerald-500/40 space-y-2 ${subPanelBg}`}>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💳 Tarjeta (Q)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={cardAmountMixed}
                          onChange={e => setCardAmountMixed(e.target.value)}
                          placeholder="0.00"
                          className={`w-full border p-1.5 rounded font-bold outline-none ${inputBg}`}
                        />
                      </div>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💳 No. de Voucher</label>
                        <input 
                          type="text"
                          value={voucherNumber}
                          onChange={e => setVoucherNumber(e.target.value)}
                          placeholder="Voucher..."
                          className={`w-full border p-1.5 rounded outline-none font-mono ${inputBg}`}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💵 Efectivo Restante (Q)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={cashGiven}
                          onChange={e => setCashGiven(e.target.value)}
                          placeholder="0.00"
                          className={`w-full border p-1.5 rounded font-bold outline-none ${inputBg}`}
                        />
                      </div>
                      <div className="flex justify-between font-bold text-sm pt-1 border-t border-opacity-50">
                        <span>Vuelto:</span>
                        <span className="text-emerald-500" translate="no">Q {cashChange.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-28 opacity-75 text-sm">
                Selecciona una orden de la izquierda para cobrar.
              </div>
            )}
          </div>

          {selectedOrder && (
            <div className="border-t border-opacity-50 pt-3 mt-3 space-y-2">
              <div className="flex justify-between items-center font-bold text-base">
                <span>Total a Cobrar:</span>
                <span className="text-emerald-500 text-lg" translate="no">Q {selectedOrder.total_amount}</span>
              </div>

              {/* BOTÓN COBRAR CON BLOQUEO ANTI-DOBLE CLIC */}
              <button 
                onClick={handlePayOrder}
                disabled={isSubmittingPayment}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed py-3 rounded-lg font-bold text-xs shadow transition-colors text-white"
              >
                {isSubmittingPayment ? 'Procesando Cobro...' : '💳 Cobrar y Cerrar Orden'}
              </button>

              <button 
                onClick={() => setOrderToCancel(selectedOrder)}
                className="w-full bg-red-700 hover:bg-red-600 py-2 rounded-lg font-semibold text-xs shadow transition-colors text-white"
              >
                ❌ Cancelar Orden (Devuelve Stock)
              </button>
            </div>
          )}
        </div>

      </div>

      {/* MENÚ LATERAL DESLIZANTE (☰) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 flex z-[9999]" onClick={() => setIsDrawerOpen(false)}>
          <div 
            className={`w-[380px] md:w-[420px] h-full p-6 flex flex-col shadow-2xl border-r ${panelBg}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-opacity-50">
              <h2 className="text-lg font-bold text-emerald-500">🛠️ Opciones de Caja</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-xl font-bold opacity-75 hover:opacity-100 p-1">✕</button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
              <div className="space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Navegación del Sistema</p>
                {(userRole === 'encargado' || !staffId) && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => router.push('/pos')} className="bg-sky-600 hover:bg-sky-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left">
                      🛒 Ir al POS
                    </button>
                    <button onClick={() => router.push('/inventario')} className="bg-emerald-700 hover:bg-emerald-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left">
                      📋 Inventario
                    </button>
                  </div>
                )}
                <button onClick={openSatPortal} className="w-full bg-sky-600 hover:bg-sky-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>🏛️ Facturar en Portal SAT</span>
                  <span>➔</span>
                </button>
              </div>

              <div className="pt-3 border-t border-opacity-50 space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Sesión</p>
                <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left">
                  🚪 Cerrar Sesión
                </button>
              </div>

              <div className="pt-3 border-t border-opacity-50 space-y-2">
                <p className="font-bold text-emerald-500 text-sm">📊 Detalle de Ventas del Turno</p>
                <div className={`p-3 rounded-lg border border-emerald-500/40 flex justify-between items-center shadow ${subPanelBg}`}>
                  <div>
                    <p className="text-[10px] opacity-75 uppercase font-medium">Total Acumulado</p>
                    <p className="text-base font-extrabold text-emerald-500" translate="no">Q {totalTodaySales.toFixed(2)}</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/25 text-emerald-400 font-bold px-2 py-0.5 rounded">
                    {todaySales.length} {todaySales.length === 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {todaySales.length === 0 ? (
                    <p className="opacity-75 text-center py-6 text-xs">No hay ventas registradas en este turno.</p>
                  ) : (
                    todaySales.map((sale) => (
                      <div 
                        key={sale.sale_id}
                        onClick={() => handleViewSaleDetails(sale.sale_id)}
                        className={`p-2.5 rounded border hover:border-emerald-500 cursor-pointer transition-all space-y-1 ${subPanelBg}`}
                      >
                        <div className="flex justify-between font-bold">
                          <span>NIT: {sale.customer_nit}</span>
                          <span className="text-emerald-500" translate="no">Q {sale.total_amount}</span>
                        </div>
                        <p className="text-[10px] opacity-75">Cliente: {sale.customer_name}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL FLOTANTE MÓVIL AL SELECCIONAR ORDEN */}
      {isMobileOrderModalOpen && selectedOrder && (
        <div className="lg:hidden fixed inset-0 bg-black/85 flex items-end z-50 animate-fadeIn" onClick={() => setIsMobileOrderModalOpen(false)}>
          <div 
            className={`w-full max-h-[92vh] rounded-t-2xl p-4 flex flex-col justify-between shadow-2xl border-t ${panelBg}`}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-opacity-50">
                <h2 className="text-sm font-bold text-emerald-500">💳 Cobrar Orden #{selectedOrder.order_number}</h2>
                <button onClick={() => setIsMobileOrderModalOpen(false)} className="text-lg font-bold opacity-75">✕</button>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[55vh] pr-1 text-xs">
                <div className={`p-2.5 rounded border space-y-1 ${subPanelBg}`}>
                  <p><span className="opacity-75">Cliente:</span> <span className="font-bold">{selectedOrder.customer_name}</span></p>
                  <p><span className="opacity-75">NIT:</span> <span className="font-mono text-emerald-500">{selectedOrder.customer_nit}</span></p>
                </div>

                <div className="space-y-1.5">
                  <p className="font-bold opacity-80">Productos:</p>
                  {orderItems.map((item, idx) => (
                    <div key={idx} className={`p-2 rounded border flex justify-between items-center ${subPanelBg}`}>
                      <span>{item.quantity} x {item.product_name}</span>
                      <span className="text-emerald-500 font-bold" translate="no">Q {item.quantity * item.price}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-1 border-t border-opacity-50">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium block mb-0.5">NIT</label>
                      <input 
                        type="text"
                        value={customerNit}
                        onChange={e => handleNitChange(e.target.value)}
                        placeholder="CF"
                        className={`w-full border p-2 rounded font-semibold uppercase outline-none ${inputBg}`}
                      />
                    </div>
                    <div>
                      <label className="font-medium block mb-0.5">Nombre</label>
                      <input 
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Cliente"
                        className={`w-full border p-2 rounded outline-none ${inputBg}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-medium block mb-0.5">Método de Pago</label>
                    <select 
                      value={paymentMethod} 
                      onChange={e => setPaymentMethod(e.target.value as any)} 
                      className={`w-full p-2 rounded border outline-none font-medium ${inputBg}`}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="mixto">Mixto (Tarjeta + Efectivo)</option>
                    </select>
                  </div>

                  {paymentMethod === 'efectivo' && (
                    <div className={`p-2.5 rounded border border-emerald-500/40 space-y-1.5 ${subPanelBg}`}>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💵 Efectivo Recibido (Q)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={cashGiven}
                          onChange={e => setCashGiven(e.target.value)}
                          placeholder="0.00"
                          className={`w-full border p-2 rounded font-bold text-sm outline-none ${inputBg}`}
                        />
                      </div>
                      <div className="flex justify-between items-center font-bold text-sm">
                        <span>Vuelto:</span>
                        <span className="text-emerald-500" translate="no">Q {cashChange.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'tarjeta' && (
                    <div>
                      <label className="text-emerald-500 font-bold block mb-0.5">💳 No. de Voucher</label>
                      <input 
                        type="text"
                        value={voucherNumber}
                        onChange={e => setVoucherNumber(e.target.value)}
                        placeholder="Voucher..."
                        className={`w-full border p-2 rounded outline-none font-mono ${inputBg}`}
                        required
                      />
                    </div>
                  )}

                  {paymentMethod === 'mixto' && (
                    <div className={`p-2.5 rounded border border-emerald-500/40 space-y-2 ${subPanelBg}`}>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💳 Tarjeta (Q)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={cardAmountMixed}
                          onChange={e => setCardAmountMixed(e.target.value)}
                          placeholder="0.00"
                          className={`w-full border p-2 rounded font-bold outline-none ${inputBg}`}
                        />
                      </div>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💳 No. de Voucher</label>
                        <input 
                          type="text"
                          value={voucherNumber}
                          onChange={e => setVoucherNumber(e.target.value)}
                          placeholder="Voucher..."
                          className={`w-full border p-2 rounded outline-none font-mono ${inputBg}`}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-emerald-500 font-bold block mb-0.5">💵 Efectivo Restante (Q)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={cashGiven}
                          onChange={e => setCashGiven(e.target.value)}
                          placeholder="0.00"
                          className={`w-full border p-2 rounded font-bold outline-none ${inputBg}`}
                        />
                      </div>
                      <div className="flex justify-between font-bold text-sm pt-1 border-t border-opacity-50">
                        <span>Vuelto:</span>
                        <span className="text-emerald-500" translate="no">Q {cashChange.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-opacity-50 pt-3 mt-3 space-y-2">
              <div className="flex justify-between items-center font-bold text-base">
                <span>Total a Cobrar:</span>
                <span className="text-emerald-500 text-lg" translate="no">Q {selectedOrder.total_amount}</span>
              </div>

              {/* BOTÓN COBRAR MÓVIL CON BLOQUEO ANTI-DOBLE CLIC */}
              <button 
                onClick={handlePayOrder}
                disabled={isSubmittingPayment}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed py-3 rounded-lg font-bold text-xs shadow transition-colors text-white"
              >
                {isSubmittingPayment ? 'Procesando Cobro...' : '💳 Cobrar y Cerrar Orden'}
              </button>

              <button 
                onClick={() => setOrderToCancel(selectedOrder)}
                className="w-full bg-red-700 hover:bg-red-600 py-2 rounded-lg font-semibold text-xs shadow transition-colors text-white"
              >
                ❌ Cancelar Orden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA CANCELAR ORDEN */}
      {orderToCancel && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[99999]">
          <div className={`p-6 rounded-xl border border-red-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
            <h3 className="text-lg font-bold text-red-500">⚠️ ¿Cancelar Orden #{orderToCancel.order_number}?</h3>
            <p className="text-xs opacity-80">Esta acción eliminará la orden en espera y devolverá automáticamente los productos al inventario.</p>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleConfirmCancelOrder}
                className="flex-1 bg-red-600 hover:bg-red-500 py-2.5 rounded text-xs font-bold text-white"
              >
                Sí, Cancelar Orden
              </button>
              <button 
                onClick={() => setOrderToCancel(null)}
                className="bg-slate-700 px-4 py-2.5 rounded text-xs text-white"
              >
                No, Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b border-opacity-50 pb-2">
              <h3 className="text-base font-bold text-emerald-500">📦 Detalle de la Venta</h3>
              <button onClick={() => setSelectedSaleDetails(null)} className="opacity-75 hover:opacity-100 font-bold text-base">✕</button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
              {selectedSaleDetails.map((item, idx) => (
                <div key={idx} className={`p-2.5 rounded border flex justify-between items-center ${subPanelBg}`}>
                  <div>
                    <p className="font-semibold">{item.product_name}</p>
                    <p className="opacity-75">{item.quantity} x Q {item.price_at_sale}</p>
                  </div>
                  <span className="font-bold text-emerald-500" translate="no">Q {item.quantity * item.price_at_sale}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedSaleDetails(null)} className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 rounded text-sm font-semibold text-white">
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {showOpenModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
            <h3 className="text-lg font-bold text-emerald-500">☀️ Apertura de Caja</h3>
            <p className="text-xs opacity-75">Ingresa el fondo inicial en efectivo para esta sucursal:</p>
            
            <form onSubmit={handleOpenDay} className="space-y-3">
              <input 
                type="number"
                step="0.01"
                value={openingAmountInput}
                onChange={e => setOpeningAmountInput(e.target.value)}
                placeholder="0.00"
                className={`w-full border p-3 rounded font-bold text-lg outline-none focus:border-emerald-500 ${inputBg}`}
                required
                autoFocus
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded font-bold text-sm text-white">Abrir Caja</button>
                <button type="button" onClick={() => setShowOpenModal(false)} className="bg-slate-700 px-4 py-2.5 rounded text-sm text-white">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCloseModal && (() => {
        const totalEfectivo = todaySales
          .filter(s => s.payment_method === 'efectivo' || s.payment_method === 'mixto')
          .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
          
        const totalTarjeta = todaySales
          .filter(s => s.payment_method === 'tarjeta' || s.payment_method === 'mixto')
          .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
          
        const totalVentasGeneral = todaySales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
        const expectedCash = Number(cashRegister?.opening_amount || 0) + totalEfectivo;

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <div className={`p-6 rounded-xl border border-amber-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
              <h3 className="text-lg font-bold text-amber-500">🔒 Cierre de Caja / Arqueo</h3>
              
              <div className={`p-3 rounded border text-xs space-y-1.5 ${subPanelBg}`}>
                <p><span className="opacity-75">Cajero en Turno:</span> <span className="font-bold">{staffName}</span></p>
                <p><span className="opacity-75">Fondo Inicial:</span> <span className="font-bold text-emerald-500">Q {Number(cashRegister?.opening_amount || 0).toFixed(2)}</span></p>
                
                <div className="pt-2 border-t border-opacity-50 space-y-1">
                  <p><span className="opacity-75">Ventas con Efectivo:</span> <span className="font-bold text-emerald-500">Q {totalEfectivo.toFixed(2)}</span></p>
                  <p><span className="opacity-75">Ventas con Tarjeta:</span> <span className="font-bold text-blue-500">Q {totalTarjeta.toFixed(2)}</span></p>
                  <p className="font-bold pt-1">Total de Ventas: Q {totalVentasGeneral.toFixed(2)}</p>
                </div>
                
                <p className="pt-2 border-t border-opacity-50 font-bold text-amber-500">
                  Efectivo Esperado en Gaveta: Q {expectedCash.toFixed(2)}
                </p>
              </div>

              <form onSubmit={(e) => {
                 e.preventDefault();
                 const physicalCash = parseFloat(closingPhysicalCash);
                 if (Math.abs(physicalCash - expectedCash) > 0.01) {
                   return showToast(`❌ Error: El efectivo físico (Q ${physicalCash.toFixed(2)}) no cuadra con el esperado (Q ${expectedCash.toFixed(2)}).`, 'error');
                 }
                 handleCloseDay(e, physicalCash, totalVentasGeneral);
              }} className="space-y-3 text-xs">
                <div>
                  <label className="text-emerald-500 font-bold block mb-1">💵 Efectivo Físico Contado (Q)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={closingPhysicalCash}
                    onChange={e => setClosingPhysicalCash(e.target.value)}
                    placeholder="Monto exacto contado..."
                    className={`w-full border border-amber-500 p-3 rounded font-bold text-base outline-none focus:border-emerald-500 ${inputBg}`}
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-500 py-2.5 rounded font-bold text-sm text-white">Confirmar Cierre</button>
                  <button type="button" onClick={() => setShowCloseModal(false)} className="bg-slate-700 px-4 py-2.5 rounded text-sm text-white">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  )
}