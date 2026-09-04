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
  
  const [showOpsDropdown, setShowOpsDropdown] = useState(false)
  const opsDropdownRef = useRef<HTMLDivElement>(null)

  const router = useRouter()

  const [mobileViewTab, setMobileViewTab] = useState<'catalog' | 'cart'>('catalog')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [enableTicketPrinting, setEnableTicketPrinting] = useState<boolean>(false)

  // ESTADOS PARA VENTAS AL CONTADO O CRÉDITO
  const [paymentMethod, setPaymentMethod] = useState<'Contado' | 'Crédito'>('Contado')
  const [selectedCustomerForCredit, setSelectedCustomerForCredit] = useState<string>('')
  const [creditDueDate, setCreditDueDate] = useState<string>('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerFound, setCustomerFound] = useState<any | null>(null)
  const [isCreatingOrEditingCustomer, setIsCreatingOrEditingCustomer] = useState(false)

  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [filteredCustomersForCredit, setFilteredCustomersForCredit] = useState<any[]>([])

  const [selectedCustomerLimitId, setSelectedCustomerLimitId] = useState<string>('')
  const [customerLimitDetails, setCustomerLimitDetails] = useState<any | null>(null)
  const [newCreditLimitValue, setNewCreditLimitValue] = useState<string>('3')
  const [isUpdatingLimit, setIsUpdatingLimit] = useState<boolean>(false)

  const [limitSearchQuery, setLimitSearchQuery] = useState('')
  const [showLimitSuggestions, setShowLimitSuggestions] = useState(false)
  const [filteredCustomersForLimit, setFilteredCustomersForLimit] = useState<any[]>([])

  const [expressName, setExpressName] = useState('')
  const [expressNit, setExpressNit] = useState('')
  const [expressDpi, setExpressDpi] = useState('')
  const [expressPhone, setExpressPhone] = useState('')
  const [expressAddress, setExpressAddress] = useState('')
  const [expressEmail, setExpressEmail] = useState('')

  const [showCustomModal, setShowCustomModal] = useState(false)
  const [pendingCustomProduct, setPendingCustomProduct] = useState<any>(null)
  const [customNotesInput, setCustomNotesInput] = useState('')
  const [customPriceInput, setCustomPriceInput] = useState('')
  const [customEventDateInput, setCustomEventDateInput] = useState('')

  const [customOrdersSubTab, setCustomOrdersSubTab] = useState<'pendientes' | 'entregados'>('pendientes')

  // ESTADOS PARA GESTIÓN DE MESAS Y ÓRDENES ABIERTAS
  const [editingTableOrderId, setEditingTableOrderId] = useState<string | null>(null)
  const [editingTableName, setEditingTableName] = useState<string | null>(null)
  const [inputTableName, setInputTableName] = useState<string>('')
  const [tablesOrdersList, setTablesOrdersList] = useState<any[]>([])

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  // EFECTO PARA CARGAR COTIZACIONES SELECCIONADAS DESDE EL MÓDULO DE COTIZACIONES
  useEffect(() => {
    const loadedQuoteStr = localStorage.getItem('pos_loaded_quote');
    if (loadedQuoteStr) {
      try {
        const quoteData = JSON.parse(loadedQuoteStr);
        
        if (quoteData.customer) {
          setCustomerSearchQuery(quoteData.customer.name || '');
          setCustomerFound(quoteData.customer);
          setSelectedCustomerForCredit(quoteData.customer.id || '');
          setExpressName(quoteData.customer.name || '');
          setExpressNit(quoteData.customer.nit || 'CF');
          setExpressPhone(quoteData.customer.phone || '');
          setExpressAddress(quoteData.customer.address || '');
          setExpressEmail(quoteData.customer.email || '');
        }

        if (quoteData.cart && Array.isArray(quoteData.cart)) {
          const formattedCartItems = quoteData.cart.map((item: any) => ({
            id: item.id || item.product_id,
            name: item.name || item.product_name,
            price: Number(item.price || item.price_at_quote || 0),
            originalPrice: Number(item.price || item.price_at_quote || 0),
            quantity: Number(item.quantity || 1),
            notes: item.notes || '',
            eventDate: item.eventDate || item.event_date || null,
            stock: item.stock ?? 999,
            hasStockIssue: item.hasStockIssue || false,
            isSpecial: false
          }));
          setCart(formattedCartItems);
        }

        localStorage.removeItem('pos_loaded_quote');
        showToast('✅ Cotización cargada con éxito en el POS', 'success');
      } catch (e) {
        console.error("Error al procesar la cotización en el POS:", e);
      }
    }
  }, []);
  
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

  const [businessLogo, setBusinessLogo] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [otherStoresSearch, setOtherStoresSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [showLowStockModal, setShowLowStockModal] = useState(false)

  const [activeTab, setActiveTab] = useState<'ticket' | 'addProduct' | 'otherStores' | 'transfers' | 'movements' | 'salesReport' | 'customers' | 'customerLimits' | 'customOrders' | 'tables'>('ticket')
  const [allStoreProducts, setAllStoreProducts] = useState<any[]>([])

  const [businessIdState, setBusinessIdState] = useState<string>('')
  const [transfersList, setTransfersList] = useState<any[]>([])
  const [transferProduct, setTransferProduct] = useState<any>(null)
  const [transferQuantity, setTransferQuantity] = useState<any>(1)
  const [branchMovements, setBranchMovements] = useState<any[]>([])
  const [salesReport, setSalesReport] = useState<any[]>([])
  const [customersList, setCustomersList] = useState<any[]>([])
  const [customOrdersList, setCustomOrdersList] = useState<any[]>([])

  const [selectedExistingProduct, setSelectedExistingProduct] = useState<string>('')
  const [addMoreQuantity, setAddMoreQuantity] = useState<number>(1)

  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [isCreatingCategoryInline, setIsCreatingCategoryInline] = useState(false)
  const [inlineCategoryName, setInlineCategoryName] = useState('')
  const [savingCategoryInline, setSavingCategoryInline] = useState(false)

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
            loadCustomOrders(resolvedBizId, staff.branch_id)
            loadTableOrders(resolvedBizId, staff.branch_id)
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
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const refreshAllData = (branchId: string, bizId: string) => {
    loadProducts(branchId)
    loadMovements(branchId)
    loadTransfers(bizId, branchId)
    loadOtherStoresProducts(bizId, branchId)
    loadSalesReport(bizId, branchId)
    loadCustomers(bizId)
    loadCustomOrders(bizId, branchId)
    loadTableOrders(bizId, branchId)
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

  async function loadCustomOrders(bId?: string, brId?: string) {
    let currentBizId = bId || businessIdState;
    const currentBranchId = brId || selectedBranch;

    if (!currentBizId) {
      const staffStr = localStorage.getItem('currentStaff');
      if (staffStr) {
        try {
          const staff = JSON.parse(staffStr);
          currentBizId = staff.business_id || staff.busines_id;
        } catch (e) {}
      }
    }
    if (!currentBizId || !currentBranchId) return;

    const { data, error } = await supabase.rpc('get_custom_orders_report', {
      p_business_id: currentBizId,
      p_branch_id: currentBranchId
    });

    if (!error && data) {
      setCustomOrdersList(data);
    }
  }

  async function loadTableOrders(bId?: string, brId?: string) {
    const currentBizId = bId || businessIdState;
    const currentBranchId = brId || selectedBranch;
    if (!currentBizId || !currentBranchId) return;

    const { data, error } = await supabase.rpc('get_table_orders_active', {
      p_business_id: currentBizId,
      p_branch_id: currentBranchId
    });

    if (!error && data) {
      setTablesOrdersList(data);
    } else {
      console.error("Error al cargar órdenes de mesa:", error?.message);
    }
  }

  const handleSelectTableOrder = (order: any) => {
    setEditingTableOrderId(order.id);
    setEditingTableName(order.table_name);
    setInputTableName(order.table_name);
    
    if (order.customer) {
      setCustomerSearchQuery(order.customer.name || '');
      setCustomerFound(order.customer);
      setSelectedCustomerForCredit(order.customer.id || '');
      setExpressName(order.customer.name || '');
      setExpressNit(order.customer.nit || 'CF');
    }

    if (order.order_items && Array.isArray(order.order_items)) {
      const formatted = order.order_items.map((i: any) => ({
        id: i.product_id,
        name: i.product?.name || i.name || 'Producto',
        price: Number(i.price || 0),
        originalPrice: Number(i.price || 0),
        quantity: Number(i.quantity || 1),
        notes: i.notes || '',
        eventDate: i.event_date || null,
        stock: i.product?.stock ?? 999,
        hasStockIssue: false,
        isSpecial: false
      }));
      setCart(formatted);
    }

    setActiveTab('ticket');
    showToast(`✅ Orden de ${order.table_name} cargada para editar`, 'success');
  };

  // FUNCIÓN CORREGIDA: Carga los ítems al carrito del POS antes de mandar la orden a caja para que aparezcan en el ticket
  async function handleSendTableToCheckout(order: any) {
    if (order.order_items && Array.isArray(order.order_items)) {
      const formatted = order.order_items.map((i: any) => ({
        id: i.product_id,
        name: i.product?.name || i.name || 'Producto',
        price: Number(i.price || 0),
        originalPrice: Number(i.price || 0),
        quantity: Number(i.quantity || 1),
        notes: i.notes || '',
        eventDate: i.event_date || null,
        stock: i.product?.stock ?? 999,
        hasStockIssue: false,
        isSpecial: false
      }));
      setCart(formatted);
    }

    if (order.customer) {
      setCustomerSearchQuery(order.customer.name || '');
      setCustomerFound(order.customer);
      setSelectedCustomerForCredit(order.customer.id || '');
      setExpressName(order.customer.name || '');
      setExpressNit(order.customer.nit || 'CF');
    }

    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'pendiente', 
        table_name: null 
      })
      .eq('id', order.id);

    if (error) {
      showToast("Error al pasar la orden a caja: " + error.message, 'error');
    } else {
      showToast(`✅ ¡Orden de ${order.table_name || 'Mesa'} enviada a caja con éxito!`, 'success');
      
      setActiveTab('ticket'); // Regresa al POS principal
      loadTableOrders(businessIdState, selectedBranch);
      refreshAllData(selectedBranch, businessIdState);
    }
  }

  async function handleToggleOrderStatus(orderId: string, currentStatus: string) {
    const newStatus = currentStatus === 'entregado' ? 'pendiente' : 'entregado';
    const { error } = await supabase.rpc('update_order_delivery_status', {
      p_order_id: orderId,
      p_status: newStatus
    });

    if (error) {
      showToast("Error al actualizar estado: " + error.message, 'error');
    } else {
      showToast(newStatus === 'entregado' ? "✅ ¡Pedido marcado como Entregado!" : "🔄 Pedido devuelto a pendientes.", 'success');
      loadCustomOrders(businessIdState, selectedBranch);
    }
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
    if (!selectedCustomerLimitId) return showToast("Selecciona un cliente.", 'error')
    const limitNum = parseInt(newCreditLimitValue, 10)
    if (isNaN(limitNum) || limitNum < 0) return showToast("Ingresa un límite válido.", 'error')

    setIsUpdatingLimit(true)
    const { error } = await supabase.rpc('update_customer_credit_limit', {
      p_customer_id: selectedCustomerLimitId,
      p_credit_limit: limitNum
    })
    
    if (error) {
      setIsUpdatingLimit(false)
      showToast("Error al actualizar límite: " + error.message, 'error')
    } else {
      setCustomerLimitDetails((prev: any) => prev ? { ...prev, credit_limit: limitNum } : null)
      setNewCreditLimitValue(String(limitNum))
      await loadCustomers(businessIdState)
      setIsUpdatingLimit(false)
      showToast("✅ ¡Límite de crédito actualizado con éxito!", 'success')
    }
  }

  async function handleCreateCategoryInline() {
    if (!inlineCategoryName.trim() || !businessIdState) return

    setSavingCategoryInline(true)
    const { data, error } = await supabase
      .from('categories')
      .insert([{ business_id: businessIdState, name: inlineCategoryName.trim() }])
      .select('*')
      .single()

    setSavingCategoryInline(false)

    if (error) {
      showToast("Error al crear categoría: " + error.message, 'error')
    } else if (data) {
      showToast("¡Categoría creada con éxito!", 'success')
      setCategories(prev => [...prev, data])
      setNewCategoryId(data.id)
      setInlineCategoryName('')
      setIsCreatingCategoryInline(false)
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

  // FUNCIÓN PARA IMPRIMIR TICKET EN PDF/VENTANA SI ESTÁ ACTIVO EL SWITCH
  const printTicketPdf = (orderNumber: string, itemsList: any[], totalAmt: number) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = itemsList.map(i => `
      <tr>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ddd;">${i.quantity}x ${i.name} ${i.notes ? `<br><small>(${i.notes})</small>` : ''}</td>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ddd; text-align: right;">Q ${(i.price * i.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket #${orderNumber}</title>
          <style>
            body { font-family: monospace; font-size: 12px; width: 100%; margin: 0; padding: 10px; }
            h2, p { text-align: center; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .total { font-size: 14px; font-weight: bold; text-align: right; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h2>COMPROBANTE DE ORDEN</h2>
          <p>Orden / Turno: <strong>#${orderNumber}</strong></p>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <hr style="border: dashed 1px #000;" />
          <table>
            ${itemsHtml}
          </table>
          <hr style="border: dashed 1px #000;" />
          <p class="total">TOTAL: Q ${totalAmt.toFixed(2)}</p>
          <p style="margin-top: 20px; font-size: 10px;">¡Gracias por su preferencia!</p>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

async function handleSavePendingOrder() {
    if (isSubmittingOrder) return
    if (cart.length === 0) return showToast("El carrito está vacío.", 'error')

    const hasStockError = cart.some(item => item.hasStockIssue || item.quantity > item.stock);
    if (hasStockError) {
      return showToast("⚠️ No se puede procesar la orden: hay productos que superan el stock disponible en inventario.", 'error');
    }
   
    if (paymentMethod === 'Crédito') {
      if (!customerSearchQuery.trim() && !expressName.trim()) {
        return showToast("⚠️ Debes ingresar el nombre y datos del cliente para la venta al crédito.", 'error');
      }
      if (!creditDueDate) {
        return showToast("⚠️ Selecciona una fecha límite de pago para este crédito.", 'error');
      }

      const cleanDpi = expressDpi.trim();
      if (!cleanDpi || cleanDpi.length !== 13 || !/^\d+$/.test(cleanDpi)) {
        return showToast("⚠️ El DPI es obligatorio para ventas al crédito y debe contener exactamente 13 dígitos numéricos.", 'error');
      }

      setIsSubmittingOrder(true);

      const cartJson = cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        name: item.name,
        notes: item.notes || null,
        event_date: item.eventDate || null
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
        showToast("Error en la transacción al crédito: " + error.message, 'error');
      } else {
        showToast("✅ ¡Venta al crédito registrada con éxito!", 'success');
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

      let resolvedCustomerId = selectedCustomerForCredit || null;

      if (!resolvedCustomerId && customerSearchQuery.trim()) {
        const { data: newCustData, error: custError } = await supabase.rpc('create_or_get_customer', {
          p_business_id: businessIdState,
          p_name: customerSearchQuery.trim(),
          p_nit: 'CF',
          p_dpi: null,
          p_phone: null,
          p_address: null,
          p_email: null
        });

        if (!custError && newCustData) {
          resolvedCustomerId = newCustData;
        }
      }

      // Si estamos editando una orden de mesa existente
      if (editingTableOrderId) {
        const standardCartJson = cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || null,
          event_date: item.eventDate || null
        }));

        const { error: updateError } = await supabase.rpc('update_order_with_table', {
          p_order_id: editingTableOrderId,
          p_total_amount: totalCart,
          p_customer_id: resolvedCustomerId,
          p_table_name: editingTableName || inputTableName.trim(),
          p_items: standardCartJson
        });

        setIsSubmittingOrder(false);

        if (updateError) {
          showToast("Error al actualizar la orden de mesa: " + updateError.message, 'error');
          return;
        }

        showToast(`✅ ¡Orden de ${editingTableName || 'Mesa'} actualizada con éxito!`, 'success');
        setCart([]);
        setInputTableName('');
        setEditingTableOrderId(null);
        setEditingTableName(null);
        setCustomerSearchQuery('');
        setCustomerFound(null);
        refreshAllData(selectedBranch, businessIdState);
        return;
      }

      const standardCartJson = cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes || null,
        event_date: item.eventDate || null
      }));

      const tableNameValue = inputTableName.trim() !== '' ? inputTableName.trim() : null;

      if (tableNameValue) {
        // Se mantiene intacto el flujo de mesas usando la función RPC existente
        const { data, error } = await supabase.rpc('create_order_with_table', {
          p_business_id: businessIdState,
          p_branch_id: selectedBranch,
          p_customer_id: resolvedCustomerId,
          p_total_amount: totalCart,
          p_items: standardCartJson,
          p_table_name: tableNameValue
        });

        setIsSubmittingOrder(false);

        if (error) {
          showToast("Error al guardar la orden de mesa: " + error.message, 'error');
        } else {
          showToast(`✅ ¡Orden guardada en Mesa: ${tableNameValue}!`, 'success');
          if (enableTicketPrinting && data && data.length > 0) {
            printTicketPdf(data[0].order_number || 'S/N', cart, totalCart);
          }
          setCart([]);
          setInputTableName('');
          setEditingTableOrderId(null);
          setEditingTableName(null);
          setCustomerSearchQuery('');
          setCustomerFound(null);
          refreshAllData(selectedBranch, businessIdState);
        }
} else {
        // 1. Calcular el siguiente número consecutivo para la sucursal en la tabla sales
        const { data: existingSales } = await supabase
          .from('sales')
          .select('order_number')
          .eq('branch_id', selectedBranch);

        let nextNum = 1;
        if (existingSales && existingSales.length > 0) {
          const numbers = existingSales.map(s => {
            const clean = String(s.order_number || '').replace(/\D/g, '');
            return clean ? parseInt(clean, 10) : 0;
          });
          nextNum = Math.max(...numbers, 0) + 1;
        }

        const correlativeOrderNumber = String(nextNum);

        // 2. Venta normal directa con el número de orden consecutivo
        const { data: newSaleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            business_id: businessIdState,
            branch_id: selectedBranch,
            customer_id: resolvedCustomerId,
            total_amount: totalCart,
            status: 'Pendiente',
            payment_method: 'Contado',
            order_number: correlativeOrderNumber
          })
          .select()
          .single();

        if (saleError) {
          setIsSubmittingOrder(false);
          showToast("Error al registrar la orden para caja: " + saleError.message, 'error');
          return;
        }

        const itemsToInsert = cart.map(item => ({
          sale_id: newSaleData.id,
          product_id: item.id,
          quantity: item.quantity,
          price_at_sale: item.price,
          notes: item.notes || null,
          event_date: item.eventDate || null
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(itemsToInsert);

        setIsSubmittingOrder(false);

        if (itemsError) {
          showToast("Error al guardar los items de la venta: " + itemsError.message, 'error');
        } else {
          const numeroTurno = newSaleData.order_number || correlativeOrderNumber;
          showToast(`✅ ¡Orden enviada a caja con éxito! Turno #${numeroTurno}`, 'success');

          if (enableTicketPrinting) {
            printTicketPdf(String(numeroTurno), cart, totalCart);
          }

          setCart([]);
          setInputTableName('');
          setEditingTableOrderId(null);
          setEditingTableName(null);
          setCustomerSearchQuery('');
          setCustomerFound(null);
          refreshAllData(selectedBranch, businessIdState);
        }
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
    const isCustomProduct = Boolean(
      product.is_custom || 
      product.price === 0 || 
      (product.name && (
        product.name.toLowerCase().includes('vinil') || 
        product.name.toLowerCase().includes('personaliz') ||
        product.name.toLowerCase().includes('manta') ||
        product.name.toLowerCase().includes('evento personalizado') ||
        product.name.toLowerCase().includes('arreglo pequeño')
      ))
    );

    if (!isCustomProduct && product.stock <= 0) {
      showToast("⚠️ Este producto no tiene existencias disponibles (Stock 0).", 'error')
      return
    }
    
    if (isCustomProduct) {
      setPendingCustomProduct(product);
      setCustomNotesInput('');
      setCustomPriceInput('');
      setCustomEventDateInput('');
      setShowCustomModal(true);
      return;
    }

    const staffData = JSON.parse(localStorage.getItem('currentStaff') || '{}')
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id && !item.notes)
      if (existing) {
        if (!isCustomProduct && existing.quantity >= product.stock) {
          showToast("No puedes agregar más de las existencias disponibles.", 'error')
          return prevCart
        }
        return prevCart.map(item => item.id === product.id && !item.notes ? { ...item, quantity: item.quantity + 1 } : item)
      } else {
        return [...prevCart, { ...product, quantity: 1, originalPrice: product.price, isSpecial: false, staffId: staffData.id || null, notes: '', eventDate: null, hasStockIssue: false }]
      }
    })
  }

  const handleConfirmCustomProduct = () => {
    if (!customNotesInput.trim()) return showToast("Ingresa las medidas, peso o características.", 'error');
    const customPrice = parseFloat(customPriceInput || '0');
    if (isNaN(customPrice) || customPrice <= 0) return showToast("Ingresa un precio de venta válido.", 'error');

    const staffData = JSON.parse(localStorage.getItem('currentStaff') || '{}');
    setCart(prevCart => [
      ...prevCart,
      {
        ...pendingCustomProduct,
        id: pendingCustomProduct.id,
        name: pendingCustomProduct.name,
        notes: customNotesInput.trim(),
        eventDate: customEventDateInput || null,
        price: customPrice,
        originalPrice: customPrice,
        quantity: 1,
        stock: 9999,
        isSpecial: false,
        staffId: staffData.id || null,
        hasStockIssue: false
      }
    ]);

    setShowCustomModal(false);
    setPendingCustomProduct(null);
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

    const isCustomProduct = Boolean(
      productInStock?.is_custom || 
      productInStock?.price === 0 || 
      (productInStock?.name && (
        productInStock.name.toLowerCase().includes('vinil') || 
        productInStock.name.toLowerCase().includes('personaliz') ||
        productInStock.name.toLowerCase().includes('manta') ||
        productInStock.name.toLowerCase().includes('evento personalizado') ||
        productInStock.name.toLowerCase().includes('arreglo pequeño')
      ))
    );

    if (!isCustomProduct && newQty > maxStock) {
      showToast(`⚠️ Stock máximo disponible: ${maxStock}`, 'error');
      setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: maxStock } : item));
      return;
    }

    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQty <= 0 ? 1 : newQty } : item));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.id !== productId))

  const handleAddOrRestockProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedExistingProduct === 'NEW') {
      if (!newName.trim() || !selectedBranch) return showToast("Completa el nombre del producto.", 'error')
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
          p_name: newName.trim(), 
          p_price: 0, 
          p_stock: 9999,
          p_branch_id: selectedBranch, 
          p_image_url: imageUrl, 
          p_category_id: newCategoryId || null
        })
        if (error) showToast("Error: " + error.message, 'error')
        else {
          showToast("¡Producto personalizado creado con éxito!", 'success')
          setNewName(''); setNewCategoryId(''); setImageFile(null); setImagePreview(null); setSelectedExistingProduct('');
          refreshAllData(selectedBranch, businessIdState);
          setActiveTab('ticket')
        }
      } finally { setUploadingImage(false) }
    } else {
      if (!selectedExistingProduct) return showToast("Selecciona un producto.", 'error')
      const { error } = await supabase.rpc('add_stock_to_product', {
        p_branch_id: selectedBranch, p_product_id: selectedExistingProduct, p_quantity: Number(addMoreQuantity)
      })
      if (error) showToast("Error: " + error.message, 'error')
      else {
        showToast("¡Stock actualizado con éxito!", 'success')
        setSelectedExistingProduct(''); setAddMoreQuantity(1);
        refreshAllData(selectedBranch, businessIdState);
        setActiveTab('ticket')
      }
    }
  }

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedQty = Number(transferQuantity)
    if (!transferProduct || parsedQty <= 0 || parsedQty > transferProduct.stock) return showToast("Cantidad inválida o supera el stock.", 'error')
    const { error } = await supabase.from('inventory_transfers').insert({
      business_id: businessIdState, product_id: transferProduct.id || transferProduct.product_id,
      source_branch_id: transferProduct.branch_id, destination_branch_id: selectedBranch, quantity: parsedQty, status: 'pendiente'
    })
    if (error) showToast("Error: " + error.message, 'error')
    else {
      showToast("¡Solicitud enviada con éxito!", 'success')
      setTransferProduct(null); setTransferQuantity(1); loadTransfers(businessIdState, selectedBranch)
    }
  }

  const handleCompleteTransfer = async (transferId: string) => {
    const { error } = await supabase.rpc('complete_transfer', { transfer_id: transferId, current_biz_id: businessIdState })
    if (error) showToast("Error: " + error.message, 'error')
    else { showToast("¡Traslado completado!", 'success'); refreshAllData(selectedBranch, businessIdState); }
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
    <div className={`min-h-screen p-3 sm:p-6 flex flex-col w-full max-w-full overflow-x-hidden notranslate pb-20 lg:pb-4 relative ${themeBg}`} translate="no">
      
      {toast && (
        <div className="fixed top-5 right-5 z-[9999999] animate-bounce">
          <div className={`px-5 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <header className={`p-3 sm:p-4 rounded-xl shadow mb-4 flex flex-col gap-3 border w-full ${panelBg}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3">
            
            <div className="relative" ref={opsDropdownRef}>
              <button
                onClick={() => setShowOpsDropdown(!showOpsDropdown)}
                className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow transition-colors cursor-pointer select-none"
                title="Menú General"
              >
                ≡
              </button>

              {showOpsDropdown && (
                <div className={`absolute left-0 mt-2 w-64 rounded-xl shadow-2xl border z-50 p-3 space-y-3 ${panelBg}`}>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-500 px-2 py-1 uppercase tracking-wider border-b border-opacity-30 mb-1">
                      ⚙️ Opciones Operativas
                    </p>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('tables'); loadTableOrders(businessIdState, selectedBranch); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      🍽️ Control de Mesas y Órdenes
                    </button>
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
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('customOrders'); loadCustomOrders(businessIdState, selectedBranch); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      🎨 Pedidos Personalizados
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/cuentas'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      💰 Cuentas de la Sucursal
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/cotizaciones'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      📄 Crear Cotizaciones / Proformas
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/orders'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      📋 Buscar Cotizaciones
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); setActiveTab('customerLimits'); loadCustomers(businessIdState); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                      🤝 Límite de Crédito Clientes
                    </button>
                    <button onClick={() => { setShowOpsDropdown(false); router.push('/clientes/reportes'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                    👥 Directorio General y Expediente de Clientes
                    </button>
                  </div>

                  {userRole !== 'venta' && userRole !== 'vendedor' && (
                    <div className="border-t border-opacity-30 pt-2">
                      <p className="text-[11px] font-bold text-purple-400 px-2 py-1 uppercase tracking-wider border-b border-opacity-30 mb-1">
                        🛡️ Opciones Administrativas
                      </p>
                      <button onClick={() => { setShowOpsDropdown(false); router.push('/inventario'); }} className="w-full text-left px-3 py-2 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                        📋 Módulo de Inventario
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
                  )}

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

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin w-full sm:w-auto justify-start sm:justify-end">
             {/* SOLO ROL ENCARGADO O DUEÑO PUEDE VER EL BOTÓN DE CAJA */}
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

      <div className="flex lg:hidden grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setMobileViewTab('catalog')} className={`py-2.5 rounded-xl font-bold text-xs shadow ${mobileViewTab === 'catalog' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}>🛍️ Catálogo</button>
        <button onClick={() => setMobileViewTab('cart')} className={`py-2.5 rounded-xl font-bold text-xs shadow relative ${mobileViewTab === 'cart' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}>🛒 Carrito ({cart.reduce((a, c) => a + c.quantity, 0)})</button>
      </div>

      {activeTab !== 'ticket' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className={`p-5 sm:p-6 rounded-2xl border border-emerald-500 w-full max-w-xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-500 uppercase tracking-wide">
                {activeTab === 'tables' && '🍽️ Control de Mesas y Órdenes Activas'}
                {activeTab === 'addProduct' && '➕ Crear Producto Personalizado / Reabastecer'}
                {activeTab === 'otherStores' && '🏬 Inventario en Red (Otras Sucursales)'}
                {activeTab === 'transfers' && '🔄 Módulo de Traslados'}
                {activeTab === 'movements' && '📊 Movimientos y Cuadre Diario'}
                {activeTab === 'salesReport' && '💰 Reporte de Ventas de Hoy'}
                {activeTab === 'customOrders' && '🎨 Pedidos Personalizados (Producción / Bodega)'}
                {activeTab === 'customers' && '👥 Directorio de Clientes'}
                {activeTab === 'customerLimits' && '🤝 Límite de Crédito Clientes'}
              </h3>
              <button onClick={() => setActiveTab('ticket')} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            {activeTab === 'tables' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                  <span className="font-bold text-emerald-400">🍽️ Mesas y Órdenes en Curso</span>
                  <button 
                    onClick={() => loadTableOrders(businessIdState, selectedBranch)}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg font-semibold text-xs"
                  >
                    🔄 Actualizar
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {tablesOrdersList.length === 0 ? (
                    <p className="text-center py-8 opacity-75">No hay órdenes de mesa activas en este momento.</p>
                  ) : (
                    tablesOrdersList.map((order, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border space-y-2 ${subPanelBg}`}>
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-emerald-400 text-sm">📍 {order.table_name}</span>
                          <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px]">Q {order.total_amount}</span>
                        </div>

                        <p className="text-slate-300"><strong>Cliente:</strong> {order.customer?.name || 'Consumidor Final'} (NIT: {order.customer?.nit || 'CF'})</p>
                        <p className="text-slate-400 font-mono text-[11px]">Orden #{order.order_number || order.id.slice(0, 6)}</p>

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              handleSelectTableOrder(order);
                              setActiveTab('ticket');
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition-colors"
                          >
                            ✏️ Modificar
                          </button>
                          <button
                            onClick={() => handleSendTableToCheckout(order)}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition-colors"
                          >
                            💰 Pasar a Caja
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'addProduct' && (
              <form onSubmit={handleAddOrRestockProduct} className="space-y-3 text-sm">
                <div>
                  <label className="block mb-1 opacity-90">Seleccionar Producto o Crear Nuevo</label>
                  <select value={selectedExistingProduct} onChange={e => setSelectedExistingProduct(e.target.value)} className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`}>
                    <option value="">-- Selecciona una opción --</option>
                    <option value="NEW">✨ [+ Crear Nuevo Producto Personalizado]</option>
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
                      <label className="block mb-1 opacity-90">Nombre del Producto Personalizado *</label>
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Arreglo Especial con Rosas" className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`} required />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block opacity-90">Categoría</label>
                        {!isCreatingCategoryInline && (
                          <button type="button" onClick={() => setIsCreatingCategoryInline(true)} className="text-emerald-500 font-bold text-xs hover:underline">+ Crear Nueva</button>
                        )}
                      </div>

                      {!isCreatingCategoryInline ? (
                        <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className={`w-full border p-2.5 rounded-xl text-sm ${inputBg}`}>
                          <option value="">-- Sin Categoría --</option>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                      ) : (
                        <div className={`p-3 rounded-xl border border-emerald-500/60 space-y-2 ${subPanelBg}`}>
                          <p className="text-xs font-bold text-emerald-400">✨ Nueva Categoría Integrada</p>
                          <input 
                            type="text" 
                            value={inlineCategoryName} 
                            onChange={e => setInlineCategoryName(e.target.value)} 
                            placeholder="Nombre de la categoría..." 
                            className={`w-full border p-2 rounded-xl text-xs ${inputBg}`} 
                            autoFocus 
                          />
                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              disabled={savingCategoryInline || !inlineCategoryName.trim()} 
                              onClick={handleCreateCategoryInline} 
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg font-bold text-xs"
                            >
                              {savingCategoryInline ? 'Guardando...' : 'Guardar Categoría'}
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { setIsCreatingCategoryInline(false); setInlineCategoryName(''); }} 
                              className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block mb-1 opacity-70">Precio (Q)</label>
                      <input type="text" value="A cotizar en el ticket" disabled className={`w-full border p-2.5 rounded-xl text-sm opacity-60 cursor-not-allowed ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block mb-1 opacity-70">Stock Inicial</label>
                      <input type="text" value="N/A" disabled className={`w-full border p-2.5 rounded-xl text-sm font-bold text-emerald-500 opacity-85 cursor-not-allowed ${inputBg}`} />
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
                <div className={`p-3 rounded-xl border font-bold text-purple-400 text-base flex justify-between items-center ${subPanelBg}`}>
                  <span>Total Ventas Hoy:</span>
                  <span className="text-emerald-400">Q {salesReport.reduce((a, s) => a + Number(s.total_amount || 0), 0)}</span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {salesReport.length === 0 ? (
                    <p className="text-center py-6 opacity-75">No hay ventas registradas hoy.</p>
                  ) : (
                    salesReport.map(s => (
                      <div 
                        key={s.sale_id} 
                        className={`p-3 rounded-xl border flex justify-between items-center ${subPanelBg}`}
                      >
                        <div>
                          <p className="font-bold text-slate-200">NIT: {s.customer_nit} ({s.customer_name})</p>
                          <p className="text-[10px] text-slate-400">Hora: {new Date(s.created_at).toLocaleTimeString()}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-400 block text-sm">Q {s.total_amount}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'customOrders' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                  <button 
                    onClick={() => setCustomOrdersSubTab('pendientes')}
                    className={`py-2 rounded-lg font-bold transition-all ${
                      customOrdersSubTab === 'pendientes' 
                        ? 'bg-amber-600 text-white shadow' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🟡 Pendientes ({customOrdersList.filter(o => o.status !== 'entregado').length})
                  </button>
                  <button 
                    onClick={() => setCustomOrdersSubTab('entregados')}
                    className={`py-2 rounded-lg font-bold transition-all ${
                      customOrdersSubTab === 'entregados' 
                        ? 'bg-emerald-600 text-white shadow' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🟢 Historial Entregados ({customOrdersList.filter(o => o.status === 'entregado').length})
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {customOrdersList.filter(o => customOrdersSubTab === 'entregados' ? o.status === 'entregado' : o.status !== 'entregado').length === 0 ? (
                    <p className="text-center py-8 opacity-75">
                      {customOrdersSubTab === 'pendientes' ? 'No hay pedidos pendientes por armar o entregar.' : 'No hay historial de pedidos entregados.'}
                    </p>
                  ) : (
                    customOrdersList
                      .filter(o => customOrdersSubTab === 'entregados' ? o.status === 'entregado' : o.status !== 'entregado')
                      .map((order, idx) => (
                        <div key={idx} className={`p-3 rounded-xl border space-y-2 ${subPanelBg}`}>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-emerald-400 text-sm">Orden / Turno #{order.order_number}</span>
                            <div className="flex items-center gap-2">
                              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px]">Q {order.price}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.status === 'entregado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {order.status === 'entregado' ? 'Entregado 🟢' : 'Pendiente 🟡'}
                              </span>
                            </div>
                          </div>

                          <p className="text-slate-300"><strong>Cliente:</strong> {order.customer_name} (NIT: {order.customer_nit})</p>
                          <p className="text-slate-200 font-semibold"><strong>Producto:</strong> {order.product_name} ({order.quantity} unids)</p>
                          
                          <div className="bg-emerald-950/40 border border-emerald-500/40 p-2 rounded-lg text-emerald-300 space-y-1">
                            <p>📝 <strong>Notas:</strong> {order.notes}</p>
                            {order.event_date && (
                              <p className="text-amber-300">📅 <strong>Fecha de Entrega/Evento:</strong> {new Date(order.event_date).toLocaleString()}</p>
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-slate-700">
                            <span className="text-[10px] text-slate-400">Fecha de Creación: {new Date(order.created_at).toLocaleString()}</span>
                            
                            <button
                              onClick={() => handleToggleOrderStatus(order.order_id, order.status)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                order.status === 'entregado' 
                                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                              }`}
                            >
                              {order.status === 'entregado' ? '↩️ Marcar Pendiente' : '✅ Marcar Entregado'}
                            </button>
                          </div>
                        </div>
                      ))
                  )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 w-full">
        
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
                {filteredProducts.map(p => {
                  const isCustomProduct = Boolean(
                    p.is_custom || 
                    p.price === 0 || 
                    (p.name && (
                      p.name.toLowerCase().includes('vinil') || 
                      p.name.toLowerCase().includes('personaliz') ||
                      p.name.toLowerCase().includes('manta') ||
                      p.name.toLowerCase().includes('evento personalizado') ||
                      p.name.toLowerCase().includes('arreglo pequeño')
                    ))
                  );
                  const isOutOfStock = !isCustomProduct && p.stock <= 0;

                  return (
                    <button 
                      key={p.id} 
                      onClick={() => { 
                        if (isOutOfStock) {
                          showToast("⚠️ Este producto no tiene existencias disponibles (Stock 0).", 'error');
                          return;
                        }
                        addToCart(p); 
                        setSearchTerm(''); 
                        setShowSuggestions(false); 
                      }} 
                      className={`w-full text-left px-4 py-3 hover:opacity-75 flex justify-between items-center border-b text-sm ${isOutOfStock ? 'opacity-45 cursor-not-allowed' : ''}`}
                    >
                      <div>
                        <span className="font-semibold">{p.name}</span>
                        <span className={`ml-2 text-xs font-semibold ${isOutOfStock ? 'text-red-400 font-bold' : 'opacity-75'}`}>(Stock: {isCustomProduct ? 'N/A' : p.stock})</span>
                      </div>
                      <span className="text-emerald-500 font-bold">{isCustomProduct ? 'A cotizar' : `Q ${p.price}`}</span>
                    </button>
                  );
                })}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto max-h-[60vh] sm:max-h-[65vh] pr-1 flex-1">
            {filteredProducts.length === 0 ? (
              <p className="col-span-full text-center py-10 text-sm sm:text-base opacity-75">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => {
                const isCustomProduct = Boolean(
                  p.is_custom || 
                  p.price === 0 || 
                  (p.name && (
                    p.name.toLowerCase().includes('vinil') || 
                    p.name.toLowerCase().includes('personaliz') ||
                    p.name.toLowerCase().includes('manta') ||
                    p.name.toLowerCase().includes('evento personalizado') ||
                    p.name.toLowerCase().includes('arreglo pequeño')
                  ))
                );
                const isOutOfStock = !isCustomProduct && p.stock <= 0;

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
                        Stock: <strong className={isOutOfStock ? 'text-red-400' : 'text-emerald-500'}>{isCustomProduct ? 'N/A' : p.stock}</strong> {isOutOfStock ? '(Agotado)' : ''}
                      </span>
                      <h3 className={`font-bold line-clamp-2 text-xs sm:text-sm leading-snug ${isOutOfStock ? 'opacity-75' : 'group-hover:text-emerald-500'}`}>{p.name}</h3>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-opacity-50 flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs uppercase opacity-70">{isCustomProduct ? 'Variable' : 'Precio'}</span>
                      <span className="text-emerald-500 font-extrabold text-sm sm:text-base" translate="no">{isCustomProduct ? 'A cotizar' : `Q ${p.price}`}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-xl shadow border flex flex-col justify-between ${mobileViewTab === 'cart' ? 'flex' : 'hidden'} lg:flex ${panelBg}`}>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-emerald-500 mb-3">Ticket de Venta</h2>
            
            <div className="space-y-2.5 overflow-y-auto max-h-[30vh] sm:max-h-[35vh] pr-1">
              {cart.length === 0 ? (
                <p className="text-center py-10 text-sm sm:text-base opacity-75">El carrito está vacío.</p>
              ) : (
                cart.map((item, index) => (
                  <div key={`${item.id}-${index}`} className={`flex flex-col gap-2 p-3 rounded-xl border text-xs sm:text-sm ${item.hasStockIssue || item.quantity > item.stock ? 'bg-red-950/40 border-red-500' : subPanelBg}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{item.name}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded text-xs">✕</button>
                    </div>

                    {/* Alerta visual en el ticket del POS cuando el stock es insuficiente */}
                    {(item.hasStockIssue || item.quantity > item.stock) && (
                      <p className="text-[10px] text-red-400 font-bold mt-0.5 bg-red-950/80 px-2 py-1 rounded border border-red-800">
                        ⚠️ Stock insuficiente (Disponible: {item.stock})
                      </p>
                    )}

                    {item.notes && (
                      <div className="bg-emerald-950/30 border border-emerald-500/30 p-2 rounded-lg text-[11px] text-emerald-300 space-y-0.5">
                        <p>📝 <strong>Especificación:</strong> {item.notes}</p>
                        {item.eventDate && (
                          <p className="text-amber-300">📅 <strong>Entrega/Evento:</strong> {new Date(item.eventDate).toLocaleString()}</p>
                        )}
                      </div>
                    )}
                    
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

            {/* INPUT DE MESA / ÁREA (OPCIONAL O ACTIVO SI SE ESTÁ EDITANDO UNA MESA) */}
            <div className="space-y-1 bg-[#0f172a]/40 p-2.5 rounded-xl border border-slate-700">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-semibold text-slate-400">
                  {editingTableName ? `📍 Editando Orden de: ${editingTableName}` : '🍽️ Mesa / Área (Opcional):'}
                </label>
                {editingTableOrderId && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingTableOrderId(null);
                      setEditingTableName(null);
                      setInputTableName('');
                      setCart([]);
                      showToast("Edición de mesa cancelada", 'info');
                    }}
                    className="text-[10px] text-red-400 hover:underline font-bold"
                  >
                    [Cancelar Edición]
                  </button>
                )}
              </div>
              <input 
                type="text"
                value={inputTableName}
                onChange={e => setInputTableName(e.target.value)}
                placeholder="Ej. Mesa 3, Barra 2..."
                className={`w-full border p-2 rounded-lg text-xs ${inputBg}`}
              />
            </div>

            <div className="flex justify-between items-center mb-1 text-lg sm:text-xl font-bold">
              <span>Total:</span>
              <span className="text-emerald-500 text-xl sm:text-2xl" translate="no">Q {totalCart}</span>
            </div>

            <button onClick={handleSavePendingOrder} disabled={cart.length === 0 || isSubmittingOrder} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow text-sm flex items-center justify-center gap-2">
              {isSubmittingOrder ? 'Guardando...' : paymentMethod === 'Crédito' ? '📋 Registrar Venta al Crédito' : editingTableOrderId ? `💾 Actualizar Orden (${editingTableName})` : '📝 Guardar Orden (Pasar a Caja)'}
            </button>
          </div>
        </div>

      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR ESTILO MÓVIL (VISIBLE SOLO EN TELÉFONOS Y TABLETS) */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 border-t px-2 py-2 flex justify-around items-center z-50 shadow-2xl ${panelBg}`}>
        <button onClick={() => { setActiveTab('ticket'); setMobileViewTab('catalog'); }} className="flex flex-col items-center text-xs text-slate-400 hover:text-emerald-400">
          <span className="text-lg">🛍️</span>
          <span className="text-[10px] mt-0.5 font-semibold">POS</span>
        </button>
        
        <button onClick={() => { setActiveTab('tables'); loadTableOrders(businessIdState, selectedBranch); }} className="flex flex-col items-center text-xs text-slate-400 hover:text-emerald-400">
          <span className="text-lg">🍽️</span>
          <span className="text-[10px] mt-0.5 font-semibold">Mesas</span>
        </button>

        {/* SOLO ROL ENCARGADO O DUEÑO VE CAJA EN LA BARRA MÓVIL */}
        {(userRole === 'encargado' || !isStaff) && (
          <button onClick={() => router.push('/cajero')} className="flex flex-col items-center text-xs text-slate-400 hover:text-emerald-400">
            <span className="text-lg">💵</span>
            <span className="text-[10px] mt-0.5 font-semibold">Caja</span>
          </button>
        )}

        <button onClick={() => { setActiveTab('salesReport'); loadSalesReport(businessIdState, selectedBranch); }} className="flex flex-col items-center text-xs text-slate-400 hover:text-emerald-400">
          <span className="text-lg">📊</span>
          <span className="text-[10px] mt-0.5 font-semibold">Reportes</span>
        </button>

        <button onClick={() => setShowOpsDropdown(true)} className="flex flex-col items-center text-xs text-slate-400 hover:text-emerald-400">
          <span className="text-lg">≡</span>
          <span className="text-[10px] mt-0.5 font-semibold">Menú</span>
        </button>
      </nav>

      {showCustomModal && pendingCustomProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 999999 }}>
          <div className={`p-6 rounded-2xl border border-emerald-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-500">✨ Especificaciones de Producción</h3>
              <button onClick={() => setShowCustomModal(false)} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            <div>
              <p className="font-bold text-sm">{pendingCustomProduct.name}</p>
              <p className="text-xs opacity-75 mt-1">Ingresa las medidas, diseño, colores o notas para que bodega pueda despacharlo correctamente:</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-90">Notas / Medidas / Características *</label>
                <textarea 
                  value={customNotesInput}
                  onChange={e => setCustomNotesInput(e.target.value)}
                  placeholder="Ej. Manta 2x1.5m con acabado brillante y ojales..."
                  rows={3}
                  className={`w-full border p-2.5 rounded-xl text-sm outline-none resize-none ${inputBg}`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-90">Fecha y Hora de Entrega / Evento</label>
                <input 
                  type="datetime-local"
                  value={customEventDateInput}
                  onChange={e => setCustomEventDateInput(e.target.value)}
                  className={`w-full border p-2.5 rounded-xl text-sm outline-none ${inputBg}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-90">Precio de Venta Cotizado (Q) *</label>
                <input 
                  type="number"
                  step="0.01"
                  value={customPriceInput}
                  onChange={e => setCustomPriceInput(e.target.value)}
                  placeholder="0.00"
                  className={`w-full border p-2.5 rounded-xl text-sm outline-none ${inputBg}`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleConfirmCustomProduct}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-sm shadow"
              >
                Agregar al Carrito
              </button>
              <button 
                onClick={() => setShowCustomModal(false)}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  )
}