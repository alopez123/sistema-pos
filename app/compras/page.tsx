'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function ComprasPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'suppliers' | 'newPurchase' | 'history'>('suppliers')

  const [businessId, setBusinessId] = useState<string>('')
  const [branchId, setBranchId] = useState<string>('')
  const [branches, setBranches] = useState<any[]>([])
  const [staffRole, setStaffRole] = useState<string>('')

  // Estado para Notificaciones Flotantes (Toast) con Z-Index Máximo Absoluto
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [savingPurchase, setSavingPurchase] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)

  // Estados para Modal de Abonos a Proveedores
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<any | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethodType, setPaymentMethodType] = useState('Efectivo')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Estados para Ver Historial de Abonos y Productos
  const [viewingPaymentsPurchase, setViewingPaymentsPurchase] = useState<any | null>(null)
  const [purchasePaymentsList, setPurchasePaymentsList] = useState<any[]>([])
  const [purchaseItemsList, setPurchaseItemsList] = useState<any[]>([])
  const [loadingModalData, setLoadingModalData] = useState(false)
  const [historyBranchFilter, setHistoryBranchFilter] = useState<string>('ALL')

  useEffect(() => {
    const savedTheme = localStorage.getItem('purchases_theme')
    if (savedTheme === 'light') setIsDarkMode(false)
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('purchases_theme', newMode ? 'dark' : 'light')
  }

  // Estados para Categorías, Nuevos Productos, Producto Personalizado e Imagen
  const [categories, setCategories] = useState<any[]>([])
  const [newProdName, setNewProdName] = useState('')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [isCustomProduct, setIsCustomProduct] = useState(false) 
  const [newProdCategory, setNewProdCategory] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Estados para Modal de Categorías
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  // Proveedores
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supName, setSupName] = useState('')
  const [supContact, setSupContact] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [supAddress, setSupAddress] = useState('')

  // Registrar Compra
  const [products, setProducts] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<'Contado' | 'Crédito'>('Contado')
  const [purchaseDueDate, setPurchaseDueDate] = useState('')
  const [purchaseCart, setPurchaseCart] = useState<any[]>([])
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('')
  const [purchaseQty, setPurchaseQty] = useState(1)
  const [purchaseCost, setPurchaseCost] = useState('')
  const [purchasesHistory, setPurchasesHistory] = useState<any[]>([])

  // INICIALIZACIÓN ROBUSTA Y SEGURA MULTI-TENANT
  useEffect(() => {
    try {
      const bizStr = localStorage.getItem('currentBusiness')
      const staffDataStr = localStorage.getItem('currentStaff')

      let bId = ''
      let brId = ''

      if (staffDataStr) {
        try {
          const staff = JSON.parse(staffDataStr)
          bId = staff.business_id || staff.busines_id || ''
          brId = staff.branch_id || ''
          setStaffRole(staff.role || 'vendedor')
        } catch (err) {}
      }

      if (!bId && bizStr) {
        try {
          const biz = JSON.parse(bizStr)
          bId = biz.id || biz.business_id || biz.busines_id || ''
          setStaffRole('dueño')
        } catch (err) {}
      }

      if (bId) {
        setBusinessId(bId)
        loadBranchesAndInitialize(bId, brId)
        loadSuppliers(bId)
        loadCategories(bId)
        loadPurchasesHistory(bId, 'ALL')
      }
    } catch (e) {
      console.error("Error al cargar sesión:", e)
    }
  }, [])

  const loadBranchesAndInitialize = async (bId: string, initialBrId: string) => {
    const { data, error } = await supabase.from('branches').select('*').eq('business_id', bId)
    if (!error && data && data.length > 0) {
      setBranches(data)
      const targetBranch = initialBrId && data.some(b => b.id === initialBrId) ? initialBrId : data[0].id
      setBranchId(targetBranch)
      loadProducts(bId, targetBranch)
    }
  }

  const loadCategories = async (bId: string) => {
    const { data, error } = await supabase.from('categories').select('*').eq('business_id', bId).order('name', { ascending: true })
    if (!error && data) setCategories(data)
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim() || !businessId) return

    setSavingCategory(true)
    const { data, error } = await supabase.rpc('create_category_safe', {
      p_business_id: businessId,
      p_name: newCategoryName.trim()
    })
    setSavingCategory(false)

    if (error) {
      showToast("Error al crear categoría: " + error.message, 'error')
    } else {
      showToast("¡Categoría creada con éxito!", 'success')
      await loadCategories(businessId)
      if (data && data.category_id) setNewProdCategory(data.category_id)
      setNewCategoryName('')
      setShowNewCategoryModal(false)
    }
  }

  // 1. CARGA SEGURA DE PROVEEDORES MEDIANTE RPC[cite: 1]
  const loadSuppliers = async (bId: string) => {
    if (!bId) return
    const { data, error } = await supabase.rpc('get_suppliers_by_business', {
      p_business_id: bId
    })

    if (!error && data) {
      setSuppliers(data)
    } else {
      setSuppliers([])
    }
  }

  // 2. CARGA SEGURA DE PRODUCTOS PARA COMPRA POR SUCURSAL Y NEGOCIO
  const loadProducts = async (bId: string, bBranchId: string) => {
    if (!bId || !bBranchId) return
    
    const { data, error } = await supabase.rpc('get_products_by_branch', {
      p_branch_id: bBranchId
    })
    
    if (!error && data) setProducts(data)
    else setProducts([])
  }

  // 3. HISTORIAL DE COMPRAS MULTI-TENANT
  const loadPurchasesHistory = async (bId: string, branchFilter: string = 'ALL') => {
    if (!bId) return
    
    const { data, error } = await supabase.rpc('get_purchases_history', {
      p_business_id: bId,
      p_branch_id: branchFilter
    })
    
    if (!error && data) {
      const { data: branchList } = await supabase.from('branches').select('*').eq('business_id', bId)
      const currentBranches = branchList || []

      const formatted = data.map((p: any) => {
        const foundBranch = currentBranches.find((b: any) => b.id === p.branch_id)
        return { ...p, branch_name: foundBranch ? foundBranch.name : 'Sucursal Principal' }
      })
      setPurchasesHistory(formatted)
    } else {
      setPurchasesHistory([])
    }
  }
  
  const openPurchaseDetailsModal = async (purchase: any) => {
    setViewingPaymentsPurchase(purchase)
    setLoadingModalData(true)
    try {
      const { data: paymentsData } = await supabase.rpc('get_purchase_payments', { p_purchase_id: purchase.id })
      setPurchasePaymentsList(paymentsData || [])
      const { data: itemsData } = await supabase.rpc('get_purchase_items_safe', { p_purchase_id: purchase.id })
      setPurchaseItemsList(itemsData || [])
    } catch (err) {
      setPurchaseItemsList([])
    } finally {
      setLoadingModalData(false)
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
          let width = img.width
          let height = img.height
          
          // Redimensionamiento optimizado a miniatura (máx 400px, igual que el POS)
          const MAX_SIZE = 400
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          // Compresión optimizada (0.65) para generar un archivo sumamente liviano
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Falló compresión de imagen'))
          }, 'image/jpeg', 0.65)
        }
      }
    })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supName.trim() || !businessId) return

    const { error } = await supabase.rpc('create_supplier_safe', {
      p_business_id: businessId,
      p_name: supName.trim(),
      p_contact_person: supContact.trim(),
      p_phone: supPhone.trim(),
      p_email: supEmail.trim(),
      p_address: supAddress.trim()
    })

    if (error) showToast("Error al crear proveedor: " + error.message, 'error')
    else {
      showToast("¡Proveedor registrado con éxito!", 'success')
      setSupName(''); setSupContact(''); setSupPhone(''); setSupEmail(''); setSupAddress('')
      loadSuppliers(businessId)
    }
  }

  const addProductToPurchaseCart = async () => {
    if (addingToCart) return
    setAddingToCart(true)

    const qty = Number(purchaseQty) || 1
    const cost = parseFloat(purchaseCost) || 0

    try {
      if (selectedProductToAdd === 'NEW') {
        if (!newProdName.trim() || !branchId) {
          showToast("Ingresa el nombre del nuevo producto.", 'error')
          setAddingToCart(false)
          return
        }
        if (!isCustomProduct && !newProdPrice) {
          showToast("Ingresa el precio de venta del producto.", 'error')
          setAddingToCart(false)
          return
        }

        setUploadingImage(true)
        let imageUrl = null

        if (imageFile) {
          const compressedBlob = await compressImage(imageFile)
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`
          const filePath = `products/${fileName}`

          const { error: uploadError } = await supabase.storage.from('products').upload(filePath, compressedBlob, {
            contentType: 'image/jpeg',
            upsert: false
          })

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('products').getPublicUrl(filePath)
            imageUrl = publicUrlData.publicUrl
          }
        }

        const { data: rawNewProdId, error } = await supabase.rpc('add_product_safe', {
          p_branch_id: branchId,
          p_category_id: newProdCategory || null,
          p_image_url: imageUrl,
          p_is_custom: isCustomProduct,
          p_name: newProdName.trim(),
          p_price: isCustomProduct ? 0 : (parseFloat(newProdPrice) || 0),
          p_stock: 0
        })

        setUploadingImage(false)

        if (error) {
          showToast("Error al crear el nuevo producto: " + error.message, 'error')
          setAddingToCart(false)
          return
        }

        let newProdId = rawNewProdId
        if (typeof rawNewProdId === 'string' && rawNewProdId.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawNewProdId)
            newProdId = parsed.product_id || parsed.id
          } catch (e) {}
        } else if (typeof rawNewProdId === 'object' && rawNewProdId !== null) {
          newProdId = rawNewProdId.product_id || rawNewProdId.id
        }

        const createdProd = {
          id: newProdId || Date.now().toString(),
          name: newProdName.trim(),
          price: isCustomProduct ? 0 : (parseFloat(newProdPrice) || 0),
          stock: 0,
          image_url: imageUrl,
          is_custom: isCustomProduct
        }

        setPurchaseCart(prev => {
          const existing = prev.find(item => item.id === createdProd.id)
          if (existing) {
            return prev.map(item => item.id === createdProd.id ? { ...item, quantity: item.quantity + qty, cost } : item)
          }
          return [...prev, { ...createdProd, quantity: qty, cost }]
        })

        loadProducts(businessId, branchId)

        setSelectedProductToAdd('')
        setNewProdName('')
        setNewProdPrice('')
        setIsCustomProduct(false)
        setNewProdCategory('')
        setImageFile(null)
        setImagePreview(null)
        setPurchaseQty(1)
        setPurchaseCost('')

      } else {
        if (!selectedProductToAdd) {
          showToast("Selecciona un producto.", 'error')
          setAddingToCart(false)
          return
        }
        const prod = products.find(p => p.id === selectedProductToAdd)
        if (!prod) {
          setAddingToCart(false)
          return
        }

        const finalCost = cost || Number(prod.price) || 0

        setPurchaseCart(prev => {
          const existing = prev.find(item => item.id === prod.id)
          if (existing) {
            return prev.map(item => item.id === prod.id ? { ...item, quantity: item.quantity + qty, cost: finalCost } : item)
          }
          return [...prev, { ...prod, quantity: qty, cost: finalCost }]
        })

        setSelectedProductToAdd('')
        setPurchaseQty(1)
        setPurchaseCost('')
      }
    } catch (err) {
      showToast("Ocurrió un error al procesar el producto.", 'error')
    } finally {
      setAddingToCart(false)
    }
  }

  const totalPurchaseAmount = purchaseCart.reduce((acc, item) => acc + (item.cost * item.quantity), 0)

  const handleSavePurchase = async () => {
    if (!selectedSupplier) return showToast("Selecciona un proveedor.", 'error')
    if (purchaseCart.length === 0) return showToast("Agrega al menos un producto a la orden de compra.", 'error')
    if (purchasePaymentMethod === 'Crédito' && !purchaseDueDate) {
      return showToast("Selecciona una fecha límite de pago para la compra al crédito.", 'error')
    }

    setSavingPurchase(true)
    try {
      const itemsPayload = purchaseCart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        cost_price: item.cost,
        selling_price: item.price || 0
      }))

      const { error } = await supabase.rpc('register_complete_purchase_v2', {
        p_business_id: businessId,
        p_branch_id: branchId,
        p_supplier_id: selectedSupplier,
        p_invoice_number: invoiceNumber.trim() || 'S/N',
        p_total_amount: totalPurchaseAmount,
        p_payment_method: purchasePaymentMethod,
        p_due_date: purchasePaymentMethod === 'Crédito' ? purchaseDueDate : null,
        p_items: itemsPayload
      })

      if (error) throw error

      showToast("¡Compra registrada, inventario y cuentas por pagar sincronizados con éxito!", 'success')
      setPurchaseCart([])
      setInvoiceNumber('')
      setSelectedSupplier('')
      setPurchasePaymentMethod('Contado')
      setPurchaseDueDate('')
      
      setHistoryBranchFilter('ALL')
      await loadPurchasesHistory(businessId, 'ALL')
      loadProducts(businessId, branchId)
      setActiveTab('history')
    } catch (err: any) {
      showToast(err.message || "Error crítico al registrar la compra.", 'error')
    } finally {
      setSavingPurchase(false)
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
      loadPurchasesHistory(businessId, historyBranchFilter)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('currentBusiness')
    localStorage.removeItem('currentStaff')
    await supabase.auth.signOut()
    router.push('/')
  }

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-2 md:p-4 flex flex-col notranslate pb-20 lg:pb-4 relative ${themeBg}`} translate="no">
      
      {/* TOAST FLOTANTE PROFESIONAL CON Z-INDEX MÁXIMO ABSOLUTO */}
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

      {/* HEADER */}
      <header className={`p-3 rounded-lg shadow mb-4 flex justify-between items-center border w-full ${panelBg}`}>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center shadow transition-colors"
            title="Menú y Herramientas"
          >
            ☰
          </button>
          <div>
            <h1 className="text-xs md:text-sm font-bold text-emerald-500">📦 Módulo de Proveedores y Compras</h1>
            <p className="text-[10px] opacity-75">Control de entradas y cuentas por pagar ({staffRole.toUpperCase()})</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => router.push('/inventario')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow transition-colors flex items-center gap-1.5"
          >
            📋 Ir a Inventario
          </button>
          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-lg text-sm font-semibold border transition-colors ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* PESTAÑAS */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('suppliers')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold ${activeTab === 'suppliers' ? 'bg-emerald-600 text-white' : `${subPanelBg} border`}`}>👥 Proveedores</button>
        <button onClick={() => setActiveTab('newPurchase')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold ${activeTab === 'newPurchase' ? 'bg-emerald-600 text-white' : `${subPanelBg} border`}`}>➕ Registrar Compra</button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold ${activeTab === 'history' ? 'bg-emerald-600 text-white' : `${subPanelBg} border`}`}>📋 Historial y Cuentas por Pagar</button>
      </div>

      {/* TAB PROVEEDORES */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleCreateSupplier} className={`p-5 rounded-lg border space-y-3 h-fit ${panelBg}`}>
            <h2 className="text-base font-bold text-emerald-500 mb-2">Nuevo Proveedor</h2>
            <div>
              <label className="text-xs opacity-75 block mb-1">Empresa / Proveedor *</label>
              <input type="text" value={supName} onChange={e => setSupName(e.target.value)} placeholder="Ej. Distribuidora El Tornillo" className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} required />
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Persona de Contacto</label>
              <input type="text" value={supContact} onChange={e => setSupContact(e.target.value)} placeholder="Nombre del agente" className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} />
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Teléfono</label>
              <input type="text" value={supPhone} onChange={e => setSupPhone(e.target.value)} placeholder="Teléfono" className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} />
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Correo Electrónico</label>
              <input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} placeholder="correo@proveedor.com" className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} />
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Dirección</label>
              <input type="text" value={supAddress} onChange={e => setSupAddress(e.target.value)} placeholder="Ubicación" className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded font-bold text-sm mt-2 text-white shadow">Guardar Proveedor</button>
          </form>

          <div className={`lg:col-span-2 p-5 rounded-lg border ${panelBg}`}>
            <h2 className="text-base font-bold text-emerald-500 mb-3">Directorio de Proveedores</h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {suppliers.length === 0 ? (
                <p className="opacity-75 text-sm text-center py-8">No hay proveedores registrados.</p>
              ) : (
                suppliers.map(s => (
                  <div key={s.id} className={`p-3.5 rounded border flex justify-between items-center text-sm ${subPanelBg}`}>
                    <div>
                      <p className="font-bold text-base">{s.name}</p>
                      <p className="text-xs opacity-80">Contacto: {s.contact_person || 'N/A'} | Tel: {s.phone || 'N/A'}</p>
                      <p className="text-xs opacity-75">Dir: {s.address || 'N/A'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB NUEVA COMPRA */}
      {activeTab === 'newPurchase' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`p-5 rounded-lg border space-y-4 ${panelBg}`}>
            <h2 className="text-base font-bold text-emerald-500">Datos de la Factura / Compra</h2>
            <div>
              <label className="text-xs opacity-75 block mb-1">Sucursal Destino</label>
              <select value={branchId} onChange={e => { setBranchId(e.target.value); loadProducts(businessId, e.target.value); }} className={`w-full border p-2.5 rounded text-sm ${inputBg}`}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Proveedor *</label>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className={`w-full border p-2.5 rounded text-sm ${inputBg}`}>
                <option value="">-- Selecciona Proveedor --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">No. de Factura / Documento</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ej. F-98765" className={`w-full border p-2.5 rounded text-sm ${inputBg}`} />
            </div>

            <div>
              <label className="text-xs opacity-75 block mb-1">Forma de Pago *</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPurchasePaymentMethod('Contado')} className={`py-2 rounded text-xs font-bold ${purchasePaymentMethod === 'Contado' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>💵 Contado</button>
                <button type="button" onClick={() => setPurchasePaymentMethod('Crédito')} className={`py-2 rounded text-xs font-bold ${purchasePaymentMethod === 'Crédito' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'}`}>📋 Crédito</button>
              </div>
            </div>

            {purchasePaymentMethod === 'Crédito' && (
              <div>
                <label className="text-xs opacity-75 block mb-1">Fecha Límite de Pago *</label>
                <input type="date" min={new Date().toISOString().split('T')[0]} value={purchaseDueDate} onChange={e => setPurchaseDueDate(e.target.value)} className={`w-full border p-2.5 rounded text-sm ${inputBg}`} required />
              </div>
            )}

            <div className="pt-4 border-t border-opacity-50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold">Total Compra:</span>
                <span className="text-xl font-extrabold text-emerald-500" translate="no">Q {totalPurchaseAmount.toFixed(2)}</span>
              </div>
              <button 
                onClick={handleSavePurchase} 
                disabled={savingPurchase || purchaseCart.length === 0} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-bold text-sm text-white shadow transition-all flex items-center justify-center gap-2"
              >
                {savingPurchase ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Registrando inventario y cuentas...</span>
                  </>
                ) : (
                  '💾 Registrar Compra e Ingresar al Inventario'
                )}
              </button>
            </div>
          </div>

          <div className={`lg:col-span-2 p-5 rounded-lg border flex flex-col gap-4 ${panelBg}`}>
            <h2 className="text-base font-bold text-emerald-500">Agregar Artículos a la Compra</h2>
            <div className={`grid grid-cols-1 sm:grid-cols-4 gap-2 items-end p-3 rounded border ${subPanelBg}`}>
              <div className="sm:col-span-2">
                <label className="text-xs opacity-75 block mb-1">Producto</label>
                <select value={selectedProductToAdd} onChange={e => setSelectedProductToAdd(e.target.value)} className={`w-full border p-2 rounded text-sm ${inputBg}`}>
                  <option value="">-- Seleccionar Producto --</option>
                  <option value="NEW">✨ [+ Crear Nuevo Producto]</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                </select>
              </div>

              {selectedProductToAdd === 'NEW' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="text-xs opacity-75 block mb-1">Nombre Nuevo Producto *</label>
                    <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="Nombre del artículo" className={`w-full border p-2 rounded text-sm ${inputBg}`} />
                  </div>
                  
                  <div className="sm:col-span-full flex items-center gap-2 p-3 rounded border bg-slate-900/40 border-slate-700">
                    <input type="checkbox" id="isCustomCheck" checked={isCustomProduct} onChange={e => setIsCustomProduct(e.target.checked)} className="w-4 h-4 accent-emerald-500 cursor-pointer" />
                    <label htmlFor="isCustomCheck" className="text-xs font-semibold cursor-pointer select-none text-emerald-400">
                      ¿Es un producto personalizable o de precio/medida abierta?
                    </label>
                  </div>

                  {!isCustomProduct && (
                    <div>
                      <label className="text-xs opacity-75 block mb-1">Precio Venta (Q) *</label>
                      <input type="number" step="0.01" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="0.00" className={`w-full border p-2 rounded text-sm ${inputBg}`} />
                    </div>
                  )}

                  <div className={isCustomProduct ? 'sm:col-span-2' : ''}>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs opacity-75">Categoría</label>
                      <button type="button" onClick={() => setShowNewCategoryModal(true)} className="text-emerald-500 font-bold text-[10px]">+ Crear Nueva</button>
                    </div>
                    <select value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} className={`w-full border p-2 rounded text-sm ${inputBg}`}>
                      <option value="">-- Sin Categoría --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="sm:col-span-full">
                    <label className="text-xs opacity-75 block mb-1">Imagen del Producto</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer bg-slate-700 text-emerald-300 px-4 py-2 rounded text-xs font-semibold">
                        📷 Seleccionar Imagen
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                      <span className="text-xs opacity-80">{imageFile ? imageFile.name : 'Ningún archivo seleccionado'}</span>
                    </div>
                    {imagePreview && <div className="mt-2 w-20 h-20 rounded border overflow-hidden"><img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /></div>}
                  </div>
                </>
              )}

              <div>
                <label className="text-xs opacity-75 block mb-1">Cantidad</label>
                <input type="number" min="1" value={purchaseQty} onChange={e => setPurchaseQty(Number(e.target.value))} className={`w-full border p-2 rounded text-sm ${inputBg}`} />
              </div>
              <div>
                <label className="text-xs opacity-75 block mb-1">Costo Unitario (Q)</label>
                <input type="number" step="0.01" value={purchaseCost} onChange={e => setPurchaseCost(e.target.value)} placeholder="0.00" className={`w-full border p-2 rounded text-sm ${inputBg}`} />
              </div>

              <button 
                onClick={addProductToPurchaseCart} 
                disabled={uploadingImage || addingToCart} 
                className="sm:col-span-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed py-2 rounded text-sm font-bold text-white shadow transition-all"
              >
                {uploadingImage || addingToCart ? 'Procesando...' : '+ Agregar al Detalle'}
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[35vh]">
              {purchaseCart.length === 0 ? (
                <p className="opacity-75 text-sm text-center py-6">No hay artículos agregados.</p>
              ) : (
                purchaseCart.map(item => (
                  <div key={item.id} className={`p-3 rounded border flex justify-between items-center text-sm ${subPanelBg}`}>
                    <div>
                      <p className="font-bold">{item.name} {item.is_custom && <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded ml-1">Personalizable</span>}</p>
                      <p className="text-xs opacity-85">Cant: <span className="text-emerald-500 font-bold">{item.quantity}</span> x Q {item.cost}</p>
                    </div>
                    <span className="font-bold text-emerald-500 text-base" translate="no">Q {(item.quantity * item.cost).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB HISTORIAL Y CUENTAS POR PAGAR */}
      {activeTab === 'history' && (
        <div className={`p-5 rounded-lg border space-y-4 ${panelBg}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-base font-bold text-emerald-500">Historial de Compras y Cuentas por Pagar</h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs opacity-75">Filtrar Sucursal:</span>
              <select value={historyBranchFilter} onChange={e => { setHistoryBranchFilter(e.target.value); loadPurchasesHistory(businessId, e.target.value); }} className={`border p-2 rounded text-xs ${inputBg} w-full sm:w-48`}>
                <option value="ALL">🏢 Todas las Sucursales</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {purchasesHistory.length === 0 ? (
              <p className="opacity-75 text-sm text-center py-8">No hay compras registradas.</p>
            ) : (
              purchasesHistory.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => openPurchaseDetailsModal(p)}
                  className={`p-4 rounded border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-sm cursor-pointer transition-all hover:border-emerald-500 ${subPanelBg}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-base text-emerald-400">Proveedor: {p.supplier_name || 'General'}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        p.status === 'Pagado' ? 'bg-emerald-950 text-emerald-400' : 
                        p.status === 'Parcial' ? 'bg-amber-950 text-amber-400' : 'bg-red-950 text-red-400'
                      }`}>
                        {p.status || 'Pagado'}
                      </span>
                      <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-semibold">📍 {p.branch_name}</span>
                    </div>
                    <p className="text-xs opacity-80">Factura: <span className="text-amber-500 font-mono">{p.invoice_number}</span> | Fecha: {new Date(p.created_at).toLocaleString()}</p>
                    {p.payment_method === 'Crédito' ? (
                      <p className="text-xs font-semibold text-amber-400">
                        Crédito Vence: {p.due_date || 'N/A'} | Saldo Pendiente: <strong className="text-red-400">Q {p.balance ?? p.total_amount}</strong>
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-emerald-400">Pago al Contado</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end" onClick={e => e.stopPropagation()}>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="block text-[10px] opacity-75">Total Factura</span>
                        <span className="font-bold text-slate-300 text-sm" translate="no">Q {p.total_amount}</span>
                      </div>
                      {p.payment_method === 'Crédito' && p.status !== 'Pagado' && (
                        <div className="pl-3 border-l border-slate-700">
                          <span className="block text-[10px] opacity-75">Saldo Actual</span>
                          <span className="font-extrabold text-red-400 text-base" translate="no">Q {p.balance}</span>
                        </div>
                      )}
                    </div>
                    {p.payment_method === 'Crédito' && p.status !== 'Pagado' && (
                      <button onClick={() => setSelectedPurchaseForPayment(p)} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-xs font-bold text-white shadow">
                        💳 Registrar Abono
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MENÚ LATERAL DESLIZANTE (☰) CON Z-INDEX MÁXIMO ABSOLUTO */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 flex z-[999999]" style={{ zIndex: 999999 }} onClick={() => setIsDrawerOpen(false)}>
          <div 
            className={`w-[380px] md:w-[420px] h-full p-6 flex flex-col shadow-2xl border-r ${panelBg}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-opacity-50">
              <h2 className="text-lg font-bold text-emerald-500">🛠️ Navegación General</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-xl font-bold opacity-75 hover:opacity-100 p-1">✕</button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
              <div className="space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Módulos Permitidos</p>
                
                <button onClick={() => { setIsDrawerOpen(false); router.push('/inventario'); }} className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>📋 Ir al Inventario</span>
                  <span>➔</span>
                </button>

                {staffRole.toLowerCase() === 'dueño' || staffRole.toLowerCase() === 'admin' ? (
                  <>
                    <button onClick={() => { setIsDrawerOpen(false); router.push('/cajero'); }} className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                      <span>💵 Módulo de Caja</span>
                      <span>➔</span>
                    </button>
                    <button onClick={() => { setIsDrawerOpen(false); router.push('/compras'); }} className="w-full bg-amber-600 hover:bg-amber-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                      <span>📦 Módulo de Compras</span>
                      <span>➔</span>
                    </button>
                  </>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-[11px] italic">
                    🔒 Las opciones de Caja y Administración general están restringidas para tu rol ({staffRole}).
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-opacity-50 space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Sesión</p>
                <button onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left">
                  🚪 Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLES DE COMPRA Y ABONOS CON Z-INDEX MÁXIMO ABSOLUTO */}
      {viewingPaymentsPurchase && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999999] p-4" style={{ zIndex: 999999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-2xl shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2 border-opacity-50">
              <div>
                <h3 className="text-base font-bold text-emerald-500">📦 Detalle de Compra y Abonos</h3>
                <p className="text-xs opacity-75">Factura: <span className="text-amber-400 font-mono">{viewingPaymentsPurchase.invoice_number}</span> | Saldo: <strong className="text-red-400">Q {viewingPaymentsPurchase.balance}</strong></p>
              </div>
              <button onClick={() => setViewingPaymentsPurchase(null)} className="font-bold text-base">✕</button>
            </div>

            {loadingModalData ? (
              <p className="text-center py-8 text-xs opacity-75">Cargando...</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-bold uppercase text-emerald-400 mb-2">🛒 Artículos en esta Factura</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {purchaseItemsList.map((item: any, idx: number) => (
                      <div key={item.id || idx} className={`p-2.5 rounded border text-xs flex justify-between items-center ${subPanelBg}`}>
                        <div>
                          <p className="font-bold">{item.product_name}</p>
                          <p className="opacity-75">Cant: {item.quantity} x Costo: Q {item.cost_price}</p>
                        </div>
                        <span className="font-bold text-emerald-400" translate="no">Q {(item.quantity * item.cost_price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase text-amber-400 mb-2">💳 Historial de Abonos</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {purchasePaymentsList.length === 0 ? (
                      <p className="text-xs opacity-75 italic">No hay abonos registrados.</p>
                    ) : (
                      purchasePaymentsList.map((pay: any, idx: number) => (
                        <div key={pay.id || idx} className={`p-2.5 rounded border text-xs space-y-1 ${subPanelBg}`}>
                          <div className="flex justify-between font-bold text-sm">
                            <span className="text-emerald-400">Abono #{idx + 1}</span>
                            <span className="text-emerald-500">Q {pay.amount}</span>
                          </div>
                          <p className="opacity-80">Método: <strong>{pay.payment_method}</strong> | Ref: {pay.reference || 'N/A'}</p>
                          <p className="text-[10px] opacity-60">Fecha: {new Date(pay.created_at).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button onClick={() => setViewingPaymentsPurchase(null)} className="bg-slate-600 px-5 py-2 rounded text-xs font-bold text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR ABONO CON Z-INDEX MÁXIMO ABSOLUTO */}
      {selectedPurchaseForPayment && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999999] p-4" style={{ zIndex: 999999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-emerald-500">💳 Registrar Abono a Proveedor</h3>
              <button onClick={() => setSelectedPurchaseForPayment(null)} className="font-bold">✕</button>
            </div>
            <div className={`p-3 rounded border text-xs space-y-1 ${subPanelBg}`}>
              <p className="font-bold">Factura: {selectedPurchaseForPayment.invoice_number}</p>
              <p className="text-amber-400 font-bold text-sm">Saldo Pendiente: Q {selectedPurchaseForPayment.balance}</p>
            </div>
            <form onSubmit={handleRegisterPayment} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs mb-1 opacity-75">Monto del Abono (Q) *</label>
                <input type="number" step="0.01" max={selectedPurchaseForPayment.balance} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" className={`w-full border p-2.5 rounded text-sm ${inputBg}`} required autoFocus />
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-75">Forma de Pago</label>
                <select value={paymentMethodType} onChange={e => setPaymentMethodType(e.target.value)} className={`w-full border p-2.5 rounded text-sm ${inputBg}`}>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1 opacity-75">Referencia / No. de Boleta</label>
                <input type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Ej. REF-12345" className={`w-full border p-2.5 rounded text-sm ${inputBg}`} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submittingPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded text-sm font-bold text-white">
                  {submittingPayment ? 'Procesando...' : 'Confirmar Abono'}
                </button>
                <button type="button" onClick={() => setSelectedPurchaseForPayment(null)} className="bg-slate-600 px-4 py-2.5 rounded text-sm text-white">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CATEGORÍA CON Z-INDEX MÁXIMO ABSOLUTO */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999999] p-4" style={{ zIndex: 999999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-emerald-500">✨ Nueva Categoría</h3>
              <button onClick={() => setShowNewCategoryModal(false)} className="font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-sm">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nombre de categoría..." className={`w-full border p-2.5 rounded text-sm ${inputBg}`} required autoFocus />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingCategory} className="flex-1 bg-emerald-600 py-2.5 rounded font-bold text-white">Guardar</button>
                <button type="button" onClick={() => setShowNewCategoryModal(false)} className="bg-slate-600 px-4 py-2.5 rounded text-white">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}