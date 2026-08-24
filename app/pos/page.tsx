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
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  
  // Estado para el menú desplegable flotante de Opciones Operativas (activado con el botón verde ≡)
  const [showOpsDropdown, setShowOpsDropdown] = useState(false)
  const opsDropdownRef = useRef<HTMLDivElement>(null)

  const router = useRouter()

  // Estado para la vista móvil en teléfonos (alternar entre catálogo y ticket)
  const [mobileViewTab, setMobileViewTab] = useState<'catalog' | 'cart'>('catalog')

  // Estado para prevenir doble clic al guardar orden
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)

  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Estado para habilitar o deshabilitar la impresión térmica de tickets (por defecto desactivado)
  const [enableTicketPrinting, setEnableTicketPrinting] = useState<boolean>(false)

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
  const [activeTab, setActiveTab] = useState<'ticket' | 'addProduct' | 'otherStores' | 'transfers' | 'movements' | 'salesReport' | 'customers'>('ticket')
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
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false)

  // Estados inteligentes para la pestaña Agregar / Reabastecer
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<string>('')
  const [addMoreQuantity, setAddMoreQuantity] = useState<number>(1)

  // Formulario rápido para nuevo producto (con imagen, categoría y compresión)
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

  async function loadCustomers(businessId: string) {
    const { data, error } = await supabase.rpc('get_business_customers', { p_business_id: businessId })
    if (!error && data) setCustomersList(data)
  }

  async function handleViewSaleDetails(saleId: string) {
    setLoadingSaleDetails(true)
    const { data, error } = await supabase.rpc('get_sale_details', { p_sale_id: saleId })
    setLoadingSaleDetails(false)
    if (!error && data) setSelectedSaleDetails(data)
  }

  const totalCart = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)

  // Función para imprimir ticket de Detalle de Orden
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

    setIsSubmittingOrder(true)
    const cartJson = cart.map(item => ({
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
      p_items: cartJson
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
  
  const handleBranchChange = (branchId: string) => {
    if (isStaff) return
    setSelectedBranch(branchId)
    refreshAllData(branchId, businessIdState)
    setCart([])
  }

  const addToCart = (product: any) => {
    // Validar si el stock es 0 o menor (excepto artículos personalizados/variables)
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
    <div className={`min-h-screen p-4 md:p-6 flex flex-col w-full px-6 notranslate ${themeBg}`} translate="no">
      
      {/* HEADER SUPERIOR CON EL BOTÓN VERDE ≡ DE OPCIONES OPERATIVAS */}
      <header className={`p-4 rounded-lg shadow mb-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 border w-full ${panelBg}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          
          {/* BOTÓN VERDE CON ÍCONO HAMBURGUESA ≡ PARA OPCIONES OPERATIVAS */}
          <div className="relative" ref={opsDropdownRef}>
            <button
              onClick={() => setShowOpsDropdown(!showOpsDropdown)}
              className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow transition-colors cursor-pointer select-none"
              title="Opciones Operativas"
            >
              ≡
            </button>

            {/* MENÚ DESPLEGABLE FLOTANTE DE OPCIONES OPERATIVAS */}
            {showOpsDropdown && (
              <div className={`absolute left-0 mt-2 w-56 rounded-xl shadow-2xl border z-50 p-2 space-y-1 ${panelBg}`}>
                <p className="text-[11px] font-bold text-emerald-500 px-3 py-1 uppercase tracking-wider border-b border-opacity-30">Opciones Operativas</p>
                
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
              </div>
            )}
          </div>

          {businessLogo ? (
            <img src={businessLogo} alt="Logo" className={`w-24 h-24 object-contain rounded-lg p-1 border shadow ${isDarkMode ? 'bg-[#0f172a] border-slate-600' : 'bg-white border-slate-300'}`} />
          ) : (
            <div className={`w-14 h-14 rounded-lg flex items-center justify-center text-[10px] border ${isDarkMode ? 'bg-[#0f172a] border-slate-600 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>POS</div>
          )}

          <div>
            <h1 className="text-xl font-bold">Punto de Venta</h1>
            <select 
              value={selectedBranch} 
              onChange={e => handleBranchChange(e.target.value)}
              disabled={isStaff}
              className={`border px-3 py-1.5 rounded outline-none focus:border-emerald-500 font-semibold text-xs disabled:opacity-75 disabled:cursor-not-allowed mt-1 ${inputBg}`}
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
          
        <div className="flex items-center gap-2 justify-end flex-wrap relative">
           {(userRole === 'encargado' || !isStaff) && (
             <>
               <button onClick={() => router.push('/cajero')} className="bg-sky-600 hover:bg-sky-500 px-3 py-2 rounded font-semibold text-xs transition-colors shadow flex items-center gap-1.5 text-white">💵 Caja</button>
               <button onClick={() => router.push('/inventario')} className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded font-semibold text-xs transition-colors shadow flex items-center gap-1.5 text-white">📋 Inventario</button>
             </>
           )}

           <button onClick={() => router.push('/cotizaciones')} className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded font-semibold text-xs transition-colors shadow flex items-center gap-1.5 text-white">📄 Cotizaciones</button>

           <button onClick={toggleTicketPrinting} className={`px-3 py-2 rounded font-semibold text-xs transition-colors border flex items-center gap-1.5 ${enableTicketPrinting ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
             🖨️ Ticket: {enableTicketPrinting ? 'ON' : 'OFF'}
           </button>

           <button onClick={toggleTheme} className={`px-3 py-2 rounded font-semibold text-xs transition-colors border ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}>
             {isDarkMode ? '☀️ Claro' : '🌙 Oscuro'}
           </button>

           <button onClick={() => setShowLowStockModal(true)} className={`relative px-3 py-2 rounded font-semibold text-xs transition-colors flex items-center gap-1.5 ${lowStockItems.length > 0 ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300'}`}>
             ⚠️ Stock {lowStockItems.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-md">{lowStockItems.length}</span>}
           </button>

           <div className="relative">
             <button onClick={() => setShowToolsMenu(!showToolsMenu)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded font-semibold text-xs transition-colors flex items-center gap-1 border border-slate-600">🛠️ Herramientas ▾</button>
             {showToolsMenu && (
               <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl border z-50 py-1.5 ${panelBg}`}>
                 <button onClick={() => { setShowToolsMenu(false); router.push('/compras'); }} className="w-full text-left px-4 py-2 hover:bg-emerald-600 hover:text-white text-xs font-semibold">📦 Compras</button>
                 <button onClick={() => { setShowToolsMenu(false); router.push('/clientes/reportes'); }} className="w-full text-left px-4 py-2 hover:bg-emerald-600 hover:text-white text-xs font-semibold">👥 Clientes y Reportes</button>
                 <button onClick={() => { setShowToolsMenu(false); router.push('/ventas-historia'); }} className="w-full text-left px-4 py-2 hover:bg-emerald-600 hover:text-white text-xs font-semibold">📅 Historial / Días</button>
                 <button onClick={() => { setShowToolsMenu(false); router.push('/precios-especiales'); }} className="w-full text-left px-4 py-2 hover:bg-emerald-600 hover:text-white text-xs font-semibold">🛡️ Auditoría de Precios</button>
               </div>
             )}
           </div>

           <button onClick={handleExit} className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded font-semibold text-xs transition-colors text-white">Salir</button>
        </div>
      </header>

      {/* SELECTOR DE VISTA EN TELÉFONO */}
      <div className="flex lg:hidden grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setMobileViewTab('catalog')} className={`py-2.5 rounded-lg font-bold text-xs shadow ${mobileViewTab === 'catalog' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}>🛍️ Catálogo</button>
        <button onClick={() => setMobileViewTab('cart')} className={`py-2.5 rounded-lg font-bold text-xs shadow relative ${mobileViewTab === 'cart' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}>🛒 Ticket ({cart.reduce((a, c) => a + c.quantity, 0)})</button>
      </div>

      {/* MODAL DE OPCIONES OPERATIVAS */}
      {activeTab !== 'ticket' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-2xl border border-emerald-500 w-full max-w-xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-500 uppercase tracking-wide">
                {activeTab === 'addProduct' && '➕ Agregar / Reabastecer Inventario'}
                {activeTab === 'otherStores' && '🏬 Inventario en Red (Otras Sucursales)'}
                {activeTab === 'transfers' && '🔄 Módulo de Traslados'}
                {activeTab === 'movements' && '📊 Movimientos y Cuadre Diario'}
                {activeTab === 'salesReport' && '💰 Reporte de Ventas de Hoy'}
                {activeTab === 'customers' && '👥 Directorio de Clientes'}
              </h3>
              <button onClick={() => setActiveTab('ticket')} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            {activeTab === 'addProduct' && (
              <form onSubmit={handleAddOrRestockProduct} className="space-y-3 text-sm">
                <div>
                  <label className="block mb-1 opacity-90">Seleccionar Producto</label>
                  <select value={selectedExistingProduct} onChange={e => setSelectedExistingProduct(e.target.value)} className={`w-full border p-2.5 rounded text-sm ${inputBg}`}>
                    <option value="">-- Selecciona una opción --</option>
                    <option value="NEW">✨ [+ Crear Nuevo Producto]</option>
                    {products.map(p => <option key={p.id} value={p.id}>📦 {p.name} (Stock actual: {p.stock})</option>)}
                  </select>
                </div>

                {selectedExistingProduct && selectedExistingProduct !== 'NEW' && (
                  <div>
                    <label className="block mb-1 opacity-90">Cantidad a Agregar (Ingreso)</label>
                    <input type="number" min="1" value={addMoreQuantity} onChange={e => setAddMoreQuantity(Number(e.target.value))} className={`w-full border p-2.5 rounded text-sm ${inputBg}`} required />
                  </div>
                )}

                {selectedExistingProduct === 'NEW' && (
                  <div className="space-y-3 border-t pt-3 mt-2 border-opacity-50">
                    <div>
                      <label className="block mb-1 opacity-90">Nombre del Nuevo Producto</label>
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Plato Extra" className={`w-full border p-2.5 rounded text-sm ${inputBg}`} required />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block opacity-90">Categoría</label>
                        <button type="button" onClick={() => setShowNewCategoryModal(true)} className="text-emerald-500 font-bold text-xs">+ Crear Nueva</button>
                      </div>
                      <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className={`w-full border p-2.5 rounded text-sm ${inputBg}`}>
                        <option value="">-- Sin Categoría --</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 opacity-90">Precio (Q)</label>
                      <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.00" className={`w-full border p-2.5 rounded text-sm ${inputBg}`} required />
                    </div>
                    <div>
                      <label className="block mb-1 opacity-90">Stock Inicial</label>
                      <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} placeholder="0" className={`w-full border p-2.5 rounded text-sm ${inputBg}`} />
                    </div>
                    <div>
                      <label className="block mb-1 opacity-90">Imagen del Producto</label>
                      <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){setImageFile(f); setImagePreview(URL.createObjectURL(f));} }} className={`w-full border p-2 rounded text-xs ${inputBg}`} />
                      {imagePreview && <img src={imagePreview} className="mt-2 w-full h-24 rounded object-cover border" alt="preview" />}
                    </div>
                  </div>
                )}

                {selectedExistingProduct && (
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={uploadingImage} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded font-bold text-white text-sm">
                      {uploadingImage ? 'Guardando...' : 'Guardar y Registrar'}
                    </button>
                    <button type="button" onClick={() => setSelectedExistingProduct('')} className="bg-slate-600 px-3 py-2.5 rounded text-white text-sm">Cancelar</button>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'otherStores' && (
              <div className="space-y-3 text-sm">
                <input type="text" value={otherStoresSearch} onChange={e => setOtherStoresSearch(e.target.value)} placeholder="🔍 Buscar en otras sucursales..." className={`w-full border p-2.5 rounded text-sm ${inputBg}`} />
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredOtherStores.map((p, idx) => (
                    <div key={idx} className={`p-3 rounded border flex justify-between items-center ${subPanelBg}`}>
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-amber-500 font-medium">Sucursal: {p.branch_name}</p>
                        <p className="text-xs opacity-75">Stock: <span className="text-emerald-500 font-bold">{p.stock}</span></p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-emerald-500 text-sm">Q {p.price}</span>
                        <button onClick={() => { setTransferProduct(p); setActiveTab('transfers'); }} className="bg-blue-600 text-xs px-2.5 py-1 rounded text-white font-semibold">Solicitar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className="space-y-3 text-sm">
                {transferProduct && (
                  <form onSubmit={handleRequestTransfer} className={`p-3 rounded border border-emerald-500/50 space-y-2 ${subPanelBg}`}>
                    <p className="font-bold text-sm">Solicitar: {transferProduct.name}</p>
                    <input type="number" min="1" value={transferQuantity} onChange={e => setTransferQuantity(Number(e.target.value))} className={`w-full border p-2 rounded text-sm ${inputBg}`} required />
                    <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded font-bold text-sm">Enviar Solicitud</button>
                  </form>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {transfersList.map(t => (
                    <div key={t.transfer_id} className={`p-3 rounded border text-xs space-y-1 ${subPanelBg}`}>
                      <div className="flex justify-between font-bold"><span className="text-emerald-500">{t.product_name}</span><span>{t.status}</span></div>
                      <p>De: {t.source_branch_name} → Para: {t.destination_branch_name} ({t.quantity} unids)</p>
                      {t.status === 'pendiente' && t.source_branch_id === selectedBranch && (
                        <button onClick={() => handleCompleteTransfer(t.transfer_id)} className="w-full bg-blue-600 text-white py-1 rounded font-semibold mt-1">Aceptar y Enviar</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'movements' && (
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {branchMovements.map(m => (
                  <div key={m.id} className={`p-2.5 rounded border flex justify-between ${subPanelBg}`}>
                    <span>{m.product?.name} ({m.movement_type})</span>
                    <span className={m.quantity < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{m.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'salesReport' && (
              <div className="space-y-3 text-xs">
                <div className={`p-3 rounded border font-bold text-emerald-500 text-base ${subPanelBg}`}>
                  Total Ventas Hoy: Q {salesReport.reduce((a, s) => a + Number(s.total_amount || 0), 0)}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {salesReport.map(s => (
                    <div key={s.sale_id} onClick={() => handleViewSaleDetails(s.sale_id)} className={`p-2.5 rounded border cursor-pointer flex justify-between ${subPanelBg}`}>
                      <span>NIT: {s.customer_nit} ({s.customer_name})</span>
                      <span className="font-bold text-emerald-400">Q {s.total_amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
                {customersList.map(c => (
                  <div key={c.customer_id} className={`p-2.5 rounded border flex justify-between ${subPanelBg}`}>
                    <span>{c.name} (NIT: {c.nit})</span>
                    <span className="text-emerald-400 font-bold">{c.total_purchases} compras</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setActiveTab('ticket')} className="w-full bg-slate-600 hover:bg-slate-500 text-white py-2.5 rounded-xl font-bold text-sm">
              Cerrar Panel
            </button>
          </div>
        </div>
      )}

      {/* DISEÑO PRINCIPAL DE DOS COLUMNAS AMPLIADAS (CATÁLOGO Y TICKET) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 w-full">
        
        {/* PANEL CENTRAL: CATÁLOGO DE PRODUCTOS (Ocupa 2 columnas en desktop) */}
        <div className={`lg:col-span-2 p-5 rounded-lg shadow border flex flex-col ${mobileViewTab === 'catalog' ? 'flex' : 'hidden'} lg:flex ${panelBg}`}>
          <div className="mb-4 relative" ref={searchRef}>
            <input 
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="🔍 Buscar producto por nombre..."
              className={`w-full border px-4 py-2.5 rounded-lg text-sm outline-none focus:border-emerald-500 border ${inputBg}`}
            />

            {showSuggestions && searchTerm.trim() !== '' && (
              <div className={`absolute left-0 right-0 mt-1 rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto border ${subPanelBg}`}>
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

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
            <button onClick={() => setSelectedCategory(null)} className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${selectedCategory === null ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`}`}>✨ Todos</button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${selectedCategory === cat.id ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`}`}>
                {cat.name}
              </button>
            ))}
          </div>

          {/* TARJETAS DE PRODUCTOS CON VALIDACIÓN Y ESTILO VISUAL DE STOCK 0 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh] pr-1 flex-1">
            {filteredProducts.length === 0 ? (
              <p className="col-span-full text-center py-10 text-base opacity-75">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => {
                const isOutOfStock = p.stock <= 0;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)} 
                    className={`border p-3.5 rounded-lg flex flex-col justify-between text-left shadow h-full select-none ${subPanelBg} ${
                      isOutOfStock 
                        ? 'opacity-45 cursor-not-allowed border-red-500/40' 
                        : 'hover:border-emerald-500 active:scale-95 active:border-emerald-400 cursor-pointer group'
                    }`}
                  >
                    <div className="flex flex-col">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover rounded mb-2.5 border" />
                      ) : (
                        <div className="w-full h-28 rounded mb-2.5 flex items-center justify-center text-xs opacity-50 border">Sin imagen</div>
                      )}
                      <span className={`text-xs sm:text-sm block mb-1 ${isOutOfStock ? 'text-red-400 font-bold' : 'font-semibold opacity-80'}`}>
                        Stock: <strong className={isOutOfStock ? 'text-red-400' : 'text-emerald-500'}>{p.is_custom ? 'N/A' : p.stock}</strong> {isOutOfStock ? '(Agotado)' : ''}
                      </span>
                      <h3 className={`font-bold line-clamp-2 text-sm sm:text-base leading-snug ${isOutOfStock ? 'opacity-75' : 'group-hover:text-emerald-500'}`}>{p.name}</h3>
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-opacity-50 flex items-center justify-between">
                      <span className="text-xs uppercase opacity-70">{p.is_custom ? 'Variable' : 'Precio'}</span>
                      <span className="text-emerald-500 font-extrabold text-base sm:text-lg" translate="no">{p.is_custom ? 'A cotizar' : `Q ${p.price}`}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL DERECHO: TICKET / DETALLE DE ORDEN */}
        <div className={`p-5 rounded-lg shadow border flex flex-col justify-between ${mobileViewTab === 'cart' ? 'flex' : 'hidden'} lg:flex ${panelBg}`}>
          <div>
            <h2 className="text-lg font-bold text-emerald-500 mb-4">Ticket de Venta</h2>
            <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1">
              {cart.length === 0 ? (
                <p className="text-center py-10 text-base opacity-75">El carrito está vacío.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className={`flex flex-col gap-2.5 p-3.5 rounded-lg border text-sm ${subPanelBg}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base">{item.name}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded text-sm">✕</button>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium opacity-80">Precio Q:</span>
                        <input type="number" step="0.01" value={item.price} onChange={(e) => handlePriceChange(item.id, e.target.value)} className={`w-20 border rounded px-2 py-1 text-emerald-500 font-bold text-sm outline-none ${inputBg}`} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium opacity-80">Cant:</span>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityChange(item.id, e.target.value)} className={`w-16 border rounded px-2 py-1 font-bold text-sm text-center ${inputBg}`} />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1.5 border-t border-opacity-50">
                      <span className="text-xs opacity-80">Subtotal:</span>
                      <span className="font-extrabold text-emerald-500 text-base" translate="no">Q {item.price * item.quantity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-opacity-50 pt-4 mt-4 space-y-2">
            <div className="flex justify-between items-center mb-2 text-xl font-bold">
              <span>Total:</span>
              <span className="text-emerald-500 text-2xl" translate="no">Q {totalCart}</span>
            </div>

            <button onClick={handleSavePendingOrder} disabled={cart.length === 0 || isSubmittingOrder} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-bold shadow text-sm flex items-center justify-center gap-2">
              {isSubmittingOrder ? 'Guardando Orden...' : '📝 Guardar Orden (Pasar a Caja)'}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL DE STOCK BAJO */}
      {showLowStockModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-xl border border-amber-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <h3 className="text-base font-bold text-amber-500">⚠️ Productos con Stock Bajo (≤ 5)</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto text-sm">
              {lowStockItems.map(p => (
                <div key={p.id} className={`p-3 rounded border flex justify-between ${subPanelBg}`}>
                  <span>{p.name}</span>
                  <span className="text-red-400 font-bold">Stock: {p.stock}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowLowStockModal(false)} className="w-full bg-slate-600 text-white py-2.5 rounded-lg font-semibold text-sm">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE VENTA */}
      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-xl border border-emerald-500 w-[420px] shadow-2xl ${panelBg}`}>
            <h3 className="text-base font-bold text-emerald-500 mb-4">📦 Detalle de la Venta</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
              {selectedSaleDetails.map((item, idx) => (
                <div key={idx} className={`p-3 rounded border flex justify-between ${subPanelBg}`}>
                  <span>{item.product_name} ({item.quantity} x Q {item.price})</span>
                  <span className="font-bold text-emerald-400">Q {item.quantity * item.price}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedSaleDetails(null)} className="mt-6 w-full bg-slate-600 text-white py-3 rounded-lg font-semibold text-sm">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CATEGORÍA */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-sm space-y-4 ${panelBg}`}>
            <h3 className="text-base font-bold text-emerald-500">✨ Nueva Categoría</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-sm">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nombre..." className={`w-full border p-2.5 rounded text-sm ${inputBg}`} required autoFocus />
              <div className="flex gap-2">
                <button type="submit" disabled={savingCategory} className="flex-1 bg-emerald-600 text-white py-2.5 rounded font-bold">Guardar</button>
                <button type="button" onClick={() => setShowNewCategoryModal(false)} className="bg-slate-600 text-white px-4 py-2.5 rounded">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}