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
  
  // Estado para el Menú Lateral Deslizante (Hamburguesa ☰)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Estado para ver el carrito flotante en móviles
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  const router = useRouter()

  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
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

  const [businessLogo, setBusinessLogo] = useState<string | null>(null)

  const [customerNit, setCustomerNit] = useState('CF'); 
  const [customerName, setCustomerName] = useState('Consumidor Final');

  const [searchTerm, setSearchTerm] = useState('')
  const [otherStoresSearch, setOtherStoresSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [showLowStockModal, setShowLowStockModal] = useState(false)

  const [activeTab, setActiveTab] = useState<'addProduct' | 'otherStores' | 'transfers' | 'movements' | 'salesReport' | 'customers'>('addProduct')
  const [allStoreProducts, setAllStoreProducts] = useState<any[]>([])

  const [businessIdState, setBusinessIdState] = useState<string>('')
  const [transfersList, setTransfersList] = useState<any[]>([])
  const [transferProduct, setTransferProduct] = useState<any>(null)
  const [transferQuantity, setTransferQuantity] = useState<any>(1)
  const [branchMovements, setBranchMovements] = useState<any[]>([])
  const [salesReport, setSalesReport] = useState<any[]>([])
  const [customersList, setCustomersList] = useState<any[]>([])

  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any[] | null>(null)
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false)

  const [selectedExistingProduct, setSelectedExistingProduct] = useState<string>('')
  const [addMoreQuantity, setAddMoreQuantity] = useState<number>(1)

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newStock, setNewStock] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

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
    } else {
      console.error("Error cargando otras tiendas:", error?.message)
    }
  }

  async function loadTransfers(businessId: string, currentBranchId: string) {
    const { data, error } = await supabase.rpc('get_branch_transfers', {
      p_business_id: businessId,
      p_branch_id: currentBranchId
    });

    if (!error && data) {
      setTransfersList(data);
    } else {
      console.error("Error cargando traslados:", error?.message);
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
    const currentBizId = bId || businessIdState || (() => {
      try {
        const staff = JSON.parse(localStorage.getItem('currentStaff') || '{}');
        if (staff.business_id) return staff.business_id;
        if (staff.busines_id) return staff.busines_id;
        const biz = JSON.parse(localStorage.getItem('currentBusiness') || '{}');
        return biz.id || biz.business_id || biz.busines_id;
      } catch (e) { return null; }
    })();

    const currentBranchId = brId || selectedBranch || (() => {
      try {
        const staff = JSON.parse(localStorage.getItem('currentStaff') || '{}');
        return staff.branch_id;
      } catch (e) { return null; }
    })();

    if (!currentBizId || !currentBranchId) return;

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        payment_method,
        created_at,
        customer:customers(nit, name)
      `)
      .eq('business_id', currentBizId)
      .eq('branch_id', currentBranchId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error al cargar reporte de ventas:", error.message);
      return;
    }

    if (data) {
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
    const { data, error } = await supabase.rpc('get_business_customers', {
      p_business_id: businessId
    })
    if (!error && data) setCustomersList(data)
  }

  async function handleViewSaleDetails(saleId: string) {
    setLoadingSaleDetails(true)
    const { data, error } = await supabase.rpc('get_sale_details', {
      p_sale_id: saleId
    })
    setLoadingSaleDetails(false)
    
    if (error) {
      alert("Error al cargar los detalles: " + error.message)
      return
    }

    if (data) {
      setSelectedSaleDetails(data)
    }
  }

  const totalCart = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0)

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
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: 250px;
              margin: 0 auto;
              padding: 10px;
              color: #000;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .flex { display: flex; justify-content: space-between; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { font-size: 11px; text-align: left; padding: 2px 0; }
            .right { text-align: right; }
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
            <thead>
              <tr>
                <th>Cant / Descripción</th>
                <th class="right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((i: any) => `
                <tr>
                  <td colspan="2" class="bold">${i.quantity} x ${i.name}</td>
                </tr>
                <tr>
                  <td>P/U: Q ${i.price.toFixed(2)}</td>
                  <td class="right">Q ${(i.price * i.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="flex bold" style="font-size: 14px;">
            <span>TOTAL:</span>
            <span>Q ${total.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="font-size: 10px; margin-top: 10px;">
            ¡Pase a caja con este ticket para realizar su pago!<br>
            Gracias por su preferencia
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  async function handleSavePendingOrder() {
    if (isSubmittingOrder) return

    if (!customerNit.trim() || !customerName.trim()) {
      alert("Por favor ingresa el NIT y el Nombre para la orden.")
      return
    }

    if (cart.length === 0) {
      alert("El carrito está vacío.")
      return
    }

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
      const nuevaOrden = data[0];
      const numeroTurno = nuevaOrden.order_number;

      if (enableTicketPrinting) {
        printThermalTicket({
          orderNumber: numeroTurno,
          branchName: branches.find(b => b.id === selectedBranch)?.name || 'Sucursal',
          customerNit: customerNit,
          customerName: customerName,
          items: cart,
          total: totalCart
        });
      } else {
        alert(`✅ ¡Orden guardada con éxito!\n\n🎟️ TURNO / ORDEN #${numeroTurno}\n\nEl cliente ya puede pasar a caja con este número.`);
      }
      
      setCart([]);
      setCustomerNit('CF');
      setCustomerName('Consumidor Final');
      setIsMobileCartOpen(false);
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
    const isCustomByName = product.name && (
      product.name.toLowerCase().includes('vinil') || 
      product.name.toLowerCase().includes('personaliz') ||
      product.name.toLowerCase().includes('manta')
    );
    
    if (isCustomByName) {
      const customDesc = prompt("Ingresa las medidas, peso o características (Ej. Manta 2x1.5m):");
      if (!customDesc) return;

      const customPriceStr = prompt("Ingresa el precio de venta cotizado:");
      const customPrice = parseFloat(customPriceStr || '0');
      
      if (isNaN(customPrice) || customPrice <= 0) {
        alert("Por favor ingresa un precio de venta válido.");
        return;
      }

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

    if (product.stock <= 0) {
      alert("Producto sin existencias.")
      return
    }

    const staffData = JSON.parse(localStorage.getItem('currentStaff') || '{}')

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert("No puedes agregar más de las existencias disponibles.")
          return prevCart
        }
        return prevCart.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      } else {
        return [
          ...prevCart, 
          { 
            ...product, 
            quantity: 1, 
            originalPrice: product.price, 
            isSpecial: false, 
            staffId: staffData.id || null 
          }
        ]
      }
    })
  }

  const handlePriceChange = (productId: string, newPriceText: string) => {
    const newPrice = parseFloat(newPriceText) || 0;
    const staffData = JSON.parse(localStorage.getItem('currentStaff') || '{}');

    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const original = item.originalPrice !== undefined ? item.originalPrice : item.price;
        const isSpecial = newPrice !== original;
        return {
          ...item,
          price: newPrice,
          originalPrice: original,
          isSpecial: isSpecial,
          staffId: staffData.id || null
        };
      }
      return item;
    }));
  };

  const handleQuantityChange = (productId: string, newQtyText: string) => {
    const newQty = parseInt(newQtyText, 10);
    if (isNaN(newQty)) return;

    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const finalQty = newQty <= 0 ? 1 : newQty;
        return { ...item, quantity: finalQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId))
  }

  const handleAddOrRestockProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedExistingProduct === 'NEW') {
      if (!newName.trim() || !newPrice || !selectedBranch) {
        return alert("Completa el nombre y el precio.")
      }

      setUploadingImage(true)
      let imageUrl = null

      try {
        if (imageFile) {
          const compressedBlob = await compressImage(imageFile)
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`
          const filePath = `products/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(filePath, compressedBlob, {
              contentType: 'image/jpeg',
              upsert: false
            })

          if (uploadError) {
            console.error("Error al subir imagen:", uploadError.message)
            alert("Advertencia: No se pudo subir la imagen, pero se intentará guardar el producto.")
          } else {
            const { data: publicUrlData } = supabase.storage
              .from('products')
              .getPublicUrl(filePath)
            imageUrl = publicUrlData.publicUrl
          }
        }

        const { error } = await supabase.rpc('add_product_safe', {
          p_name: newName.trim(),
          p_price: parseFloat(newPrice) || 0,
          p_stock: parseInt(newStock) || 0,
          p_branch_id: selectedBranch,
          p_image_url: imageUrl,
          p_category_id: newCategoryId || null
        })

        if (error) {
          alert("Error al agregar producto: " + error.message)
        } else {
          alert("¡Producto agregado al catálogo con éxito!")
          setNewName('')
          setNewPrice('')
          setNewStock('')
          setNewCategoryId('')
          setImageFile(null)
          setImagePreview(null)
          setSelectedExistingProduct('')
          refreshAllData(selectedBranch, businessIdState);
          setIsDrawerOpen(false)
        }
      } catch (err) {
        console.error("Error en el proceso:", err)
        alert("Ocurrió un error inesperado al procesar el producto.")
      } finally {
        setUploadingImage(false)
      }

    } else {
      if (!selectedExistingProduct) {
        return alert("Selecciona un producto del catálogo o elige 'Crear nuevo'.")
      }

      if (addMoreQuantity <= 0) {
        return alert("Ingresa una cantidad válida a sumar.")
      }

      const { error } = await supabase.rpc('add_stock_to_product', {
        p_branch_id: selectedBranch,
        p_product_id: selectedExistingProduct,
        p_quantity: Number(addMoreQuantity)
      })

      if (error) {
        alert("Error al reabastecer stock: " + error.message)
      } else {
        alert("¡Stock actualizado y movimiento de ingreso registrado con éxito!")
        setSelectedExistingProduct('')
        setAddMoreQuantity(1)
        refreshAllData(selectedBranch, businessIdState);
        setIsDrawerOpen(false)
      }
    }
  }

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedQty = Number(transferQuantity)
    
    if (!transferProduct || parsedQty <= 0) {
      alert("Selecciona un producto y una cantidad válida.")
      return
    }

    if (parsedQty > transferProduct.stock) {
      alert("La cantidad solicitada supera el stock disponible en la tienda origen.")
      return
    }

    const targetProductId = transferProduct.id || transferProduct.product_id;
    const sourceBranchId = transferProduct.branch_id;

    if (!targetProductId || !sourceBranchId) {
      alert("Error: No se pudo identificar el producto o la sucursal de origen.")
      return
    }

    const { error } = await supabase.from('inventory_transfers').insert({
      business_id: businessIdState,
      product_id: targetProductId,
      source_branch_id: sourceBranchId,
      destination_branch_id: selectedBranch,
      quantity: parsedQty,
      status: 'pendiente'
    })

    if (error) {
      alert("Error al crear la solicitud de traslado: " + error.message)
    } else {
      alert("¡Solicitud de traslado enviada con éxito!")
      setTransferProduct(null)
      setTransferQuantity(1)
      loadTransfers(businessIdState, selectedBranch)
    }
  }

  const handleCompleteTransfer = async (transferId: string) => {
    const { error } = await supabase.rpc('complete_transfer', {
      transfer_id: transferId,
      current_biz_id: businessIdState
    })

    if (error) {
      alert("Error al procesar el traslado: " + error.message)
    } else {
      alert("¡Traslado completado con éxito! Inventarios actualizados.")
      refreshAllData(selectedBranch, businessIdState);
    }
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
          const MAX_WIDTH = 800
          const MAX_HEIGHT = 800
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Falló la compresión de la imagen'))
            }
          }, 'image/jpeg', 0.7)
        }
        img.onerror = (error) => reject(error)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleExit = () => {
    if (isStaff) {
      localStorage.removeItem('currentStaff')
      router.push('/')
    } else {
      router.push('/dashboard')
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true
    return matchesSearch && matchesCategory
  })

  const filteredOtherStores = allStoreProducts.filter(p => {
    if (!p) return false;
    const productName = p.name || '';
    const isNotCurrentBranch = p.branch_id !== selectedBranch;
    const matchesSearch = productName.toLowerCase().includes(otherStoresSearch.toLowerCase());
    const matchesCategory = selectedOtherStoreCategory ? p.category_id === selectedOtherStoreCategory : true;
    
    return isNotCurrentBranch && matchesSearch && matchesCategory;
  })

  const lowStockItems = products.filter(p => p.stock <= 5 && !p.is_custom)

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-2 md:p-4 flex flex-col w-full notranslate pb-20 lg:pb-4 ${themeBg}`} translate="no">
      
      {/* BARRA SUPERIOR ADAPTABLE (Responsive Flex-wrap para móviles) */}
      <header className={`p-3 rounded-lg shadow mb-3 flex flex-wrap justify-between items-center gap-2 border w-full ${panelBg}`}>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center shadow transition-colors"
            title="Menú"
          >
            ☰
          </button>

          {businessLogo ? (
            <img src={businessLogo} alt="Logo" className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-xl border p-0.5 shadow-sm" />
          ) : (
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">POS</div>
          )}

          <div>
            <h1 className="text-xs md:text-sm font-bold leading-tight">Punto de Venta</h1>
            <select 
              value={selectedBranch} 
              onChange={e => handleBranchChange(e.target.value)}
              disabled={isStaff}
              className={`border px-2 py-0.5 rounded-md outline-none font-semibold text-xs mt-1 ${inputBg}`}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
          
        <div className="flex items-center gap-1.5 flex-wrap">
           {(userRole === 'encargado' || !isStaff) && (
             <>
               <button onClick={() => router.push('/cajero')} className="bg-sky-600 hover:bg-sky-500 px-2 py-1.5 rounded font-semibold text-xs text-white shadow">💵 Caja</button>
               <button onClick={() => router.push('/inventario')} className="bg-emerald-700 hover:bg-emerald-600 px-2 py-1.5 rounded font-semibold text-xs text-white shadow">📋 Inventario</button>
             </>
           )}

           <button onClick={toggleTicketPrinting} className={`px-2 py-1.5 rounded text-xs font-semibold border ${enableTicketPrinting ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
             🖨️ {enableTicketPrinting ? 'ON' : 'OFF'}
           </button>

           <button onClick={toggleTheme} className={`px-2 py-1.5 rounded text-xs font-semibold border ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}>
             {isDarkMode ? '☀️' : '🌙'}
           </button>

           <button onClick={() => setShowLowStockModal(true)} className={`relative px-2 py-1.5 rounded text-xs font-semibold ${lowStockItems.length > 0 ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300'}`}>
             ⚠️ {lowStockItems.length > 0 && `(${lowStockItems.length})`}
           </button>

           <button onClick={handleExit} className="bg-red-700 hover:bg-red-600 px-2.5 py-1.5 rounded text-xs font-semibold text-white">
             {isStaff ? 'Salir' : 'Volver'}
           </button>
        </div>
      </header>

      {/* DISEÑO PRINCIPAL: CATÁLOGO IZQUIERDA, TICKET DERECHA (EN PC). EN MÓVIL SOLO CATÁLOGO + BOTÓN FLOTANTE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 w-full">
        
        {/* COLUMNA IZQUIERDA: BUSCADOR Y CATÁLOGO DE PRODUCTOS (Ocupa 12 cols en móvil, 8 en PC) */}
        <div className={`p-3 md:p-4 rounded-lg shadow border flex flex-col lg:col-span-8 order-2 lg:order-1 ${panelBg}`}>
          <div className="mb-3 relative" ref={searchRef}>
            <input 
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="🔍 Search for item..."
              className={`w-full px-4 py-2.5 rounded-lg text-sm outline-none focus:border-emerald-500 transition-colors border ${inputBg}`}
            />

            {showSuggestions && searchTerm.trim() !== '' && (
              <div className={`absolute left-0 right-0 mt-1 rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto border ${subPanelBg}`}>
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-sm opacity-75 text-center">No se encontraron productos</div>
                ) : (
                  filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addToCart(p)
                        setSearchTerm('')
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:opacity-75 flex justify-between items-center border-b border-opacity-50 transition-colors text-sm"
                    >
                      <div>
                        <span className="font-semibold text-base">{p.name}</span>
                        <span className="ml-2 text-xs font-semibold opacity-75">(Stock: {p.stock})</span>
                      </div>
                      <span className="text-emerald-500 font-bold text-base" translate="no">Q {p.price}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === null ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`
              }`}
            >
              ✨ Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto max-h-[65vh] lg:max-h-[60vh] pr-1 flex-1">
            {filteredProducts.length === 0 ? (
              <p className="col-span-full text-center py-16 text-sm opacity-75">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`border p-3 rounded-lg flex flex-col justify-between text-left transition-all duration-150 shadow group cursor-pointer h-full select-none ${subPanelBg} hover:border-emerald-500`}
                >
                  <div className="flex flex-col">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover rounded mb-2 border border-opacity-50 pointer-events-none" />
                    ) : (
                      <div className="w-full h-24 rounded mb-2 flex items-center justify-center text-xs opacity-50 border border-opacity-50">Sin imagen</div>
                    )}
                    <span className="text-[11px] block mb-0.5 font-semibold opacity-80">
                      Stock: <span className="text-emerald-500 font-bold">{p.is_custom ? 'N/A' : p.stock}</span>
                    </span>
                    <h3 className="font-bold group-hover:text-emerald-500 transition-colors line-clamp-2 text-xs leading-snug">{p.name}</h3>
                  </div>
                  
                  <div className="mt-2 pt-1.5 border-t border-opacity-50 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-medium opacity-70">Precio</span>
                    <span className="text-emerald-500 font-extrabold text-sm" translate="no">
                      {p.is_custom ? 'A cotizar' : `Q ${p.price}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: TICKET DE VENTA (Visible normal en PC [lg+], oculto en móviles para no estorbar) */}
        <div className={`hidden lg:flex p-4 rounded-lg shadow border flex-col justify-between lg:col-span-4 order-1 lg:order-2 ${panelBg}`}>
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-emerald-500">Ticket de Venta</h2>
              <span className="text-xs opacity-75 font-medium">Walk-In</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[52vh] pr-1">
              {cart.length === 0 ? (
                <p className="text-center py-16 text-sm opacity-75">El carrito está vacío.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className={`flex flex-col gap-2 p-3 rounded-lg border text-xs ${subPanelBg}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm">{item.name}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 font-bold px-1.5 py-0.5 text-sm">✕</button>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="opacity-80">Q:</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.price} 
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          className={`w-20 border rounded px-1.5 py-1 text-emerald-500 font-bold outline-none focus:border-emerald-500 ${inputBg}`} 
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="opacity-80">Cant:</span>
                        <input 
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className={`w-14 border rounded px-1 py-1 font-bold outline-none focus:border-emerald-500 text-center ${inputBg}`}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-opacity-50 font-semibold">
                      <span>Subtotal:</span>
                      <span className="text-emerald-500 text-sm" translate="no">Q {item.price * item.quantity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-opacity-50 pt-3 mt-3 space-y-3">
            <div className="flex justify-between items-center text-sm opacity-90">
              <span>Subtotal:</span>
              <span className="font-bold" translate="no">Q {totalCart}</span>
            </div>

            <button 
              onClick={handleSavePendingOrder}
              disabled={cart.length === 0 || isSubmittingOrder}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-lg font-bold shadow transition-colors text-xs flex items-center justify-center gap-1"
            >
              {isSubmittingOrder ? 'Generando...' : `Generar Orden - Pasar a Caja (Q ${totalCart})`}
            </button>
          </div>
        </div>

      </div>

      {/* BARRA FLOTANTE INFERIOR PARA MÓVILES (Permite ver el total y abrir el ticket o cobrar al instante) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-slate-900 border-t border-slate-700 flex justify-between items-center shadow-2xl z-40">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow"
          >
            🛒 Ver Carrito ({totalItemsCount})
          </button>
          <span className="text-xs text-slate-300 font-semibold" translate="no">Q {totalCart}</span>
        </div>
        <div>
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            disabled={cart.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-xs shadow"
          >
            Generar Orden
          </button>
        </div>
      </div>

      {/* MODAL / PANEL DESPLEGABLE DEL CARRITO EN MÓVIL */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/80 flex items-end z-50 animate-fadeIn" onClick={() => setIsMobileCartOpen(false)}>
          <div 
            className={`w-full max-h-[85vh] rounded-t-2xl p-4 md:p-5 flex flex-col justify-between shadow-2xl border-t ${panelBg}`}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-opacity-50">
                <h2 className="text-base font-bold text-emerald-500">🛒 Ticket de Venta</h2>
                <button onClick={() => setIsMobileCartOpen(false)} className="text-lg font-bold opacity-75">✕</button>
              </div>

              <div className="space-y-2.5 overflow-y-auto max-h-[48vh] pr-1">
                {cart.length === 0 ? (
                  <p className="text-center py-10 text-sm opacity-75">El carrito está vacío.</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className={`flex flex-col gap-2 p-3 rounded-lg border text-xs ${subPanelBg}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">{item.name}</span>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 font-bold px-1.5 py-0.5 text-sm">✕</button>
                      </div>
                      
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="opacity-80">Q:</span>
                          <input 
                            type="number" 
                            step="0.01"
                            value={item.price} 
                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            className={`w-20 border rounded px-1.5 py-1 text-emerald-500 font-bold outline-none ${inputBg}`} 
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="opacity-80">Cant:</span>
                          <input 
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className={`w-14 border rounded px-1 py-1 font-bold outline-none text-center ${inputBg}`}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-opacity-50 font-semibold">
                        <span>Subtotal:</span>
                        <span className="text-emerald-500 text-sm" translate="no">Q {item.price * item.quantity}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-opacity-50 pt-3 mt-3 space-y-3">
              <div className="flex justify-between items-center text-base font-bold">
                <span>Subtotal:</span>
                <span className="text-emerald-500 text-lg" translate="no">Q {totalCart}</span>
              </div>

              <button 
                onClick={handleSavePendingOrder}
                disabled={cart.length === 0 || isSubmittingOrder}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-lg font-bold shadow text-xs flex items-center justify-center gap-1"
              >
                {isSubmittingOrder ? 'Generando...' : `Generar Orden - Pasar a Caja (Q ${totalCart})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENÚ LATERAL DESLIZANTE MÁS ANCHO Y CÓMODO */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 flex z-[9999]" onClick={() => setIsDrawerOpen(false)}>
          <div 
            className={`w-[380px] md:w-[450px] h-full p-6 flex flex-col shadow-2xl border-r ${panelBg}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-opacity-50">
              <h2 className="text-lg font-bold text-emerald-500">🛠️ Opciones Operativas</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-xl font-bold opacity-75 hover:opacity-100 p-1">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-xs font-semibold">
              <button onClick={() => setActiveTab('addProduct')} className={`text-left p-3 rounded-lg transition-colors ${activeTab === 'addProduct' ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} hover:opacity-100 border`}`}>
                ➕ Agregar / Reabastecer
              </button>
              <button onClick={() => setActiveTab('otherStores')} className={`text-left p-3 rounded-lg transition-colors ${activeTab === 'otherStores' ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} hover:opacity-100 border`}`}>
                🏬 Otras Tiendas (Red)
              </button>
              <button onClick={() => setActiveTab('transfers')} className={`text-left p-3 rounded-lg transition-colors ${activeTab === 'transfers' ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} hover:opacity-100 border`}`}>
                🔄 Módulo de Traslados
              </button>
              <button onClick={() => setActiveTab('movements')} className={`text-left p-3 rounded-lg transition-colors ${activeTab === 'movements' ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} hover:opacity-100 border`}`}>
                📊 Movimientos Inventario
              </button>
              <button onClick={() => { setActiveTab('salesReport'); loadSalesReport(businessIdState, selectedBranch); }} className={`text-left p-3 rounded-lg transition-colors ${activeTab === 'salesReport' ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} hover:opacity-100 border`}`}>
                💰 Reporte Ventas (Hoy)
              </button>
              <button onClick={() => { setActiveTab('customers'); loadCustomers(businessIdState); }} className={`text-left p-3 rounded-lg transition-colors ${activeTab === 'customers' ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} hover:opacity-100 border`}`}>
                👥 Directorio Clientes
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 text-xs space-y-3">
              {activeTab === 'addProduct' && (
                <form onSubmit={handleAddOrRestockProduct} className="space-y-3">
                  <p className="font-bold text-emerald-500 text-sm">Ingresar o Crear Inventario</p>
                  <select value={selectedExistingProduct} onChange={e => setSelectedExistingProduct(e.target.value)} className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`}>
                    <option value="">-- Selecciona producto --</option>
                    <option value="NEW">✨ [+ Crear Nuevo Producto]</option>
                    {products.map(p => (<option key={p.id} value={p.id}>📦 {p.name}</option>))}
                  </select>

                  {selectedExistingProduct && selectedExistingProduct !== 'NEW' && (
                    <div className="space-y-1">
                      <label className="opacity-80">Cantidad a sumar al stock:</label>
                      <input type="number" min="1" value={addMoreQuantity} onChange={e => setAddMoreQuantity(Number(e.target.value))} className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} required />
                    </div>
                  )}

                  {selectedExistingProduct === 'NEW' && (
                    <div className="space-y-2.5">
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del producto" className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} required />
                      <div className="flex justify-between items-center">
                        <label className="opacity-80">Categoría</label>
                        <button type="button" onClick={() => setShowNewCategoryModal(true)} className="text-emerald-500 font-bold">+ Crear categoría</button>
                      </div>
                      <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`}>
                        <option value="">-- Ninguna --</option>
                        {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                      <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Precio de venta Q" className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} required />
                      <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} placeholder="Stock inicial" className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} />
                      <input type="file" accept="image/*" onChange={handleImageChange} className={`w-full border p-1.5 rounded-lg text-xs ${inputBg}`} />
                    </div>
                  )}

                  {selectedExistingProduct && (
                    <button type="submit" disabled={uploadingImage} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold mt-2 shadow">Guardar Cambios</button>
                  )}
                </form>
              )}

              {activeTab === 'otherStores' && (
                <div className="space-y-3">
                  <p className="font-bold text-emerald-500 text-sm">Inventario en Red (Otras Tiendas)</p>
                  <input 
                    type="text" 
                    value={otherStoresSearch} 
                    onChange={e => setOtherStoresSearch(e.target.value)} 
                    placeholder="🔍 Buscar en red..." 
                    className={`w-full border p-2.5 rounded-lg text-xs ${inputBg}`} 
                  />

                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                    <button
                      onClick={() => setSelectedOtherStoreCategory(null)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                        selectedOtherStoreCategory === null ? 'bg-emerald-600 text-white' : `${subPanelBg} border`
                      }`}
                    >
                      ✨ Todos
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedOtherStoreCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                          selectedOtherStoreCategory === cat.id ? 'bg-emerald-600 text-white' : `${subPanelBg} border`
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    {filteredOtherStores.length === 0 ? (
                      <p className="opacity-75 text-center py-6 text-xs">No hay registros coincidentes.</p>
                    ) : (
                      filteredOtherStores.map((p, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border flex justify-between items-center ${subPanelBg}`}>
                          <div>
                            <p className="font-bold text-sm">{p.name}</p>
                            <p className="text-xs text-amber-500 font-medium">Sucursal: {p.branch_name}</p>
                            <p className="text-xs opacity-75">Stock disponible: <span className="text-emerald-500 font-bold">{p.stock}</span></p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="font-extrabold text-emerald-500 text-sm" translate="no">Q {p.price}</span>
                            <button 
                              onClick={() => {
                                setTransferProduct(p)
                                setTransferQuantity(1)
                                setActiveTab('transfers')
                              }}
                              className="bg-blue-600 hover:bg-blue-500 text-xs px-3 py-1.5 rounded-md text-white font-semibold shadow"
                            >
                              Pedir
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'transfers' && (
                <div className="space-y-3">
                  <p className="font-bold text-emerald-500 text-sm">Gestión de Traslados</p>
                  {transferProduct && (
                    <form onSubmit={handleRequestTransfer} className={`p-3 rounded-lg border space-y-2 ${subPanelBg}`}>
                      <p className="font-bold">Solicitar: {transferProduct.name}</p>
                      <input type="number" min="1" value={transferQuantity} onChange={e => setTransferQuantity(Number(e.target.value))} className={`w-full border p-2 rounded text-xs ${inputBg}`} required />
                      <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded font-bold text-xs shadow">Enviar Solicitud</button>
                    </form>
                  )}
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                    {transfersList.map((t) => (
                      <div key={t.transfer_id} className={`p-3 rounded-lg border flex justify-between items-center ${subPanelBg}`}>
                        <div>
                          <p className="font-semibold">{t.product_name}</p>
                          <p className="text-[11px] opacity-75">Estado: <span className="text-amber-400 font-bold">{t.status}</span></p>
                        </div>
                        {t.status === 'pendiente' && t.source_branch_id === selectedBranch && (
                          <button onClick={() => handleCompleteTransfer(t.transfer_id)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold shadow">Aceptar</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'movements' && (
                <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                  <p className="font-bold text-emerald-500 text-sm mb-2">Movimientos del Día</p>
                  {branchMovements.map((m) => (
                    <div key={m.id} className={`p-3 rounded-lg border flex justify-between items-center ${subPanelBg}`}>
                      <span>{m.product?.name}</span>
                      <span className={m.quantity < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{m.quantity}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'salesReport' && (
                <div className="space-y-3">
                  <p className="font-bold text-emerald-500 text-sm">Total de Ventas Hoy: Q {salesReport.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)}</p>
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                    {salesReport.map((s) => (
                      <div key={s.sale_id} onClick={() => handleViewSaleDetails(s.sale_id)} className={`p-3 rounded-lg border cursor-pointer hover:border-emerald-500 transition-colors ${subPanelBg}`}>
                        <div className="flex justify-between font-semibold">
                          <span>NIT: {s.customer_nit}</span>
                          <span className="text-emerald-500" translate="no">Q {s.total_amount}</span>
                        </div>
                        <p className="text-[10px] opacity-75">{s.customer_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'customers' && (
                <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                  <p className="font-bold text-emerald-500 text-sm mb-2">Directorio de Clientes</p>
                  {customersList.map((c) => (
                    <div key={c.customer_id} className={`p-3 rounded-lg border ${subPanelBg}`}>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="opacity-75 text-xs">NIT: {c.nit}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE STOCK BAJO */}
      {showLowStockModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-xl border border-amber-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <h3 className="text-base font-bold text-amber-500">⚠️ Productos con Stock Bajo</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {lowStockItems.map(p => (
                <div key={p.id} className={`p-2 rounded border flex justify-between ${subPanelBg}`}>
                  <span>{p.name}</span>
                  <span className="text-red-500 font-bold">Stock: {p.stock}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowLowStockModal(false)} className="w-full bg-slate-600 py-2 rounded text-white font-bold">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE VENTA */}
      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-[420px] shadow-2xl ${panelBg}`}>
            <h3 className="text-base font-bold text-emerald-500 mb-4">📦 Detalle de la Venta</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedSaleDetails.map((item, idx) => (
                <div key={idx} className={`p-2 rounded border flex justify-between ${subPanelBg}`}>
                  <span>{item.product_name} (x{item.quantity})</span>
                  <span className="text-emerald-500 font-bold">Q {item.quantity * item.price}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedSaleDetails(null)} className="mt-4 w-full bg-slate-600 text-white py-2 rounded font-bold">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CATEGORÍA */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
            <h3 className="text-base font-bold text-emerald-500">✨ Nueva Categoría</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-sm">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nombre..." className={`w-full border p-2 rounded ${inputBg}`} required autoFocus />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingCategory} className="flex-1 bg-emerald-600 py-2 rounded text-sm font-bold text-white">Guardar</button>
                <button type="button" onClick={() => setShowNewCategoryModal(false)} className="bg-slate-600 px-4 py-2 rounded text-sm text-white">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}