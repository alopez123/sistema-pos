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
  const router = useRouter()

  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('pos_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('pos_theme', newMode ? 'dark' : 'light')
  }

  // Estado para el Logotipo del Negocio
  const [businessLogo, setBusinessLogo] = useState<string | null>(null)

  // Control para Manejo de Clientes y ventas
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [customerNit, setCustomerNit] = useState('CF'); // Default CF
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta'>('efectivo');

  // Estados para el buscador y autocompletado
  const [searchTerm, setSearchTerm] = useState('')
  const [otherStoresSearch, setOtherStoresSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Estado para el panel flotante de Alerta de Stock Bajo
  const [showLowStockModal, setShowLowStockModal] = useState(false)

  // Estados para el menú operativo izquierdo
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
  
  const handleNitChange = async (nit: string) => {
    setCustomerNit(nit)
    if (!nit.trim() || nit.toUpperCase() === 'CF' || !businessIdState) {
      if (nit.toUpperCase() === 'CF') setCustomerName('Consumidor Final')
      return
    }

    const { data, error } = await supabase.rpc('get_customer_by_nit', {
      p_business_id: businessIdState,
      p_customer_nit: nit.trim()
    })

    if (!error && data && data.length > 0) {
      setCustomerName(data[0].name)
    } else {
      setCustomerName('')
    }
  }

  async function handleFinalizeSale() {
    if (!customerNit.trim() || !customerName.trim()) {
      alert("Por favor ingresa el NIT y el Nombre del cliente.")
      return
    }

    const cartJson = cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
      is_special: item.price !== item.originalPrice || item.isSpecial || false,
      original_price: item.originalPrice || item.price,
      staff_id: item.staffId || null
    }));

    const { error } = await supabase.rpc('process_full_sale', {
      p_business_id: businessIdState,
      p_branch_id: selectedBranch,
      p_customer_nit: customerNit,
      p_customer_name: customerName,
      p_payment_method: paymentMethod,
      p_total: totalCart,
      p_cart: cartJson
    });

    if (error) {
      alert("Error al procesar venta: " + error.message);
    } else {
      alert("¡Venta finalizada con éxito!");
      setCart([]);
      setShowPaymentModal(false);
      setCustomerNit('CF');
      setCustomerName('Consumidor Final');
      refreshAllData(selectedBranch, businessIdState);
    }
  }

  async function handleSavePendingOrder() {
    if (!customerNit.trim() || !customerName.trim()) {
      alert("Por favor ingresa el NIT y el Nombre para la orden.")
      return
    }

    if (cart.length === 0) {
      alert("El carrito está vacío.")
      return
    }

    const cartJson = cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price: item.price
    }));

    const { data, error } = await supabase.rpc('create_new_order_safe', {
      p_business_id: businessIdState,
      p_branch_id: selectedBranch,
      p_customer_id: null, 
      p_total_amount: totalCart,
      p_items: cartJson
    });

    if (error) {
      alert("Error al guardar la orden: " + error.message);
    } else if (data && data.length > 0) {
      const nuevaOrden = data[0];
      const numeroTurno = nuevaOrden.order_number;

      alert(`✅ ¡Comanda / Orden guardada con éxito!\n\n🎟️ TURNO / ORDEN #${numeroTurno}\n\nEl cliente ya puede pasar a caja con este número.`);
      
      setCart([]);
      setCustomerNit('CF');
      setCustomerName('Consumidor Final');
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
          setActiveTab('ticket')
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
        setActiveTab('ticket')
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
      setActiveTab('transfers')
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

  // Clases dinámicas según el tema (Modo Oscuro vs Modo Claro)
  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-4 md:p-6 flex flex-col w-full px-6 notranslate ${themeBg}`} translate="no">
      <header className={`p-4 rounded-lg shadow mb-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 border w-full ${panelBg}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {businessLogo ? (
            <img src={businessLogo} alt="Logo" className={`w-14 h-14 object-contain rounded-lg p-1 border shadow ${isDarkMode ? 'bg-[#0f172a] border-slate-600' : 'bg-white border-slate-300'}`} />
          ) : (
            <div className={`w-14 h-14 rounded-lg flex items-center justify-center text-[10px] border ${isDarkMode ? 'bg-[#0f172a] border-slate-600 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>POS</div>
          )}

          <h1 className="text-xl font-bold">Punto de Venta</h1>
          <select 
            value={selectedBranch} 
            onChange={e => handleBranchChange(e.target.value)}
            disabled={isStaff}
            className={`border px-3 py-2 rounded outline-none focus:border-emerald-500 font-semibold disabled:opacity-75 disabled:cursor-not-allowed w-full sm:w-auto ${inputBg}`}
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
          
        <div className="flex items-center gap-2 justify-end flex-wrap">
           {/* BOTÓN INTERRUPTOR DE TEMA (CLARO / OSCURO) */}
           <button 
             onClick={toggleTheme}
             className={`px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors border ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-amber-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'}`}
           >
             {isDarkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
           </button>

           <button 
             onClick={() => setShowLowStockModal(true)} 
             className={`relative px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1.5 ${
               lowStockItems.length > 0 ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
             }`}
           >
             ⚠️ Stock Bajo
             {lowStockItems.length > 0 && (
               <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                 {lowStockItems.length}
               </span>
             )}
           </button>

           <button 
            onClick={() => router.push('/compras')} 
            className="bg-amber-700 hover:bg-amber-600 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1 text-white"
          >
            📦 Compras
          </button>
           <button 
            onClick={() => router.push('/clientes/reportes')} 
            className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1 text-white"
          >
            👥 Clientes
          </button>
          <button 
            onClick={() => router.push('/cotizaciones')} 
            className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1 text-white"
          >
            📄 Cotización
          </button>
          <button 
            onClick={() => router.push('/ventas-historia')} 
            className="bg-emerald-700 hover:bg-slate-600 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1 text-white"
          >
            📅 Historial / Días
          </button>
          <button 
            onClick={() => router.push('/precios-especiales')} 
            className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1 text-white"
          >
            🛡️ Auditoría de Precios
          </button>
          <button 
            onClick={handleExit} 
            className="bg-red-700 hover:bg-slate-600 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors text-white"
          >
            {isStaff ? 'Cerrar Sesión' : 'Volver al Panel'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 flex-1 w-full">
        
        <div className={`p-5 rounded-lg shadow border flex flex-col ${panelBg}`}>
          <h2 className="text-base font-bold text-emerald-500 mb-3">Opciones Operativas</h2>
          
          <div className={`grid grid-cols-2 gap-1.5 mb-4 p-1.5 rounded border text-xs ${subPanelBg}`}>
            <button 
              onClick={() => setActiveTab('addProduct')} 
              className={`py-2.5 px-2 rounded font-semibold text-center transition-colors ${activeTab === 'addProduct' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'}`}
            >
              ➕ Agregar
            </button>
            <button 
              onClick={() => setActiveTab('otherStores')} 
              className={`py-2.5 px-2 rounded font-semibold text-center transition-colors ${activeTab === 'otherStores' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'}`}
            >
              🏬 Otras Tiendas
            </button>
            <button 
              onClick={() => setActiveTab('transfers')} 
              className={`py-2.5 px-2 rounded font-semibold text-center transition-colors ${activeTab === 'transfers' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'}`}
            >
              🔄 Traslados
            </button>
            <button 
              onClick={() => setActiveTab('movements')} 
              className={`py-2.5 px-2 rounded font-semibold text-center transition-colors ${activeTab === 'movements' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'}`}
            >
              📊 Movimientos
            </button>
            <button 
              onClick={() => { setActiveTab('salesReport'); loadSalesReport(businessIdState, selectedBranch); }} 
              className={`py-2.5 px-2 rounded font-semibold text-center transition-colors ${activeTab === 'salesReport' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'}`}
            >
              💰 Ventas
            </button>
            <button 
              onClick={() => { setActiveTab('customers'); loadCustomers(businessIdState); }} 
              className={`py-2.5 px-2 rounded font-semibold text-center transition-colors ${activeTab === 'customers' ? 'bg-emerald-600 text-white' : 'opacity-75 hover:opacity-100'}`}
            >
              👥 Clientes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[58vh] pr-1 text-sm">
            {activeTab === 'ticket' && (
              <div className="text-center text-sm py-12 opacity-75">
                Selecciona una opción arriba para agregar inventario, consultar red, gestionar traslados, ver movimientos, ventas o clientes.
              </div>
            )}

            {activeTab === 'addProduct' && (
              <form onSubmit={handleAddOrRestockProduct} className="space-y-3 text-sm">
                <p className="text-emerald-500 font-semibold mb-2 text-base">Ingresar Inventario / Producto</p>
                
                <div>
                  <label className="block mb-1 opacity-90">Seleccionar Producto</label>
                  <select 
                    value={selectedExistingProduct}
                    onChange={e => setSelectedExistingProduct(e.target.value)}
                    className={`w-full border p-2.5 rounded text-sm ${inputBg}`}
                  >
                    <option value="">-- Selecciona una opción --</option>
                    <option value="NEW">✨ [+ Crear Nuevo Producto]</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>📦 {p.name} (Stock actual: {p.stock})</option>
                    ))}
                  </select>
                </div>

                {selectedExistingProduct && selectedExistingProduct !== 'NEW' && (
                  <div>
                    <label className="block mb-1 opacity-90">Cantidad a Agregar (Ingreso)</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={addMoreQuantity} 
                      onChange={e => setAddMoreQuantity(Number(e.target.value))} 
                      className={`w-full border p-2.5 rounded text-sm ${inputBg}`} 
                      required 
                    />
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
                        <button 
                          type="button" 
                          onClick={() => setShowNewCategoryModal(true)} 
                          className="text-emerald-500 hover:opacity-75 font-bold text-xs"
                        >
                          + Crear Nueva
                        </button>
                      </div>
                      <select 
                        value={newCategoryId} 
                        onChange={e => setNewCategoryId(e.target.value)} 
                        className={`w-full border p-2.5 rounded text-sm ${inputBg}`}
                      >
                        <option value="">-- Sin Categoría --</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
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
                      <input type="file" accept="image/*" onChange={handleImageChange} className={`w-full border p-2 rounded text-xs ${inputBg}`} />
                      {imagePreview && (
                        <div className={`mt-2 relative w-full h-24 rounded border overflow-hidden ${subPanelBg}`}>
                          <img src={imagePreview} alt="Vista previa" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedExistingProduct && (
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={uploadingImage} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2.5 rounded font-bold text-white text-sm">
                      {uploadingImage ? 'Guardando...' : 'Guardar y Registrar'}
                    </button>
                    <button type="button" onClick={() => { setSelectedExistingProduct(''); setActiveTab('ticket'); }} className="bg-slate-600 hover:bg-slate-500 px-3 py-2.5 rounded text-white text-sm">Cancelar</button>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'otherStores' && (
              <div className="space-y-3 text-sm">
                <p className="text-emerald-500 font-semibold mb-1 text-base">Inventario en Red (Otras Sucursales)</p>
                <input 
                  type="text"
                  value={otherStoresSearch}
                  onChange={e => setOtherStoresSearch(e.target.value)}
                  placeholder="🔍 Buscar en otras sucursales..."
                  className={`w-full border p-2.5 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`}
                />

                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button
                    onClick={() => setSelectedOtherStoreCategory(null)}
                    className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                      selectedOtherStoreCategory === null ? 'bg-emerald-600 text-white' : `${subPanelBg} border`
                    }`}
                  >
                    ✨ Todos
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedOtherStoreCategory(cat.id)}
                      className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                        selectedOtherStoreCategory === cat.id ? 'bg-emerald-600 text-white' : `${subPanelBg} border`
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {filteredOtherStores.length === 0 ? (
                    <p className="opacity-75 text-center py-8">No hay registros coincidentes.</p>
                  ) : (
                    filteredOtherStores.map((p, idx) => (
                      <div key={idx} className={`p-3 rounded border flex justify-between items-center ${subPanelBg}`}>
                        <div>
                          <p className="font-semibold text-sm">{p.name}</p>
                          <p className="text-xs text-amber-500 font-medium">Sucursal: {p.branch_name}</p>
                          <p className="text-xs opacity-75">Stock: <span className="text-emerald-500 font-bold text-sm">{p.stock}</span></p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-emerald-500 text-sm" translate="no">Q {p.price}</span>
                          <button 
                            onClick={() => {
                              setTransferProduct(p)
                              setTransferQuantity(1)
                              setActiveTab('transfers')
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-xs px-2.5 py-1 rounded text-white font-semibold"
                          >
                            Solicitar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className="space-y-3 text-sm">
                <p className="text-emerald-500 font-semibold mb-1 text-base">Módulo de Traslados</p>
                
                {transferProduct && (
                  <form onSubmit={handleRequestTransfer} className={`p-3 rounded border border-emerald-500/50 space-y-2 mb-3 ${subPanelBg}`}>
                    <p className="font-bold text-sm">Solicitar: {transferProduct.name}</p>
                    <p className="text-xs opacity-75">Origen: {transferProduct.branch_name} (Stock: {transferProduct.stock})</p>
                    <div>
                      <label className="block mb-1 opacity-90">Cantidad a solicitar:</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={transferQuantity} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') {
                            setTransferQuantity('');
                          } else {
                            const num = parseInt(val, 10);
                            if (!isNaN(num)) setTransferQuantity(num);
                          }
                        }}
                        className={`w-full border p-2 rounded text-sm ${inputBg}`} 
                        required
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded font-bold text-white text-sm">Enviar Solicitud</button>
                      <button type="button" onClick={() => setTransferProduct(null)} className="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded text-white text-sm">Cancelar</button>
                    </div>
                  </form>
                )}

                <p className="text-xs leading-relaxed opacity-80">
                  Historial de solicitudes y traslados activos entre sucursales:
                </p>

                <div className="space-y-2">
                  {transfersList.length === 0 ? (
                    <div className={`p-3 rounded border text-center py-6 ${subPanelBg}`}>
                      <p className="opacity-75 text-sm">No hay traslados registrados.</p>
                    </div>
                  ) : (
                    transfersList.map((t) => (
                      <div key={t.transfer_id} className={`p-3 rounded border space-y-1.5 ${subPanelBg}`}>
                        <div className="flex justify-between font-semibold text-sm">
                          <span className="text-emerald-500 font-bold text-base">
                            📦 {t.product_name || 'Artículo solicitado'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'completado' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-500'}`}>
                            {t.status}
                          </span>
                        </div>
                        <p className="text-xs opacity-80">De: <span className="font-medium">{t.source_branch_name}</span> → Para: <span className="font-medium">{t.destination_branch_name}</span></p>
                        <p className="text-xs opacity-80">Cantidad: <span className="text-emerald-500 font-bold text-sm">{t.quantity} unidades</span></p>
                        
                        {t.status === 'pendiente' && t.source_branch_id === selectedBranch && (
                          <button 
                            onClick={() => handleCompleteTransfer(t.transfer_id)}
                            className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded font-semibold"
                          >
                            Aceptar y Enviar (Descontar Stock)
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'movements' && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-emerald-500 font-semibold text-base">Movimientos (Cuadre)</p>
                  <button 
                    onClick={() => loadMovements(selectedBranch)} 
                    className={`text-xs px-2.5 py-1 rounded border font-medium ${subPanelBg}`}
                  >
                    🔄 Actualizar
                  </button>
                </div>
                <p className="text-xs leading-relaxed opacity-80">
                  Registro de ventas y traslados de esta sucursal para tu cuadre diario:
                </p>

                <div className="space-y-2">
                  {branchMovements.length === 0 ? (
                    <div className={`p-3 rounded border text-center py-6 ${subPanelBg}`}>
                      <p className="opacity-75 text-sm">No hay movimientos registrados en esta sucursal.</p>
                    </div>
                  ) : (
                    branchMovements.map((m) => (
                      <div key={m.id} className={`p-3 rounded border space-y-1 ${subPanelBg}`}>
                        <div className="flex justify-between font-semibold text-sm">
                          <span>{m.product?.name || 'Producto'}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            m.quantity < 0 ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
                          }`}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs opacity-75">
                          <span className="uppercase tracking-wider font-semibold text-amber-500">{m.movement_type}</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'salesReport' && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-emerald-500 font-semibold text-base">Reporte de Ventas (Hoy)</p>
                  <button onClick={() => loadSalesReport(businessIdState, selectedBranch)} className={`text-xs px-2.5 py-1 rounded border font-medium ${subPanelBg}`}>🔄 Actualizar</button>
                </div>

                <div className={`p-3.5 rounded-lg border border-emerald-500/40 flex justify-between items-center shadow ${subPanelBg}`}>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider opacity-75">Total Ventas (Día)</p>
                    <p className="text-lg font-extrabold text-emerald-500 mt-0.5" translate="no">
                      Q {salesReport.reduce((acc, sale) => acc + Number(sale.total_amount || 0), 0)}
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-600 font-bold px-2.5 py-1 rounded">
                    {salesReport.length} {salesReport.length === 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>

                <p className="text-xs opacity-80">💡 Haz clic en cualquier venta para ver el detalle de productos.</p>
                <div className="space-y-2">
                  {salesReport.length === 0 ? (
                    <p className="opacity-75 text-center py-6 text-sm">No hay ventas registradas hoy en esta sucursal.</p>
                  ) : (
                    salesReport.map((sale) => (
                      <div 
                        key={sale.sale_id} 
                        onClick={() => handleViewSaleDetails(sale.sale_id)}
                        className={`p-3 rounded border hover:border-emerald-500 cursor-pointer transition-all space-y-1 shadow ${subPanelBg}`}
                      >
                        <div className="flex justify-between font-semibold text-sm">
                          <span>NIT: {sale.customer_nit}</span>
                          <span className="text-emerald-500 text-sm font-bold" translate="no">Q {sale.total_amount}</span>
                        </div>
                        <p className="text-xs opacity-90">Cliente: {sale.customer_name}</p>
                        <div className="flex justify-between text-xs opacity-75">
                          <span className="uppercase text-amber-500 font-semibold">{sale.payment_method}</span>
                          <span>{new Date(sale.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-emerald-500 font-semibold text-base">Directorio de Clientes</p>
                  <button onClick={() => loadCustomers(businessIdState)} className={`text-xs px-2.5 py-1 rounded border font-medium ${subPanelBg}`}>🔄 Actualizar</button>
                </div>
                <div className="space-y-2">
                  {customersList.length === 0 ? (
                    <p className="opacity-75 text-center py-6 text-sm">No hay clientes registrados.</p>
                  ) : (
                    customersList.map((cust) => (
                      <div key={cust.customer_id} className={`p-3 rounded border space-y-1 ${subPanelBg}`}>
                        <div className="flex justify-between font-semibold text-sm">
                          <span>{cust.name}</span>
                          <span className="text-emerald-500 text-xs bg-emerald-500/20 px-2 py-0.5 rounded font-bold">{cust.total_purchases} compras</span>
                        </div>
                        <p className="text-xs opacity-75">NIT: <span className="font-mono font-medium">{cust.nit}</span></p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {activeTab !== 'ticket' && (
            <button onClick={() => setActiveTab('ticket')} className="mt-3 w-full bg-slate-600 hover:bg-slate-500 text-white py-2.5 rounded text-sm font-semibold transition-colors">
              ← Volver al Ticket
            </button>
          )}
        </div>

        <div className={`lg:col-span-2 xl:col-span-2 p-5 rounded-lg shadow border flex flex-col ${panelBg}`}>
          <div className="mb-4 relative" ref={searchRef}>
            <input 
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="🔍 Buscar producto por nombre..."
              className={`w-full px-4 py-3 rounded-lg text-base outline-none focus:border-emerald-500 transition-colors border ${inputBg}`}
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

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                selectedCategory === null ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`
              }`}
            >
              ✨ Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id ? 'bg-emerald-600 text-white shadow' : `${subPanelBg} border`
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[55vh] pr-1 flex-1">
            {filteredProducts.length === 0 ? (
              <p className="col-span-full text-center py-10 text-base opacity-75">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`border p-3.5 rounded-lg flex flex-col justify-between text-left transition-all duration-150 shadow group cursor-pointer h-full select-none ${subPanelBg} hover:border-emerald-500`}
                >
                  <div className="flex flex-col">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover rounded mb-2.5 border border-opacity-50 pointer-events-none" />
                    ) : (
                      <div className="w-full h-28 rounded mb-2.5 flex items-center justify-center text-xs opacity-50 border border-opacity-50">Sin imagen</div>
                    )}
                    <span className="text-xs sm:text-sm block mb-1 font-semibold opacity-80">
                      Stock: <span className="text-emerald-500 font-bold">{p.is_custom ? 'N/A' : p.stock}</span>
                    </span>
                    <h3 className="font-bold group-hover:text-emerald-500 transition-colors line-clamp-2 text-sm sm:text-base leading-snug">{p.name}</h3>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t border-opacity-50 flex items-center justify-between">
                    <span className="text-xs uppercase font-medium opacity-70">{p.is_custom ? 'Variable' : 'Precio'}</span>
                    <span className="text-emerald-500 font-extrabold text-base sm:text-lg" translate="no">
                      {p.is_custom ? 'A cotizar' : `Q ${p.price}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`p-5 rounded-lg shadow border flex flex-col justify-between ${panelBg}`}>
          <div>
            <h2 className="text-lg font-bold text-emerald-500 mb-4">Ticket de Venta</h2>
            <div className="space-y-3 overflow-y-auto max-h-[48vh] pr-1">
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
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.price} 
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          className={`w-24 border rounded px-2 py-1 text-emerald-500 font-bold text-sm outline-none focus:border-emerald-500 ${inputBg}`} 
                        />
                        {item.isSpecial && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase">
                            Especial
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold opacity-90">Cant: {item.quantity}</span>
                    </div>

                    <div className="flex justify-between items-center pt-1.5 border-t border-opacity-50">
                      <span className="text-xs font-medium opacity-80">Subtotal:</span>
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
         

            <button 
              onClick={handleSavePendingOrder}
              disabled={cart.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-bold shadow transition-colors text-sm"
            >
              📝 Guardar Orden (Pasar a Caja)
            </button>
          </div>
        </div>

      </div>

      {showLowStockModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-xl border border-amber-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2 border-opacity-50">
              <h3 className="text-base font-bold text-amber-500 flex items-center gap-2">
                ⚠️ Productos con Stock Bajo (≤ 5)
              </h3>
              <button onClick={() => setShowLowStockModal(false)} className="font-bold text-base opacity-75 hover:opacity-100">✕</button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-sm">
              {lowStockItems.length === 0 ? (
                <div className="text-center py-8 opacity-75">
                  <p>¡Excelente! No hay productos con stock crítico en esta sucursal.</p>
                </div>
              ) : (
                lowStockItems.map(p => (
                  <div key={p.id} className={`p-3 rounded border flex justify-between items-center ${subPanelBg}`}>
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs opacity-75">Estado crítico de inventario</p>
                    </div>
                    <span className="bg-red-500/20 text-red-500 font-bold px-2.5 py-1 rounded text-xs border border-red-500/30">
                      Stock: {p.stock}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-2">
              {lowStockItems.length > 0 && (
                <button 
                  onClick={() => {
                    setShowLowStockModal(false)
                    router.push('/compras')
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 py-2.5 rounded-lg font-bold text-sm text-white"
                >
                  📦 Ir a Compras / Reabastecer
                </button>
              )}
              <button 
                onClick={() => setShowLowStockModal(false)} 
                className="bg-slate-600 hover:bg-slate-500 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSaleDetails !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-[420px] shadow-2xl ${panelBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-emerald-500">📦 Detalle de la Venta</h3>
              <button onClick={() => setSelectedSaleDetails(null)} className="font-bold text-base opacity-75 hover:opacity-100">✕</button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-sm">
              {selectedSaleDetails.length === 0 ? (
                <p className="opacity-75 text-center py-6">No se encontraron productos en esta venta.</p>
              ) : (
                selectedSaleDetails.map((item, idx) => (
                  <div key={idx} className={`p-3 rounded border flex justify-between items-center ${subPanelBg}`}>
                    <div>
                      <p className="font-semibold text-sm">{item.product_name}</p>
                      <p className="text-xs opacity-75">Cantidad: <span className="text-emerald-500 font-bold">{item.quantity}</span> x Q {item.price}</p>
                    </div>
                    <span className="font-bold text-emerald-500 text-base" translate="no">Q {item.quantity * item.price}</span>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => setSelectedSaleDetails(null)} 
              className="mt-6 w-full bg-slate-600 hover:bg-slate-500 text-white py-3 rounded-lg font-semibold text-sm"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`p-8 rounded-xl border border-emerald-500 w-[400px] shadow-[0_0_50px_rgba(0,0,0,0.5)] ${panelBg}`}>
            <h2 className="text-xl font-bold text-emerald-500 mb-6">Finalizar Venta</h2>
            
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-medium opacity-80">NIT (o CF)</label>
                <input 
                  type="text" 
                  value={customerNit} 
                  onChange={e => handleNitChange(e.target.value)} 
                  placeholder="Ej. 12345678 o CF"
                  className={`w-full p-3 rounded border focus:border-emerald-500 outline-none uppercase font-semibold text-emerald-500 text-base ${inputBg}`} 
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium opacity-80">Nombre / Razón Social</label>
                  {customerName && customerName !== 'Consumidor Final' && customerName !== '' && (
                    <span className="text-xs text-emerald-500 font-bold">✔ Cliente Registrado</span>
                  )}
                  {(!customerName || customerName === '') && customerNit.toUpperCase() !== 'CF' && (
                    <span className="text-xs text-amber-500 font-bold">✨ Nuevo Cliente (Se registrará)</span>
                  )}
                </div>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)} 
                  placeholder="Nombre del cliente o razón social"
                  className={`w-full p-3 rounded border focus:border-emerald-500 outline-none text-base ${inputBg}`} 
                />
              </div>

              <div>
                <label className="text-xs font-medium opacity-80">Método de Pago</label>
                <select 
                  value={paymentMethod} 
                  onChange={e => setPaymentMethod(e.target.value as any)} 
                  className={`w-full p-3 rounded border focus:border-emerald-500 outline-none text-base ${inputBg}`}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={handleFinalizeSale} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-bold text-white text-base"
              >
                Cobrar Q {totalCart}
              </button>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="bg-slate-600 hover:bg-slate-500 py-3 px-6 rounded-lg font-semibold text-white text-base"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-500">✨ Nueva Categoría</h3>
              <button onClick={() => setShowNewCategoryModal(false)} className="font-bold text-base opacity-75 hover:opacity-100">✕</button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs mb-1 opacity-80">Nombre (ej. Almuerzos, Bebidas)</label>
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="Nombre de la categoría..." 
                  className={`w-full border p-2.5 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`} 
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={savingCategory}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded text-sm font-bold text-white transition-colors disabled:opacity-50"
                >
                  {savingCategory ? 'Guardando...' : 'Guardar'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowNewCategoryModal(false)} 
                  className="bg-slate-600 hover:bg-slate-500 px-4 py-2.5 rounded text-sm text-white"
                >
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