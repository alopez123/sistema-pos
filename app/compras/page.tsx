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

  // Estados para Categorías, Nuevos Productos e Imagen
  const [categories, setCategories] = useState<any[]>([])
  const [newProdName, setNewProdName] = useState('')
  const [newProdPrice, setNewProdPrice] = useState('')
  const [newProdCategory, setNewProdCategory] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Estados para el Modal de Creación Rápida de Categorías
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  // Estados para Proveedores
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supName, setSupName] = useState('')
  const [supContact, setSupContact] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [supAddress, setSupAddress] = useState('')

  // Estados para Registrar Compra
  const [products, setProducts] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseCart, setPurchaseCart] = useState<any[]>([])
  const [selectedProductToAdd, setSelectedProductToAdd] = useState('')
  const [purchaseQty, setPurchaseQty] = useState(1)
  const [purchaseCost, setPurchaseCost] = useState('')
  const [purchasesHistory, setPurchasesHistory] = useState<any[]>([])

  useEffect(() => {
    try {
      const staffDataStr = localStorage.getItem('currentStaff')
      const bizStr = localStorage.getItem('currentBusiness')

      let bId = ''
      let brId = ''

      if (staffDataStr) {
        const staff = JSON.parse(staffDataStr)
        bId = staff.business_id || staff.busines_id || ''
        brId = staff.branch_id || ''
      } else if (bizStr) {
        const biz = JSON.parse(bizStr)
        bId = biz.id || biz.business_id || biz.busines_id || ''
      }

      setBusinessId(bId)
      setBranchId(brId)

      if (bId) {
        loadBranches(bId)
        loadSuppliers(bId)
        loadPurchasesHistory(bId)
        loadCategories(bId)
      }
      if (brId) {
        loadProducts(brId)
      }
    } catch (e) {
      console.error("Error al cargar sesión:", e)
    }
  }, [])

  const loadBranches = async (bId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('business_id', bId)
    if (data) {
      setBranches(data)
      if (data.length > 0 && !branchId) {
        setBranchId(data[0].id)
        loadProducts(data[0].id)
      }
    }
  }

  const loadCategories = async (bId: string) => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', bId)
      .order('name', { ascending: true })

    if (!error && data) {
      setCategories(data)
    }
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
      alert("Error al crear categoría: " + error.message)
    } else {
      alert("¡Categoría creada con éxito!")
      await loadCategories(businessId)
      if (data && data.category_id) {
        setNewProdCategory(data.category_id)
      }
      setNewCategoryName('')
      setShowNewCategoryModal(false)
    }
  }

  const loadSuppliers = async (bId: string) => {
    const { data, error } = await supabase.rpc('get_suppliers_safe', { p_business_id: bId })
    if (!error && data) {
      setSuppliers(data)
    }
  }

  const loadProducts = async (bBranchId: string) => {
    const { data } = await supabase.rpc('get_products_by_branch', { p_branch_id: bBranchId })
    if (data) setProducts(data)
  }

  const loadPurchasesHistory = async (bId: string) => {
    const { data, error } = await supabase.rpc('get_purchases_history_safe', { p_business_id: bId })
    if (!error && data) {
      const formatted = data.map((p: any) => ({
        ...p,
        supplier: { name: p.supplier_name || 'General' }
      }))
      setPurchasesHistory(formatted)
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

    if (error) {
      alert("Error al crear proveedor: " + error.message)
    } else {
      alert("¡Proveedor registrado con éxito!")
      setSupName('')
      setSupContact('')
      setSupPhone('')
      setSupEmail('')
      setSupAddress('')
      loadSuppliers(businessId)
    }
  }

  const addProductToPurchaseCart = async () => {
    const qty = Number(purchaseQty) || 1
    const cost = parseFloat(purchaseCost) || 0

    if (selectedProductToAdd === 'NEW') {
      if (!newProdName.trim() || !newProdPrice || !branchId) {
        return alert("Ingresa el nombre y el precio de venta del nuevo producto.")
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

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('products')
              .getPublicUrl(filePath)
            imageUrl = publicUrlData.publicUrl
          }
        }

        const { error } = await supabase.rpc('add_product_safe', {
          p_name: newProdName.trim(),
          p_price: parseFloat(newProdPrice) || 0,
          p_stock: 0,
          p_branch_id: branchId,
          p_image_url: imageUrl,
          p_category_id: newProdCategory || null
        })

        if (error) {
          setUploadingImage(false)
          return alert("Error al crear el nuevo producto: " + error.message)
        }

        const { data: updatedProducts } = await supabase.rpc('get_products_by_branch', { p_branch_id: branchId })
        if (updatedProducts) setProducts(updatedProducts)

        const createdProd = updatedProducts?.find((p: any) => p.name.toLowerCase() === newProdName.trim().toLowerCase())

        if (!createdProd) {
          setUploadingImage(false)
          return alert("Producto creado, selecciónalo de la lista para agregarlo a la compra.")
        }

        setPurchaseCart(prev => {
          const existing = prev.find(item => item.id === createdProd.id)
          if (existing) {
            return prev.map(item => item.id === createdProd.id ? { ...item, quantity: item.quantity + qty, cost } : item)
          }
          return [...prev, { ...createdProd, quantity: qty, cost }]
        })

        setSelectedProductToAdd('')
        setNewProdName('')
        setNewProdPrice('')
        setNewProdCategory('')
        setImageFile(null)
        setImagePreview(null)
        setPurchaseQty(1)
        setPurchaseCost('')

      } catch (err) {
        console.error("Error al procesar imagen o producto:", err)
        alert("Ocurrió un error al procesar el producto nuevo.")
      } finally {
        setUploadingImage(false)
      }

    } else {
      if (!selectedProductToAdd) return alert("Selecciona un producto.")
      const prod = products.find(p => p.id === selectedProductToAdd)
      if (!prod) return

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
  }

  const totalPurchaseAmount = purchaseCart.reduce((acc, item) => acc + (item.cost * item.quantity), 0)

  const handleSavePurchase = async () => {
    if (!selectedSupplier) return alert("Selecciona un proveedor.")
    if (purchaseCart.length === 0) return alert("Agrega al menos un producto a la orden de compra.")

    try {
      const itemsPayload = purchaseCart.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        cost_price: item.cost
      }))

      const { error } = await supabase.rpc('register_purchase_safe', {
        p_business_id: businessId,
        p_branch_id: branchId,
        p_supplier_id: selectedSupplier,
        p_invoice_number: invoiceNumber.trim() || 'S/N',
        p_total_amount: totalPurchaseAmount,
        p_items: itemsPayload
      })

      if (error) throw error

      alert("¡Compra registrada, inventario y movimientos sincronizados con éxito!")
      setPurchaseCart([])
      setInvoiceNumber('')
      setSelectedSupplier('')
      loadPurchasesHistory(businessId)
      loadProducts(branchId)
      setActiveTab('history')
    } catch (err: any) {
      alert("Error al registrar la compra: " + err.message)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-6 text-white flex flex-col notranslate" translate="no">
      
      {/* HEADER */}
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border border-slate-700">
        <h1 className="text-xl font-bold text-emerald-400">📦 Módulo de Proveedores y Compras</h1>
        <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors">
          ← Volver al POS
        </button>
      </header>

      {/* PESTAÑAS */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button 
          onClick={() => setActiveTab('suppliers')} 
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'suppliers' ? 'bg-emerald-600 text-white' : 'bg-[#1e293b] text-slate-300 border border-slate-700'}`}
        >
          👥 Proveedores
        </button>
        <button 
          onClick={() => setActiveTab('newPurchase')} 
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'newPurchase' ? 'bg-emerald-600 text-white' : 'bg-[#1e293b] text-slate-300 border border-slate-700'}`}
        >
          ➕ Registrar Compra / Ingreso
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'history' ? 'bg-emerald-600 text-white' : 'bg-[#1e293b] text-slate-300 border border-slate-700'}`}
        >
          📋 Historial de Compras
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleCreateSupplier} className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 space-y-3 h-fit">
            <h2 className="text-base font-bold text-emerald-400 mb-2">Nuevo Proveedor</h2>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Empresa / Proveedor *</label>
              <input type="text" value={supName} onChange={e => setSupName(e.target.value)} placeholder="Ej. Distribuidora El Tornillo" className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm outline-none focus:border-emerald-500" required />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Persona de Contacto</label>
              <input type="text" value={supContact} onChange={e => setSupContact(e.target.value)} placeholder="Nombre del agente" className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Teléfono</label>
              <input type="text" value={supPhone} onChange={e => setSupPhone(e.target.value)} placeholder="Teléfono" className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Correo Electrónico</label>
              <input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} placeholder="correo@proveedor.com" className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Dirección</label>
              <input type="text" value={supAddress} onChange={e => setSupAddress(e.target.value)} placeholder="Ubicación" className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm outline-none" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded font-bold text-sm mt-2">Guardar Proveedor</button>
          </form>

          <div className="lg:col-span-2 bg-[#1e293b] p-5 rounded-lg border border-slate-700">
            <h2 className="text-base font-bold text-emerald-400 mb-3">Directorio de Proveedores</h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {suppliers.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No hay proveedores registrados.</p>
              ) : (
                suppliers.map(s => (
                  <div key={s.id} className="bg-[#0f172a] p-3.5 rounded border border-slate-700 flex justify-between items-center text-sm">
                    <div>
                      <p className="font-bold text-white text-base">{s.name}</p>
                      <p className="text-xs text-slate-300">Contacto: {s.contact_person || 'N/A'} | Tel: {s.phone || 'N/A'}</p>
                      <p className="text-xs text-slate-400">Dir: {s.address || 'N/A'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'newPurchase' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700 space-y-4">
            <h2 className="text-base font-bold text-emerald-400">Datos de la Factura / Compra</h2>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Sucursal Destino</label>
              <select value={branchId} onChange={e => { setBranchId(e.target.value); loadProducts(e.target.value); }} className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm">
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Proveedor *</label>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm">
                <option value="">-- Selecciona Proveedor --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">No. de Factura / Documento</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ej. F-98765" className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-sm" />
            </div>

            <div className="pt-4 border-t border-slate-700">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-slate-300">Total Compra:</span>
                <span className="text-xl font-extrabold text-emerald-400" translate="no">Q {totalPurchaseAmount.toFixed(2)}</span>
              </div>
              <button onClick={handleSavePurchase} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-bold text-sm shadow">
                💾 Registrar Compra e Ingresar al Inventario
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-[#1e293b] p-5 rounded-lg border border-slate-700 flex flex-col gap-4">
            <h2 className="text-base font-bold text-emerald-400">Agregar Artículos a la Compra</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-[#0f172a] p-3 rounded border border-slate-700">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Producto</label>
                <select value={selectedProductToAdd} onChange={e => setSelectedProductToAdd(e.target.value)} className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-sm">
                  <option value="">-- Seleccionar Producto --</option>
                  <option value="NEW">✨ [+ Crear Nuevo Producto]</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                </select>
              </div>

              {selectedProductToAdd === 'NEW' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">Nombre Nuevo Producto *</label>
                    <input type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)} placeholder="Nombre del artículo" className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Precio Venta (Q) *</label>
                    <input type="number" step="0.01" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-sm" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-slate-400">Categoría</label>
                      <button 
                        type="button" 
                        onClick={() => setShowNewCategoryModal(true)} 
                        className="text-emerald-400 hover:text-emerald-300 font-bold text-[10px]"
                      >
                        + Crear Nueva
                      </button>
                    </div>
                    <select value={newProdCategory} onChange={e => setNewProdCategory(e.target.value)} className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-sm">
                      <option value="">-- Sin Categoría --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-full">
                    <label className="text-xs text-slate-400 block mb-1">Imagen del Producto</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-600 px-4 py-2 rounded text-xs font-semibold transition-colors shadow flex items-center gap-2">
                        📷 Seleccionar Imagen
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageChange} 
                          className="hidden" 
                        />
                      </label>
                      <span className="text-xs text-slate-300 truncate max-w-xs">
                        {imageFile ? imageFile.name : 'Ningún archivo seleccionado'}
                      </span>
                    </div>
                    {imagePreview && (
                      <div className="mt-2 relative w-20 h-20 bg-slate-900 rounded border border-slate-600 overflow-hidden shadow">
                        <img src={imagePreview} alt="Vista previa" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-slate-400 block mb-1">Cantidad</label>
                <input type="number" min="1" value={purchaseQty} onChange={e => setPurchaseQty(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Costo Unitario (Q)</label>
                <input type="number" step="0.01" value={purchaseCost} onChange={e => setPurchaseCost(e.target.value)} placeholder="0.00" className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-sm" />
              </div>
              <button onClick={addProductToPurchaseCart} disabled={uploadingImage} className="sm:col-span-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-2 rounded text-sm font-bold mt-1">
                {uploadingImage ? 'Subiendo imagen...' : '+ Agregar al Detalle'}
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[35vh]">
              {purchaseCart.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No hay artículos agregados a la orden.</p>
              ) : (
                purchaseCart.map(item => (
                  <div key={item.id} className="bg-[#0f172a] p-3 rounded border border-slate-700 flex justify-between items-center text-sm">
                    <div>
                      <p className="font-bold text-white">{item.name}</p>
                      <p className="text-xs text-slate-300">Cant: <span className="text-emerald-400 font-bold">{item.quantity}</span> x Q {item.cost}</p>
                    </div>
                    <span className="font-bold text-emerald-400 text-base" translate="no">Q {(item.quantity * item.cost).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-[#1e293b] p-5 rounded-lg border border-slate-700">
          <h2 className="text-base font-bold text-emerald-400 mb-4">Historial de Compras Realizadas</h2>
          <div className="space-y-2 max-h-[65vh] overflow-y-auto">
            {purchasesHistory.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No hay compras registradas.</p>
            ) : (
              purchasesHistory.map(p => (
                <div key={p.id} className="bg-[#0f172a] p-4 rounded border border-slate-700 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-bold text-white text-base">Proveedor: {p.supplier?.name || 'General'}</p>
                    <p className="text-xs text-slate-300">Factura: <span className="text-amber-300 font-mono">{p.invoice_number}</span> | Fecha: {new Date(p.created_at).toLocaleString()}</p>
                  </div>
                  <span className="font-extrabold text-emerald-400 text-lg" translate="no">Q {p.total_amount}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- MODAL PARA CREAR NUEVA CATEGORÍA --- */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-sm text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="text-base font-bold text-emerald-400">✨ Nueva Categoría</h3>
              <button onClick={() => setShowNewCategoryModal(false)} className="text-slate-400 hover:text-white font-bold text-base">✕</button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Nombre (ej. Herramientas, Construcción)</label>
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="Nombre de la categoría..." 
                  className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm outline-none focus:border-emerald-500" 
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
                  className="bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded text-sm text-slate-200"
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