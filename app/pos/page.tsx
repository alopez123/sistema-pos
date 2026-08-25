'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function PosPage() {
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedOtherStoreCategory, setSelectedOtherStoreCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<any[]>([])
  const [isStaff, setIsStaff] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  
  // Estado para el menú desplegable flotante de Opciones Operativas y Administrativas
  const [showOpsDropdown, setShowOpsDropdown] = useState(false)
  const opsDropdownRef = useRef<HTMLDivElement>(null)

  const router = useRouter()

  // Estado para la vista móvil en teléfonos (alternar entre catálogo y ticket)
  const [mobileViewTab, setMobileViewTab] = useState<'catalog' | 'cart'>('catalog')

  // Estado para prevenir doble clic al guardar orden
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)

  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Estado para habilitar o deshabilitar la impresión térmica de tickets
  const [enableTicketPrinting, setEnableTicketPrinting] = useState<boolean>(false)

  // Estados para ventas al crédito / selección y creación/actualización de clientes
  const [paymentMethod, setPaymentMethod] = useState<'Contado' | 'Crédito'>('Contado')
  const [selectedCustomerForCredit, setSelectedCustomerForCredit] = useState<string>('')
  const [creditDueDate, setCreditDueDate] = useState<string>('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerFound, setCustomerFound] = useState<any | null>(null)
  const [isCreatingOrEditingCustomer, setIsCreatingOrEditingCustomer] = useState(false)

  // Estados para sugerencias clickeables de clientes
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [filteredCustomersForCredit, setFilteredCustomersForCredit] = useState<any[]>([])

  // ==========================================
  // ESTADOS PARA LÍMITE DE CRÉDITO DE CLIENTES
  // ==========================================
  const [selectedCustomerLimitId, setSelectedCustomerLimitId] = useState<string>('')
  const [customerLimitDetails, setCustomerLimitDetails] = useState<any | null>(null)
  const [newCreditLimitValue, setNewCreditLimitValue] = useState<string>('3')
  const [isUpdatingLimit, setIsUpdatingLimit] = useState<boolean>(false)

  // Estados específicos para el buscador del modal de Límite de Clientes
  const [limitSearchQuery, setLimitSearchQuery] = useState('')
  const [showLimitSuggestions, setShowLimitSuggestions] = useState(false)
  const [filteredCustomersForLimit, setFilteredCustomersForLimit] = useState<any[]>([])

  // Campos del formulario de cliente exprés (incluyendo email)
  const [expressName, setExpressName] = useState('')
  const [expressNit, setExpressNit] = useState('')
  const [expressDpi, setExpressDpi] = useState('')
  const [expressPhone, setExpressPhone] = useState('')
  const [expressAddress, setExpressAddress] = useState('')
  const [expressEmail, setExpressEmail] = useState('')

  useEffect(() => {
    const savedTheme = localStorage.getItem('pos_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
    const savedPrintingPref = localStorage.getItem('pos_print_tickets')
    if (savedPrintingPref === 'true') {
      setEnableTicketPrinting(true)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('pos_theme', newMode ? 'dark' : 'light')
  }

  const toggleTicketPrinting = () => {
    const newPrintingState = !enableTicketPrinting
    setEnableTicketPrinting(newPrintingState)
    localStorage.setItem('pos_print_tickets', newPrintingState ? 'true' : 'false')
  }

  // Estado para el Logotipo del Negocio
  const [businessLogo, setBusinessLogo] = useState<string | null>(null)

  // Estados para el buscador y autocompletado
  const [searchTerm, setSearchTerm] = useState('')
  const [otherStoresSearch, setOtherStoresSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Estado para el panel flotante de Alerta de Stock Bajo
  const [showLowStockModal, setShowLowStockModal] = useState(false)

  // Estados para el menú operativo izquierdo / modal
  const [activeTab, setActiveTab] = useState<'ticket' | 'addProduct' | 'otherStores' | 'transfers' | 'movements' | 'salesReport' | 'customers' | 'customerLimits'>('ticket')
  const [allStoreProducts, setAllStoreProducts] = useState<any[]>([])

  // Estados específicos para Traslados, Movimientos, Reportes y Clientes
  const [businessIdState, setBusinessIdState] = useState<string>('')
  const [transfersList, setTransfersList] = useState<any[]>([])
  const [transferProduct, setTransferProduct] = useState<any>(null)
  const [transferQuantity, setTransferQuantity] = useState<any>(1)
  const [branchMovements, setBranchMovements] = useState<any[]>([])
  const [salesReport, setSalesReport] = useState<any[]>([])
  const [customersList, setCustomersList] = useState<any[]>([])

  // Estado para ver el detalle de una venta seleccionada
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any[] | null>(null)

  // Estados inteligentes para la pestaña Agregar / Reabastecer
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<string>('')
  const [addMoreQuantity, setAddMoreQuantity] = useState<number>(1)

  // Formulario rápido para nuevo producto
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newStock, setNewStock] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Estados para el Modal de Creación Rápida de Categorías
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    const staffStr = localStorage.getItem('currentStaff')
    const bizStr = localStorage.getItem('currentBusiness')

    if (staffStr) {
      try {
        const staff = JSON.parse(staffStr)
        if (staff.role) {
          setUserRole(staff.role.toLowerCase())
        }
      } catch (e) {}
    }

    const fetchLogoUsingRpc = async (branchId?: string) => {
      const { data, error } = await supabase.rpc('get_business_logo_info', {
        p_branch_id: branchId || null,
        p_business_name: branchId ? null : 'Comedor'
      })

      if (!error && data && data.length > 0) {
        if (data[0].logo_url) {
          setBusinessLogo(data[0].logo_url)
        }
        if (data[0].business_id && !businessIdState) {
          setBusinessIdState(data[0].business_id)
        }
      }
    }

    if (staffStr) {
      try {
        const staff = JSON.parse(staffStr)
        const resolvedBizId = staff.business_id || staff.busines_id

        if (staff.branch_id) {
          setIsStaff(true)
          setSelectedBranch(staff.branch_id)
          setBranches([{ id: staff.branch_id, name: staff.branch_name || 'Sucursal Asignada' }])
          loadProducts(staff.branch_id)
          
          if (resolvedBizId) {
            setBusinessIdState(resolvedBizId)
            loadCategories(resolvedBizId)
            loadOtherStoresProducts(resolvedBizId, staff.branch_id)
            loadTransfers(resolvedBizId, staff.branch_id)
            loadMovements(staff.branch_id)
            loadSalesReport(resolvedBizId, staff.branch_id)
            loadCustomers(resolvedBizId)
          }

          fetchLogoUsingRpc(staff.branch_id)
          return
        }
      } catch (e) {
        console.error("Error al parsear currentStaff", e)
      }
    }

    if (bizStr) {
      try {
        const biz = JSON.parse(bizStr)
        const businessId = biz.id || biz.business_id || biz.busines_id
        if (businessId) {
          setBusinessIdState(businessId)
          if (biz.logo_url) {
            setBusinessLogo(biz.logo_url)
          } else {
            fetchLogoUsingRpc()
          }
          loadCategories(businessId)
          loadBranches(businessId)
          loadCustomers(businessId)
          return
        }
      } catch (e) {
        console.error("Error al parsear currentBusiness", e)
      }
    }

    router.push('/')
  }, [router])
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
      if (opsDropdownRef.current && !opsDropdownRef.current.contains(event.target as Node)) {
        setShowOpsDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    
    async function initialLoadAndValidateStatus() {
      const staffLocal = localStorage.getItem('currentStaff')
      const bizId = localStorage.getItem('currentBusiness') ? JSON.parse(localStorage.getItem('currentBusiness')!).id : null;
      
      let resolvedBizId = bizId;
      if (staffLocal) {
        try {
          const staff = JSON.parse(staffLocal);
          resolvedBizId = staff.business_id || staff.busines_id;
        } catch(e) {}
      }

      if (resolvedBizId) {
        const { data } = await supabase.from('businesses').select('status, payment_status, logo_url').eq('id', resolvedBizId).single();
        if (data?.logo_url) setBusinessLogo(data.logo_url);
        
        if (
          (data?.status && data.status.toLowerCase() !== 'activo') ||
          data?.payment_status === 'Pendiente' ||
          data?.payment_status === 'Atrasado'
        ) {
          localStorage.removeItem('currentStaff');
          localStorage.removeItem('currentBusiness');
          alert("Acceso bloqueado: La suscripción de este negocio se encuentra pendiente o suspendida. Realice el pago para continuar.");
          router.push('/');
        }
      }
    }
    initialLoadAndValidateStatus();

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [router])

  const refreshAllData = (branchId: string, bizId: string) => {
    loadProducts(branchId)
    loadMovements(branchId)
    loadTransfers(bizId, branchId)
    loadOtherStoresProducts(bizId, branchId)
    loadSalesReport(bizId, branchId)
    loadCustomers(bizId)
    router.refresh()
  }

  async function loadCategories(businessId: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true })

    if (!error && data) {
      setCategories(data)
    }
  }

  async function loadCustomers(businessId: string) {
    const { data, error } = await supabase.rpc('get_business_customers', { p_business_id: businessId })
    if (!error && data) {
      setCustomersList(data)
      return data
    }
    return []
  }

  const handleSearchCustomerForLimit = (query: string) => {
    setLimitSearchQuery(query)
    setShowLimitSuggestions(true)

    if (!query.trim()) {
      setFilteredCustomersForLimit([])
      return
    }

    const matches = customersList.filter(c => 
      (c.nit && c.nit.toLowerCase().includes(query.toLowerCase())) ||
      (c.dpi && c.dpi.toLowerCase().includes(query.toLowerCase())) ||
      (c.name && c.name.toLowerCase().includes(query.toLowerCase()))
    )
    setFilteredCustomersForLimit(matches)
  }

  const handleSelectCustomerForLimit = (c: any) => {
    setSelectedCustomerLimitId(c.customer_id)
    setCustomerLimitDetails(c)
    setNewCreditLimitValue(String(c.credit_limit || 3))
    setLimitSearchQuery(c.name)
    setShowLimitSuggestions(false)
  }

  async function handleSaveCustomerLimit() {
    if (!selectedCustomerLimitId) return alert("Selecciona un cliente.")
    const limitNum = parseInt(newCreditLimitValue, 10)
    if (isNaN(limitNum) || limitNum < 0) return alert("Ingresa un límite válido.")

    setIsUpdatingLimit(true)
    const { error } = await supabase.rpc('update_customer_credit_limit', {
      p_customer_id: selectedCustomerLimitId,
      p_credit_limit: limitNum
    })
    
    if (error) {
      setIsUpdatingLimit(false)
      alert("Error al actualizar límite: " + error.message)
    } else {
      // Actualizamos el estado local de inmediato con el valor enviado
      setCustomerLimitDetails((prev: any) => prev ? { ...prev, credit_limit: limitNum } : null)
      setNewCreditLimitValue(String(limitNum))
      
      // Recargamos el listado general en segundo plano
      await loadCustomers(businessIdState)
      
      setIsUpdatingLimit(false)
      alert("✅ ¡Límite de crédito actualizado con éxito!")
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim() || !businessIdState) return

    setSavingCategory(true)
    const { data, error } = await supabase
      .from('categories')
      .insert([{ business_id: businessIdState, name: newCategoryName.trim() }])
      .select('*')
      .single()

    setSavingCategory(false)

    if (error) {
      alert("Error al crear categoría: " + error.message)
    } else if (data) {
      alert("¡Categoría creada con éxito!")
      setCategories(prev => [...prev, data])
      setNewCategoryId(data.id)
      setNewCategoryName('')
      setShowNewCategoryModal(false)
    }
  }

  async function loadBranches(businessId: string) {
    const { data, error } = await supabase.rpc('get_branches_by_business', {
      p_business_id: businessId
    })

    if (error) {
      console.error("Error cargando sucursales:", error.message)
      return
    }

    if (data && data.length > 0) {
      setBranches(data)
      setSelectedBranch(data[0].id)
      refreshAllData(data[0].id, businessId)
    }
  }

  async function loadProducts(branchId: string) {
    const { data, error } = await supabase.rpc('get_products_by_branch', {
      p_branch_id: branchId
    })

    if (error) {
      console.error("Error cargando productos:", error.message)
      setProducts([])
    } else {
      setProducts(data || [])
    }
  }

  async function loadOtherStoresProducts(businessId: string, currentBranchId: string) {
    const { data, error } = await supabase.rpc('get_products_by_business_all', {
      p_business_id: businessId || businessIdState
    })
    if (!error && data) {
      setAllStoreProducts(data)
    }
  }

  async function loadTransfers(businessId: string, currentBranchId: string) {
    const { data, error } = await supabase.rpc('get_branch_transfers', {
      p_business_id: businessId,
      p_branch_id: currentBranchId
    });

    if (!error && data) {
      setTransfersList(data);
    }
  }

  async function loadMovements(branchId: string) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, product:products(name)')
      .eq('branch_id', branchId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })

    if (!error && data) {
      setBranchMovements(data)
    }
  }

  async function loadSalesReport(bId?: string, brId?: string) {
    const currentBizId = bId || businessIdState;
    const currentBranchId = brId || selectedBranch;
    if (!currentBizId || !currentBranchId) return;

    const { data, error } = await supabase
      .from('sales')
      .select(`id, total_amount, payment_method, created_at, customer:customers(nit, name)`)
      .eq('business_id', currentBizId)
      .eq('branch_id', currentBranchId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedSales = data.map((sale: any) => ({
        sale_id: sale.id,
        total_amount: sale.total_amount,
        payment_method: sale.payment_method,
        created_at: sale.created_at,
        customer_nit: sale.customer?.nit || 'CF',
        customer_name: sale.customer?.name || 'Consumidor Final'
      }));
      setSalesReport(formattedSales);
    }
  }

  async function handleViewSaleDetails(saleId: string) {
    const { data, error } = await supabase.rpc('get_sale_details', { p_sale_id: saleId })
    if (!error && data) setSelectedSaleDetails(data)
  }

  const handleSearchCustomerForCredit = (query: string) => {
    setCustomerSearchQuery(query)
    setShowCustomerSuggestions(true)

    if (!query.trim()) {
      setFilteredCustomersForCredit([])
      setCustomerFound(null)
      setSelectedCustomerForCredit('')
      setIsCreatingOrEditingCustomer(false)
      setExpressName('')
      setExpressNit('')
      setExpressDpi('')
      setExpressPhone('')
      setExpressAddress('')
      setExpressEmail('')
      return
    }

    const matches = customersList.filter(c => 
      (c.nit && c.nit.toLowerCase().includes(query.toLowerCase())) ||
      (c.dpi && c.dpi.toLowerCase().includes(query.toLowerCase())) ||
      (c.name && c.name.toLowerCase().includes(query.toLowerCase()))
    )

    setFilteredCustomersForCredit(matches)

    const found = customersList.find(c => 
      (c.nit && c.nit.toLowerCase() === query.toLowerCase()) ||
      (c.dpi && c.dpi.toLowerCase() === query.toLowerCase()) ||
      (c.name && c.name.toLowerCase() === query.toLowerCase())
    )

    if (found) {
      setCustomerFound(found)
      setSelectedCustomerForCredit(found.customer_id)
      setExpressName(found.name || '')
      setExpressNit(found.nit || '')
      setExpressDpi(found.dpi || '')
      setExpressPhone(found.phone || '')
      setExpressAddress(found.address || '')
      setExpressEmail(found.email || '')

      const hasMissingFields = !found.nit || !found.dpi || found.dpi.length !== 13 || !found.phone || !found.address;
      setIsCreatingOrEditingCustomer(hasMissingFields);
    } else {
      setCustomerFound(null)
      setSelectedCustomerForCredit('')
      setIsCreatingOrEditingCustomer(true)
      setExpressName(query)
      setExpressNit('')
      setExpressDpi('')
      setExpressPhone('')
      setExpressAddress('')
      setExpressEmail('')
    }
  }

  const handleSelectCustomer = (c: any) => {
    setCustomerFound(c)
    setSelectedCustomerForCredit(c.customer_id)
    setCustomerSearchQuery(c.name)
    setShowCustomerSuggestions(false)

    setExpressName(c.name || '')
    setExpressNit(c.nit || '')
    setExpressDpi(c.dpi || '')
    setExpressPhone(c.phone || '')
    setExpressAddress(c.address || '')
    setExpressEmail(c.email || '')

    const hasMissingFields = !c.nit || !c.dpi || c.dpi.length !== 13 || !c.phone || !c.address;
    setIsCreatingOrEditingCustomer(hasMissingFields);
  }

  const totalCart = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)

  function printThermalTicket({ orderNumber, branchName, customerNit, customerName, items, total }: any) {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      alert("Por favor permite las ventanas emergentes (pop-ups) para imprimir el ticket.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden #${orderNumber}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 250px; margin: 0 auto; padding: 10px; color: #000; }
            .text-center { text-align: center; } .bold { font-weight: bold; } .flex { display: flex; justify-content: space-between; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; } table { width: 100%; border-collapse: collapse; }
            th, td { font-size: 11px; text-align: left; padding: 2px 0; } .right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="text-center bold" style="font-size: 14px;">DETALLE DE ORDEN</div>
          <div class="text-center">${branchName}</div>
          <div class="divider"></div>
          <div><span class="bold">ORDEN / TURNO:</span> #${orderNumber}</div>
          <div><span class="bold">FECHA:</span> ${new Date().toLocaleString()}</div>
          <div><span class="bold">CLIENTE:</span> ${customerName}</div>
          <div><span class="bold">NIT:</span> ${customerNit}</div>
          <div class="divider"></div>
          <table>
            <thead><tr><th>Cant / Descripción</th><th class="right">Subtotal</th></tr></thead>
            <tbody>
              ${items.map((i: any) => `
                <tr><td colspan="2" class="bold">${i.quantity} x ${i.name}</td></tr>
                <tr><td>P/U: Q ${i.price.toFixed(2)}</td><td class="right">Q ${(i.price * i.quantity).toFixed(2)}</td></tr>
              `).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="flex bold" style="font-size: 14px;"><span>TOTAL:</span><span>Q ${total.toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="text-center" style="font-size: 10px; margin-top: 10px;">¡Pase a caja con este ticket para realizar su pago!<br>Gracias por su preferencia</div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  async function handleSavePendingOrder() {
    if (isSubmittingOrder) return
    if (cart.length === 0) return alert("El carrito está vacío.")

    if (paymentMethod === 'Crédito') {
      if (!customerSearchQuery.trim() && !expressName.trim()) {
        return alert("⚠️ Debes ingresar el nombre y datos del cliente para la venta al crédito.");
      }
      if (!creditDueDate) {
        return alert("⚠️ Selecciona una fecha límite de pago para este crédito.");
      }

      const cleanDpi = expressDpi.trim();
      if (!cleanDpi || cleanDpi.length !== 13 || !/^\d+$/.test(cleanDpi)) {
        return alert("⚠️ El DPI es obligatorio para ventas al crédito y debe contener exactamente 13 dígitos numéricos.");
      }

      setIsSubmittingOrder(true);

      const cartJson = cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        name: item.name
      }));

      const { error } = await supabase.rpc('register_credit_sale_with_customer', {
        p_business_id: businessIdState,
        p_branch_id: selectedBranch,
        p_total_amount: totalCart,
        p_due_date: creditDueDate,
        p_items: cartJson,
        p_cust_name: expressName.trim() || customerSearchQuery.trim(),
        p_cust_nit: expressNit.trim() || 'CF',
        p_cust_dpi: cleanDpi,
        p_cust_phone: expressPhone.trim() || null,
        p_cust_address: expressAddress.trim() || null,
        p_cust_email: expressEmail.trim() || null,
        p_customer_id: selectedCustomerForCredit || null
      });

      setIsSubmittingOrder(false);

      if (error) {
        alert("Error en la transacción de venta al crédito (Límite superado o error): " + error.message);
      } else {
        alert("✅ ¡Venta al crédito y cliente registrados con éxito bajo transacción segura!");
        setCart([]);
        setPaymentMethod('Contado');
        setSelectedCustomerForCredit('');
        setCreditDueDate('');
        setCustomerSearchQuery('');
        setCustomerFound(null);
        setIsCreatingOrEditingCustomer(false);
        setExpressName('');
        setExpressNit('');
        setExpressDpi('');
        setExpressPhone('');
        setExpressAddress('');
        setExpressEmail('');
        refreshAllData(selectedBranch, businessIdState);
      }

    } else {
      setIsSubmittingOrder(true)

      const standardCartJson = cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name
      }));

      const { data, error } = await supabase.rpc('create_new_order_safe', {
        p_business_id: businessIdState,
        p_branch_id: selectedBranch,
        p_customer_id: null, 
        p_total_amount: totalCart,
        p_items: standardCartJson
      });

      setIsSubmittingOrder(false)

      if (error) {
        alert("Error al guardar la orden: " + error.message);
      } else if (data && data.length > 0) {
        const numeroTurno = data[0].order_number;
        if (enableTicketPrinting) {
          printThermalTicket({
            orderNumber: numeroTurno,
            branchName: branches.find(b => b.id === selectedBranch)?.name || 'Sucursal',
            customerNit: 'CF',
            customerName: 'Consumidor Final',
            items: cart,
            total: totalCart
          });
        } else {
          alert(`✅ ¡Orden guardada con éxito!\n\n🎟️ TURNO / ORDEN #${numeroTurno}\n\nEl cliente ya puede pasar a caja con este número.`);
        }
        setCart([]);
        refreshAllData(selectedBranch, businessIdState);
      }
    }
  }
  
  const handleBranchChange = (branchId: string) => {
    if (isStaff) return
    setSelectedBranch(branchId)
    refreshAllData(branchId, businessIdState)
    setCart([])
  }

  const addToCart = (product: any) => {
    const isCustomByName = product.name && (
      product.name.toLowerCase().includes('vinil') || 
      product.name.toLowerCase().includes('personaliz') ||
      product.name.toLowerCase().includes('manta')
    );

    if (!isCustomByName && product.stock <= 0) {
      alert("⚠️ Este producto no tiene existencias disponibles (Stock 0) y no puede ser agregado.")
      return
    }
    
    if (isCustomByName) {
      const customDesc = prompt("Ingresa las medidas, peso o características (Ej. Manta 2x1.5m):");
      if (!customDesc) return;
      const customPriceStr = prompt("Ingresa el precio de venta cotizado:");
      const customPrice = parseFloat(customPriceStr || '0');
      if (isNaN(customPrice) || customPrice <= 0) return alert("Precio inválido.");

      const staffData = JSON.parse(localStorage.getItem('currentStaff') || '{}');
      setCart(prevCart => [
        ...prevCart,
        {
          ...product,
          id: product.id,
          name: `${product.name} (${customDesc})`,
          price: customPrice,
          originalPrice: customPrice,
          quantity: 1,
          stock: 9999,
          isSpecial: false,
          staffId: staffData.id || null
        }
      ]);
      return;
    }

    const staffData = JSON.parse(localStorage.getItem('currentStaff') || '{}')
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert("No puedes agregar más de las existencias disponibles.")
          return prevCart
        }
        return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      } else {
        return [...prevCart, { ...product, quantity: 1, originalPrice: product.price, isSpecial: false, staffId: staffData.id || null }]
      }
    })
  }

  const handlePriceChange = (productId: string, newPriceText: string) => {
    const newPrice = parseFloat(newPriceText) || 0;
    const staffData = JSON.parse(localStorage.getItem('currentStaff') || '{}');
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const original = item.originalPrice !== undefined ? item.originalPrice : item.price;
        return { ...item, price: newPrice, originalPrice: original, isSpecial: newPrice !== original, staffId: staffData.id || null };
      }
      return item;
    }));
  };

  const handleQuantityChange = (productId: string, newQtyText: string) => {
    const newQty = parseInt(newQtyText, 10);
    if (isNaN(newQty)) return;

    const productInStock = products.find(p => p.id === productId);
    const maxStock = productInStock ? productInStock.stock : 9999;

    if (newQty > maxStock) {
      alert(`⚠️ No puedes agregar más de las existencias disponibles. Stock máximo: ${maxStock}`);
      setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: maxStock } : item));
      return;
    }

    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQty <= 0 ? 1 : newQty } : item));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.id !== productId))

  const handleAddOrRestockProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedExistingProduct === 'NEW') {
      if (!newName.trim() || !newPrice || !selectedBranch) return alert("Completa el nombre y el precio.")
      setUploadingImage(true)
      let imageUrl = null
      try {
        if (imageFile) {
          const compressedBlob = await compressImage(imageFile)
          const filePath = `products/${Date.now()}.jpg`
          const { error: uploadError } = await supabase.storage.from('products').upload(filePath, compressedBlob, { contentType: 'image/jpeg' })
          if (!uploadError) {
            const { data } = supabase.storage.from('products').getPublicUrl(filePath)
            imageUrl = data.publicUrl
          }
        }
        const { error } = await supabase.rpc('add_product_safe', {
          p_name: newName.trim(), p_price: parseFloat(newPrice) || 0, p_stock: parseInt(newStock) || 0,
          p_branch_id: selectedBranch, p_image_url: imageUrl, p_category_id: newCategoryId || null
        })
        if (error) alert("Error: " + error.message)
        else {
          alert("¡Producto agregado!")
          setNewName(''); setNewPrice(''); setNewStock(''); setNewCategoryId(''); setImageFile(null); setImagePreview(null); setSelectedExistingProduct('');
          refreshAllData(selectedBranch, businessIdState);
          setActiveTab('ticket')
        }
      } finally { setUploadingImage(false) }
    } else {
      if (!selectedExistingProduct) return alert("Selecciona un producto.")
      const { error } = await supabase.rpc('add_stock_to_product', {
        p_branch_id: selectedBranch, p_product_id: selectedExistingProduct, p_quantity: Number(addMoreQuantity)
      })
      if (error) alert("Error: " + error.message)
      else {
        alert("¡Stock actualizado!")
        setSelectedExistingProduct(''); setAddMoreQuantity(1);
        refreshAllData(selectedBranch, businessIdState);
        setActiveTab('ticket')
      }
    }
  }

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedQty = Number(transferQuantity)
    if (!transferProduct || parsedQty <= 0 || parsedQty > transferProduct.stock) return alert("Cantidad inválida o supera el stock.")
    const { error } = await supabase.from('inventory_transfers').insert({
      business_id: businessIdState, product_id: transferProduct.id || transferProduct.product_id,
      source_branch_id: transferProduct.branch_id, destination_branch_id: selectedBranch, quantity: parsedQty, status: 'pendiente'
    })
    if (error) alert("Error: " + error.message)
    else {
      alert("¡Solicitud enviada!")
      setTransferProduct(null); setTransferQuantity(1); loadTransfers(businessIdState, selectedBranch)
    }
  }

  const handleCompleteTransfer = async (transferId: string) => {
    const { error } = await supabase.rpc('complete_transfer', { transfer_id: transferId, current_biz_id: businessIdState })
    if (error) alert("Error: " + error.message)
    else { alert("¡Traslado completado!"); refreshAllData(selectedBranch, businessIdState); }
  }

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 800; canvas.height = 800
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, 800, 800)
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falló compresión')), 'image/jpeg', 0.7)
        }
      }
    })
  }

  const handleExit = () => {
    if (isStaff) { localStorage.removeItem('currentStaff'); router.push('/'); }
    else { router.push('/dashboard'); }
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && (selectedCategory ? p.category_id === selectedCategory : true))
  const filteredOtherStores = allStoreProducts.filter(p => p && p.branch_id !== selectedBranch && p.name.toLowerCase().includes(otherStoresSearch.toLowerCase()) && (selectedOtherStoreCategory ? p.category_id === selectedOtherStoreCategory : true))
  const lowStockItems = products.filter(p => p.stock <= 5 && !p.is_custom)

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-3 sm:p-6 flex flex-col w-full max-w-full overflow-x-hidden notranslate ${themeBg}`} translate="no">
      
      {/* HEADER SUPERIOR CON EL BOTÓN VERDE ≡ DE MENÚ AGRUPADO */}
      <header className={`p-3 sm:p-4 rounded-xl shadow mb-4 flex flex-col gap-3 border w-full ${panelBg}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3">
            
            {/* BOTÓN VERDE CON ÍCONO HAMBURGUESA ≡ */}
            <div className="relative" ref={opsDropdownRef}>
              <button
                onClick={() => setShowOpsDropdown(!showOpsDropdown)}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow transition-colors cursor-pointer select-none"
                title="Menú General"
              >
                ≡
              </button>

              {/* MENÚ DESPLEGABLE FLOTANTE AGRUPADO */}
              {showOpsDropdown && (
                <div className={`absolute left-0 mt-2 w-64 rounded-xl shadow-2xl border z-50 p-3 space-y-3 ${panelBg}`}>
                  
                  {/* SECCIÓN 1: OPCIONES OPERATIVAS */}
                  <div>
                    <p className="text-[11px] font-bold text-emerald-500 px-2 py-1 uppercase tracking-wider border-b border-opacity-30 mb-1">
                      ⚙️ Opciones Operativas
                    </p>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('addProduct'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      ➕ Agregar Inventario
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('otherStores'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      🏬 Inventario en Red
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('transfers'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      🔄 Módulo de Traslados
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('movements'); loadMovements(selectedBranch); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      📊 Movimientos / Cuadre
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('salesReport'); loadSalesReport(businessIdState, selectedBranch); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      💰 Reporte de Ventas
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('customers'); loadCustomers(businessIdState); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      👥 Directorio Clientes
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('customerLimits'); loadCustomers(businessIdState); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      🤝 Límite de Crédito Clientes
                    </button>
                  </div>

                  {/* SECCIÓN 2: OPCIONES ADMINISTRATIVAS */}
                  <div className="border-t border-opacity-30 pt-2">
                    <p className="text-[11px] font-bold text-purple-400 px-2 py-1 uppercase tracking-wider border-b border-opacity-30 mb-1">
                      🛡️ Opciones Administrativas
                    </p>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/inventario'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      📋 Módulo de Inventario
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/cotizaciones'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      📄 Cotizaciones / Proformas
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/compras'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      📦 Compras y Reabastecimiento
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/clientes/reportes'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      👥 Clientes y Reportes
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/ventas-historia'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      📅 Historial / Días
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/precios-especiales'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      🛡️ Auditoría de Precios
                    </button>
                  </div>

                </div>
              )}
            </div>

            {businessLogo ? (
              <img src={businessLogo} alt="Logo" className={`w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl p-1 border shadow ${isDarkMode ? 'bg-[#0f172a] border-slate-600' : 'bg-white border-slate-300'}`} />
            ) : (
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-[10px] border ${isDarkMode ? 'bg-[#0f172a] border-slate-600 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>POS</div>
            )}

            <div>
              <h1 className="text-base sm:text-xl font-bold leading-tight">Punto de Venta</h1>
              <select 
                value={selectedBranch} 
                onChange={e => handleBranchChange(e.target.value)}
                disabled={isStaff}
                className={`border px-2.5 py-1 rounded outline-none focus:border-emerald-500 font-semibold text-xs disabled:opacity-75 disabled:cursor-not-allowed mt-1 max-w-[180px] ${inputBg}`}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          {/* BARRA DE ACCESOS RÁPIDOS MÍNIMOS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin w-full sm:w-auto justify-start sm:justify-end">
             {(userRole === 'encargado' || !isStaff) && (
               <button onClick={() => router.push('/cajero')} className="bg-sky-600 hover:bg-sky-500 px-3 py-2 rounded-lg font-semibold text-xs transition-colors shadow flex items-center gap-1 text-white whitespace-nowrap">💵 Caja</button>
             )}

             <button onClick={toggleTicketPrinting} className={`px-2.5 py-2 rounded-lg font-semibold text-xs transition-colors border flex items-center gap-1 whitespace-nowrap ${enableTicketPrinting ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
               🖨️ {enableTicketPrinting ? 'ON' : 'OFF'}
             </button>

             <button onClick={toggleTheme} className={`px-2.5 py-2 rounded-lg font-semibold text-xs transition-colors border whitespace-nowrap ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}>
               {isDarkMode ? '☀️' : '🌙'}
             </button>

             <button onClick={() => setShowLowStockModal(true)} className={`relative px-2.5 py-2 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1 whitespace-nowrap ${lowStockItems.length > 0 ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300'}`}>
               ⚠️ {lowStockItems.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-md">{lowStockItems.length}</span>}
             </button>

             <button onClick={handleExit} className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded-lg font-semibold text-xs transition-colors text-white whitespace-nowrap">Salir</button>
          </div>
        </div>
      </header>

      {/* SELECTOR DE VISTA EN TELÉFONO */}
      <div className="flex lg:hidden grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setMobileViewTab('catalog')} className={`py-2.5 rounded-xl font-bold text-xs shadow ${mobileViewTab === 'catalog' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}>🛍️ Catálogo</button>
        <button onClick={() => setMobileViewTab('cart')} className={`py-2.5 rounded-xl font-bold text-xs shadow relative ${mobileViewTab === 'cart' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}>🛒 Ticket ({cart.reduce((a, c) => a + c.quantity, 0)})</button>
      </div>

      {/* MODAL DE OPCIONES OPERATIVAS */}
      {activeTab !== 'ticket' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className={`p-5 sm:p-6 rounded-2xl border border-emerald-500 w-full max-w-xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-500 uppercase tracking-wide">
                {activeTab === 'addProduct' && '➕ Agregar / Reabastecer Inventario'}
                {activeTab === 'otherStores' && '🏬 Inventario en Red (Otras Sucursales)'}
                {activeTab === 'transfers' && '🔄 Módulo de Traslados'}
                {activeTab === 'movements' && '📊 Movimientos y Cuadre Diario'}
                {activeTab === 'salesReport' && '💰 Reporte de Ventas de Hoy'}
                {activeTab === 'customers' && '👥 Directorio de Clientes'}
                {activeTab === 'customerLimits' && '🤝 Límite de Crédito Clientes'}
              </h3>
              <button onClick={() => setActiveTab('ticket')} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            {activeTab === 'addProduct' && (
              <form onSubmit={handleAddOrRestockProduct} className="space-y-3 text-sm">
                <div>
                  <label className="block mb-1 opacity-90">Seleccionar Producto</label>
                  <select value={selectedExistingProduct} onChange={e => setSelectedExistingProduct(e.target.value)} className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`}>
                    <option value="">-- Selecciona una opción --</option>
                    <option value="NEW">✨ [+ Crear Nuevo Producto]</option>
                    {products.map(p => <option key={p.id} value={p.id}>📦 {p.name} (Stock actual: {p.stock})</option>)}
                  </select>
                </div>

                {selectedExistingProduct && selectedExistingProduct !== 'NEW' && (
                  <div>
                    <label className="block mb-1 opacity-90">Cantidad a Agregar (Ingreso)</label>
                    <input type="number" min="1" value={addMoreQuantity} onChange={e => setAddMoreQuantity(Number(e.target.value))} className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`} required />
                  </div>
                )}

                {selectedExistingProduct === 'NEW' && (
                  <div className="space-y-3 border-t pt-3 mt-2 border-opacity-50">
                    <div>
                      <label className="block mb-1 opacity-90">Nombre del Nuevo Producto</label>
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Plato Extra" className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`} required />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block opacity-90">Categoría</label>
                        <button type="button" onClick={() => setShowNewCategoryModal(true)} className="text-emerald-500 font-bold text-xs">+ Crear Nueva</button>
                      </div>
                      <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`}>
                        <option value="">-- Sin Categoría --</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 opacity-90">Precio (Q)</label>
                      <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.00" className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`} required />
                    </div>
                    <div>
                      <label className="block mb-1 opacity-90">Stock Inicial</label>
                      <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} placeholder="0" className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block mb-1 opacity-90">Imagen del Producto</label>
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){setImageFile(f); setImagePreview(URL.createObjectURL(f));} }} className={`w-full border p-2 rounded-xl text-xs ${inputBg}`} />
                      {imagePreview && <img src={imagePreview} className="mt-2 w-full h-24 rounded object-cover border" alt="preview" />}
                    </div>
                  </div>
                )}

                {selectedExistingProduct && (
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={uploadingImage} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-xl font-bold text-white text-sm">
                      {uploadingImage ? 'Guardando...' : 'Guardar y Registrar'}
                    </button>
                    <button type="button" onClick={() => setSelectedExistingProduct('')} className="bg-slate-600 px-3 py-2.5 rounded-xl text-white text-sm">Cancelar</button>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'otherStores' && (
              <div className="space-y-3 text-sm">
                <input type="text" value={otherStoresSearch} onChange={e => setOtherStoresSearch(e.target.value)} placeholder="🔍 Buscar en otras sucursales..." className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`} />
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredOtherStores.map((p, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border flex justify-between items-center ${subPanelBg}`}>
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-amber-500 font-medium">Sucursal: {p.branch_name}</p>
                        <p className="text-xs opacity-75">Stock: <span className="text-emerald-500 font-bold">{p.stock}</span></p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-emerald-500 text-sm">Q {p.price}</span>
                        <button onClick={() => { setTransferProduct(p); setActiveTab('transfers'); }} className="bg-blue-600 text-xs px-2.5 py-1 rounded-lg text-white font-semibold">Solicitar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className="space-y-3 text-sm">
                {transferProduct && (
                  <form onSubmit={handleRequestTransfer} className={`p-3 rounded-xl border border-emerald-500/50 space-y-2 ${subPanelBg}`}>
                    <p className="font-bold text-sm">Solicitar: {transferProduct.name}</p>
                    <input type="number" min="1" value={transferQuantity} onChange={e => setTransferQuantity(Number(e.target.value))} className={`w-full border p-2 rounded-xl text-sm ${inputBg}`} required />
                    <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-xl font-bold text-sm">Enviar Solicitud</button>
                  </form>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {transfersList.map(t => (
                    <div key={t.transfer_id} className={`p-3 rounded-xl border text-xs space-y-1 ${subPanelBg}`}>
                      <div className="flex justify-between font-bold"><span className="text-emerald-500">{t.product_name}</span><span>{t.status}</span></div>
                      <p>De: {t.source_branch_name} → Para: {t.destination_branch_name} ({t.quantity} unids)</p>
                      {t.status === 'pendiente' && t.source_branch_id === selectedBranch && (
                        <button onClick={() => handleCompleteTransfer(t.transfer_id)} className="w-full bg-blue-600 text-white py-1 rounded-lg font-semibold mt-1">Aceptar y Enviar</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'movements' && (
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {branchMovements.map(m => (
                  <div key={m.id} className={`p-2.5 rounded-xl border flex justify-between ${subPanelBg}`}>
                    <span>{m.product?.name} ({m.movement_type})</span>
                    <span className={m.quantity < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{m.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'salesReport' && (
              <div className="space-y-3 text-xs">
                <div className={`p-3 rounded-xl border font-bold text-purple-500 text-base ${subPanelBg}`}>
                  Total Ventas Hoy: Q {salesReport.reduce((a, s) => a + Number(s.total_amount || 0), 0)}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {salesReport.map(s => (
                    <div key={s.sale_id} onClick={() => handleViewSaleDetails(s.sale_id)} className={`p-2.5 rounded-xl border cursor-pointer flex justify-between ${subPanelBg}`}>
                      <span>NIT: {s.customer_nit} ({s.customer_name})</span>
                      <span className="font-bold text-green-400">Q {s.total_amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {customersList.map(c => (
                  <div key={c.customer_id} className={`p-2.5 rounded-xl border flex justify-between ${subPanelBg}`}>
                    <span>{c.name} (NIT: {c.nit})</span>
                    <span className="text-emerald-400 font-bold">{c.total_purchases} compras</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'customerLimits' && (
              <div className="space-y-3 text-xs relative">
                <div>
                  <label className="block mb-1 text-slate-300 font-semibold">Buscar y Seleccionar Cliente</label>
                  <input 
                    type="text"
                    value={limitSearchQuery}
                    onChange={e => handleSearchCustomerForLimit(e.target.value)}
                    onFocus={() => setShowLimitSuggestions(true)}
                    placeholder="🔍 Escribe nombre, NIT o DPI..."
                    className={`w-full border p-2.5 rounded-xl text-xs ${inputBg}`}
                  />

                  {showLimitSuggestions && limitSearchQuery.trim() !== '' && filteredCustomersForLimit.length > 0 && (
                    <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto border ${subPanelBg}`}>
                      {filteredCustomersForLimit.map(c => (
                        <div 
                          key={c.customer_id}
                          onClick={() => handleSelectCustomerForLimit(c)}
                          className="p-2.5 hover:bg-emerald-600 hover:text-white cursor-pointer border-b border-slate-700 flex justify-between items-center transition-colors"
                        >
                          <div>
                            <p className="font-bold">{c.name}</p>
                            <p className="text-[10px] opacity-75">NIT: {c.nit || 'CF'} | DPI: {c.dpi || 'N/A'}</p>
                          </div>
                          <span className="text-[10px] bg-emerald-500/20 px-2 py-1 rounded font-bold">Seleccionar 🖱️</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {customerLimitDetails && (
                  <div className={`p-3 rounded-xl border space-y-3 mt-3 ${subPanelBg}`}>
                    <p className="font-bold text-emerald-400 text-sm">📋 Configuración de Crédito</p>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cliente:</span>
                      <span className="font-bold text-white">{customerLimitDetails.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">NIT / DPI:</span>
                      <span className="font-semibold">{customerLimitDetails.nit || 'CF'} | {customerLimitDetails.dpi || 'N/A'}</span>
                    </div>
                    
                    <div className="space-y-1 pt-2 border-t border-slate-700">
                      <label className="block text-slate-300 font-semibold">Límite de Facturas al Crédito Simultáneas:</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          min="1" 
                          value={newCreditLimitValue} 
                          onChange={e => setNewCreditLimitValue(e.target.value)} 
                          className={`flex-1 border p-2 rounded-lg text-xs font-bold text-emerald-400 ${inputBg}`} 
                        />
                        <button 
                          onClick={handleSaveCustomerLimit}
                          disabled={isUpdatingLimit}
                          className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold text-white"
                        >
                          {isUpdatingLimit ? 'Guardando...' : 'Actualizar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setActiveTab('ticket')} className="w-full bg-slate-600 hover:bg-slate-500 text-white py-2.5 rounded-xl font-bold text-sm">
              Cerrar Panel
            </button>
          </div>
        </div>
      )}

      {/* DISEÑO PRINCIPAL DE DOS COLUMNAS AMPLIADAS (CATÁLOGO Y TICKET) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 w-full">
        
        {/* PANEL CENTRAL: CATÁLOGO DE PRODUCTOS */}
        <div className={`lg:col-span-2 p-4 sm:p-5 rounded-xl shadow border flex flex-col ${mobileViewTab === 'catalog' ? 'flex' : 'hidden'} lg:flex ${panelBg}`}>
          <div className="mb-3 relative" ref={searchRef}>
            <input 
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="🔍 Buscar producto por nombre..."
              className={`w-full border px-4 py-2.5 rounded-xl text-sm outline-none focus:border-emerald-500 border ${inputBg}`}
            />

            {showSuggestions && searchTerm.trim() !== '' && (
              <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto border ${subPanelBg}`}>
                {filteredProducts.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => { 
                      if (p.stock <= 0) {
                        alert("⚠️ Este producto no tiene existencias disponibles (Stock 0).");
                        return;
                      }
                      addToCart(p); 
                      setSearchTerm(''); 
                      setShowSuggestions(false); 
                    }} 
                    className={`w-full text-left px-4 py-3 hover:opacity-75 flex justify-between items-center border-b text-sm ${p.stock <= 0 ? 'opacity-45 cursor-not-allowed' : ''}`}
                  >
                    <div>
                      <span className="font-semibold">{p.name}</span>
                      <span className={`ml-2 text-xs font-semibold ${p.stock <= 0 ? 'text-red-400 font-bold' : 'opacity-75'}`}>(Stock: {p.stock})</span>
                    </div>
                    <span className="text-emerald-500 font-bold">Q {p.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-thin">
            <button onClick={() => setSelectedCategory(null)} className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ${selectedCategory === null ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`}`}>✨ Todos</button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`}`}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* TARJETAS DE PRODUCTOS CON LAZY LOADING PARA MEJORAR VELOCIDAD */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto max-h-[60vh] sm:max-h-[65vh] pr-1 flex-1">
            {filteredProducts.length === 0 ? (
              <p className="col-span-full text-center py-10 text-sm sm:text-base opacity-75">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => {
                const isOutOfStock = p.stock <= 0;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)} 
                    className={`border p-3 rounded-xl flex flex-col justify-between text-left shadow h-full select-none ${subPanelBg} ${
                      isOutOfStock 
                        ? 'opacity-45 cursor-not-allowed border-red-500/40' 
                        : 'hover:border-emerald-500 active:scale-95 active:border-emerald-400 cursor-pointer group'
                    }`}
                  >
                    <div className="flex flex-col">
                      {p.image_url ? (
                        <img 
                          src={p.image_url} 
                          alt={p.name} 
                          loading="lazy"
                          className="w-full h-24 sm:h-28 object-cover rounded-lg mb-2 border" 
                        />
                      ) : (
                        <div className="w-full h-24 sm:h-28 rounded-lg mb-2 flex items-center justify-center text-xs opacity-50 border">Sin imagen</div>
                      )}
                      <span className={`text-[11px] sm:text-xs block mb-1 ${isOutOfStock ? 'text-red-400 font-bold' : 'font-semibold opacity-80'}`}>
                        Stock: <strong className={isOutOfStock ? 'text-red-400' : 'text-emerald-500'}>{p.is_custom ? 'N/A' : p.stock}</strong> {isOutOfStock ? '(Agotado)' : ''}
                      </span>
                      <h3 className={`font-bold line-clamp-2 text-xs sm:text-sm leading-snug ${isOutOfStock ? 'opacity-75' : 'group-hover:text-emerald-500'}`}>{p.name}</h3>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-opacity-50 flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs uppercase opacity-70">{p.is_custom ? 'Variable' : 'Precio'}</span>
                      <span className="text-emerald-500 font-extrabold text-sm sm:text-base" translate="no">{p.is_custom ? 'A cotizar' : `Q ${p.price}`}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL DERECHO: TICKET / DETALLE DE ORDEN */}
        <div className={`p-4 sm:p-5 rounded-xl shadow border flex flex-col justify-between ${mobileViewTab === 'cart' ? 'flex' : 'hidden'} lg:flex ${panelBg}`}>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-emerald-500 mb-3">Ticket de Venta</h2>
            <div className="space-y-2.5 overflow-y-auto max-h-[38vh] sm:max-h-[42vh] pr-1">
              {cart.length === 0 ? (
                <p className="text-center py-10 text-sm sm:text-base opacity-75">El carrito está vacío.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className={`flex flex-col gap-2 p-3 rounded-xl border text-xs sm:text-sm ${subPanelBg}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{item.name}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded text-xs">✕</button>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] opacity-80">Precio Q:</span>
                        <input type="number" step="0.01" value={item.price} onChange={(e) => handlePriceChange(item.id, e.target.value)} className={`w-16 sm:w-20 border rounded-lg px-2 py-1 text-emerald-500 font-bold text-xs sm:text-sm outline-none ${inputBg}`} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] opacity-80">Cant:</span>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityChange(item.id, e.target.value)} className={`w-14 sm:w-16 border rounded-lg px-2 py-1 font-bold text-xs sm:text-sm text-center ${inputBg}`} />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1.5 border-t border-opacity-50">
                      <span className="text-[11px] opacity-80">Subtotal:</span>
                      <span className="font-extrabold text-emerald-500 text-sm sm:text-base" translate="no">Q {item.price * item.quantity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-opacity-50 pt-3 mt-3 space-y-3">
            
            {/* SELECCIÓN DE MÉTODO DE PAGO (CONTADO VS CRÉDITO) */}
            <div className="space-y-2 bg-[#0f172a]/40 p-3 rounded-xl border border-slate-700">
              <label className="block text-xs font-semibold text-slate-400">Tipo de Transacción:</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setPaymentMethod('Contado')} 
                  className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${paymentMethod === 'Contado' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-700 text-slate-300'}`}
                >
                  💵 Contado
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setPaymentMethod('Crédito');
                    loadCustomers(businessIdState);
                  }} 
                  className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${paymentMethod === 'Crédito' ? 'bg-amber-600 text-white shadow' : 'bg-slate-700 text-slate-300'}`}
                >
                  📋 Crédito (Fiado)
                </button>
              </div>

              {paymentMethod === 'Crédito' && (
                <div className="space-y-3 pt-2 border-t border-slate-700 text-xs relative">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Buscar Cliente por NIT, DPI o Nombre *</label>
                    <input 
                      type="text" 
                      value={customerSearchQuery} 
                      onChange={e => handleSearchCustomerForCredit(e.target.value)}
                      onFocus={() => setShowCustomerSuggestions(true)}
                      placeholder="Ej. 12345678 o Juan Pérez..." 
                      className={`w-full border p-2 rounded-xl text-xs ${inputBg}`}
                    />

                    {/* MENÚ DESPLEGABLE DE SUGERENCIAS CLICKEABLES */}
                    {showCustomerSuggestions && customerSearchQuery.trim() !== '' && filteredCustomersForCredit.length > 0 && (
                      <div className={`absolute left-0 right-0 mt-1 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto border ${subPanelBg}`}>
                        {filteredCustomersForCredit.map(c => (
                          <div 
                            key={c.customer_id}
                            onClick={() => handleSelectCustomer(c)}
                            className="p-2.5 hover:bg-emerald-600 hover:text-white cursor-pointer border-b border-slate-700 flex justify-between items-center transition-colors"
                          >
                            <div>
                              <p className="font-bold">{c.name}</p>
                              <p className="text-[10px] opacity-75">NIT: {c.nit || 'CF'} | DPI: {c.dpi || 'N/A'}</p>
                            </div>
                            <span className="text-[10px] bg-emerald-500/20 px-2 py-1 rounded font-bold">Seleccionar 🖱️</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {customerFound && !isCreatingOrEditingCustomer && (
                    <div className="bg-emerald-950/40 border border-emerald-500/50 p-2.5 rounded-xl space-y-1">
                      <p className="text-emerald-400 font-bold">✅ Cliente Seleccionado:</p>
                      <p className="text-white font-semibold">{customerFound.name}</p>
                      <p className="text-[10px] text-slate-300">NIT: {customerFound.nit || 'CF'} | DPI: {customerFound.dpi || 'No registrado'}</p>
                      <button 
                        type="button" 
                        onClick={() => setIsCreatingOrEditingCustomer(true)} 
                        className="text-[10px] text-amber-400 underline font-semibold mt-1 block hover:text-amber-300"
                      >
                        ✏️ Actualizar datos faltantes
                      </button>
                    </div>
                  )}

                  {isCreatingOrEditingCustomer && (
                    <div className="bg-[#0f172a] p-3 rounded-xl border border-amber-500/50 space-y-2">
                      <p className="text-amber-400 font-bold text-[11px]">
                        {customerFound ? '⚠️ Faltan datos esenciales o el DPI es inválido. Completa:' : '✨ Registrando Nuevo Cliente para Crédito:'}
                      </p>
                      
                      <div>
                        <label className="block text-[10px] text-slate-400">Nombre Completo *</label>
                        <input type="text" value={expressName} onChange={e => setExpressName(e.target.value)} placeholder="Nombre del cliente" className={`w-full border p-1.5 rounded text-xs ${inputBg}`} required />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400">NIT</label>
                          <input type="text" value={expressNit} onChange={e => setExpressNit(e.target.value)} placeholder="CF o NIT" className={`w-full border p-1.5 rounded text-xs ${inputBg}`} />
                        </div>
                        <div>
                          <div className="flex justify-between items-center">
                            <label className="block text-[10px] text-slate-400">DPI (13 dígitos) *</label>
                            <span className={`text-[9px] font-bold ${expressDpi.trim().length === 13 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {expressDpi.trim().length}/13
                            </span>
                          </div>
                          <input 
                            type="text" 
                            maxLength={13} 
                            value={expressDpi} 
                            onChange={e => setExpressDpi(e.target.value.replace(/\D/g, ''))} 
                            placeholder="Ej. 3012123450101" 
                            className={`w-full border p-1.5 rounded text-xs font-mono ${inputBg} ${expressDpi.trim().length > 0 && expressDpi.trim().length !== 13 ? 'border-amber-500' : ''}`} 
                            required 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400">Teléfono / WhatsApp</label>
                          <input type="text" value={expressPhone} onChange={e => setExpressPhone(e.target.value)} placeholder="Teléfono" className={`w-full border p-1.5 rounded text-xs ${inputBg}`} />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">Correo Electrónico</label>
                          <input type="email" value={expressEmail} onChange={e => setExpressEmail(e.target.value)} placeholder="correo@ejemplo.com" className={`w-full border p-1.5 rounded text-xs ${inputBg}`} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400">Dirección</label>
                        <input type="text" value={expressAddress} onChange={e => setExpressAddress(e.target.value)} placeholder="Dirección" className={`w-full border p-1.5 rounded text-xs ${inputBg}`} />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Fecha Límite de Pago *</label>
                    <input 
                      type="date" 
                      value={creditDueDate} 
                      onChange={e => setCreditDueDate(e.target.value)} 
                      className={`w-full border p-2 rounded-xl text-xs ${inputBg}`}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mb-1 text-lg sm:text-xl font-bold">
              <span>Total:</span>
              <span className="text-emerald-500 text-xl sm:text-2xl" translate="no">Q {totalCart}</span>
            </div>

            <button onClick={handleSavePendingOrder} disabled={cart.length === 0 || isSubmittingOrder} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow text-sm flex items-center justify-center gap-2">
              {isSubmittingOrder ? 'Guardando...' : paymentMethod === 'Crédito' ? '📋 Registrar Venta al Crédito' : '📝 Guardar Orden (Pasar a Caja)'}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL DE STOCK BAJO */}
      {showLowStockModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className={`p-5 sm:p-6 rounded-2xl border border-amber-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <h3 className="text-base font-bold text-amber-500">⚠️ Productos con Stock Bajo (≤ 5)</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto text-sm">
              {lowStockItems.map(p => (
                <div key={p.id} className={`p-3 rounded-xl border flex justify-between ${subPanelBg}`}>
                  <span>{p.name}</span>
                  <span className="text-red-400 font-bold">Stock: {p.stock}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowLowStockModal(false)} className="w-full bg-slate-600 text-white py-2.5 rounded-xl font-semibold text-sm">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE VENTA */}
      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className={`p-5 sm:p-6 rounded-2xl border border-emerald-500 w-full max-w-md shadow-2xl ${panelBg}`}>
            <h3 className="text-base font-bold text-emerald-500 mb-4">📦 Detalle de la Venta</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
              {selectedSaleDetails.map((item, idx) => (
                <div key={idx} className={`p-3 rounded-xl border flex justify-between ${subPanelBg}`}>
                  <span>{item.product_name} ({item.quantity} x Q {item.price})</span>
                  <span className="font-bold text-emerald-400">Q {item.quantity * item.price}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedSaleDetails(null)} className="mt-6 w-full bg-slate-600 text-white py-3 rounded-xl font-semibold text-sm">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CATEGORÍA */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`p-5 sm:p-6 rounded-2xl border border-emerald-500 w-full max-w-sm space-y-4 ${panelBg}`}>
            <h3 className="text-base font-bold text-emerald-500">✨ Nueva Categoría</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-sm">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nombre..." className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`} required autoFocus />
              <div className="flex gap-2">
                <button type="submit" disabled={savingCategory} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold">Guardar</button>
                <button type="button" onClick={() => setShowNewCategoryModal(false)} className="bg-slate-600 text-white px-4 py-2.5 rounded-xl">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}