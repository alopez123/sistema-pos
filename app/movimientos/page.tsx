'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function PosPage() {
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [isStaff, setIsStaff] = useState(false)
  const router = useRouter()

  // Estados para el buscador y autocompletado
  const [searchTerm, setSearchTerm] = useState('')
  const [otherStoresSearch, setOtherStoresSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Estados para el menú operativo izquierdo
  const [activeTab, setActiveTab] = useState<'ticket' | 'addProduct' | 'otherStores' | 'transfers' | 'movements'>('ticket')
  const [allStoreProducts, setAllStoreProducts] = useState<any[]>([])

  // Estados específicos para Traslados y Movimientos
  const [businessIdState, setBusinessIdState] = useState<string>('')
  const [transfersList, setTransfersList] = useState<any[]>([])
  const [transferProduct, setTransferProduct] = useState<any>(null)
  const [transferQuantity, setTransferQuantity] = useState(1)
  const [branchMovements, setBranchMovements] = useState<any[]>([])

  // Estados inteligentes para la pestaña Agregar / Reabastecer
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<string>('')
  const [addMoreQuantity, setAddMoreQuantity] = useState<number>(1)

  // Formulario rápido para nuevo producto (con imagen y compresión)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newStock, setNewStock] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    const staffStr = localStorage.getItem('currentStaff')
    const bizStr = localStorage.getItem('currentBusiness')

    if (staffStr) {
      try {
        const staff = JSON.parse(staffStr)
        if (staff.branch_id) {
          setIsStaff(true)
          setSelectedBranch(staff.branch_id)
          setBranches([{ id: staff.branch_id, name: staff.branch_name || 'Sucursal Asignada' }])
          loadProducts(staff.branch_id)
          
          if (staff.business_id) {
            setBusinessIdState(staff.business_id)
            loadOtherStoresProducts(staff.business_id, staff.branch_id)
            loadTransfers(staff.business_id, staff.branch_id)
            loadMovements(staff.branch_id)
          } else {
            supabase
              .from('branches')
              .select('business_id')
              .eq('id', staff.branch_id)
              .single()
              .then(({ data }) => {
                if (data?.business_id) {
                  setBusinessIdState(data.business_id)
                  loadOtherStoresProducts(data.business_id, staff.branch_id)
                  loadTransfers(data.business_id, staff.branch_id)
                  loadMovements(staff.branch_id)
                }
              })
          }
          return
        }
      } catch (e) {
        console.error("Error al parsear currentStaff", e)
      }
    }

    if (bizStr) {
      try {
        const biz = JSON.parse(bizStr)
        const businessId = biz.id || biz.business_id
        if (businessId) {
          setBusinessIdState(businessId)
          loadBranches(businessId)
          return
        }
      } catch (e) {
        console.error("Error al parsear currentBusiness", e)
      }
    }

    router.push('/')
  }, [router])
  
  // Cerrar sugerencias al hacer clic fuera del buscador
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      loadProducts(data[0].id)
      loadOtherStoresProducts(businessId, data[0].id)
      loadTransfers(businessId, data[0].id)
      loadMovements(data[0].id)
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
      p_business_id: businessId
    })
    if (!error && data) {
      setAllStoreProducts(data.filter((p: any) => p.branch_id !== currentBranchId))
    }
  }

  async function loadTransfers(businessId: string, currentBranchId: string) {
    const { data, error } = await supabase
      .from('inventory_transfers')
      .select('*, product:products(name), source:branches!source_branch_id(name), dest:branches!destination_branch_id(name)')
      .eq('business_id', businessId)
      .or(`source_branch_id.eq.${currentBranchId},destination_branch_id.eq.${currentBranchId}`)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTransfersList(data)
    }
  }

  async function loadMovements(branchId: string) {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, product:products(name)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setBranchMovements(data)
    }
  }
  
  const handleBranchChange = (branchId: string) => {
    if (isStaff) return
    setSelectedBranch(branchId)
    loadProducts(branchId)
    loadMovements(branchId)
    if (businessIdState) {
      loadOtherStoresProducts(businessIdState, branchId)
      loadTransfers(businessIdState, branchId)
    }
    setCart([])
  }

  const addToCart = (product: any) => {
    if (product.stock <= 0) {
      alert("Producto sin existencias.")
      return
    }

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
        return [...prevCart, { ...product, quantity: 1 }]
      }
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId))
  }

  const totalCart = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)

  async function processCheckout() {
    if (cart.length === 0) return

    for (const item of cart) {
      const { error } = await supabase.rpc('make_sale_safe', {
        p_product_id: item.id,
        p_branch_id: selectedBranch,
        p_quantity: item.quantity,
        p_business_id: businessIdState
      })

      if (error) {
        alert(`Error al vender ${item.name}: ` + error.message)
        return
      }
    }

    alert("¡Venta procesada con éxito!")
    setCart([])
    loadProducts(selectedBranch)
    loadMovements(selectedBranch)
    if (businessIdState) {
      loadOtherStoresProducts(businessIdState, selectedBranch)
    }
  }

  // Manejador inteligente para Agregar / Reabastecer Stock
  const handleAddOrRestockProduct = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedExistingProduct === 'NEW') {
      // Crear nuevo producto
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
          p_image_url: imageUrl
        })

        if (error) {
          alert("Error al agregar producto: " + error.message)
        } else {
          alert("¡Producto agregado al catálogo con éxito!")
          setNewName('')
          setNewPrice('')
          setNewStock('')
          setImageFile(null)
          setImagePreview(null)
          setSelectedExistingProduct('')
          loadProducts(selectedBranch)
          loadMovements(selectedBranch)
          if (businessIdState) loadOtherStoresProducts(businessIdState, selectedBranch)
          setActiveTab('ticket')
        }
      } catch (err) {
        console.error("Error en el proceso:", err)
        alert("Ocurrió un error inesperado al procesar el producto.")
      } finally {
        setUploadingImage(false)
      }

    } else {
      // Reabastecer stock de producto existente
      if (!selectedExistingProduct) {
        return alert("Selecciona un producto del catálogo o elige 'Crear nuevo'.")
      }

      if (addMoreQuantity <= 0) {
        return alert("Ingresa una cantidad válida a sumar.")
      }

      const { error } = await supabase.rpc('add_stock_to_product', {
        p_product_id: selectedExistingProduct,
        p_quantity: Number(addMoreQuantity),
        p_branch_id: selectedBranch
      })

      if (error) {
        alert("Error al reabastecer stock: " + error.message)
      } else {
        alert("¡Stock actualizado y movimiento de ingreso registrado con éxito!")
        setSelectedExistingProduct('')
        setAddMoreQuantity(1)
        loadProducts(selectedBranch)
        loadMovements(selectedBranch)
        setActiveTab('ticket')
      }
    }
  }

  // Lógica para enviar solicitud de traslado
  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferProduct || transferQuantity <= 0) {
      alert("Selecciona un producto y una cantidad válida.")
      return
    }

    if (transferQuantity > transferProduct.stock) {
      alert("La cantidad solicitada supera el stock disponible en la tienda origen.")
      return
    }

    const { error } = await supabase.from('inventory_transfers').insert({
      business_id: businessIdState,
      product_id: transferProduct.id,
      source_branch_id: transferProduct.branch_id,
      destination_branch_id: selectedBranch,
      quantity: Number(transferQuantity),
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

  // Aceptar y completar traslado (la tienda origen procesa)
  const handleCompleteTransfer = async (transferId: string) => {
    const { error } = await supabase.rpc('complete_transfer', {
      transfer_id: transferId,
      current_biz_id: businessIdState
    })

    if (error) {
      alert("Error al procesar el traslado: " + error.message)
    } else {
      alert("¡Traslado completado con éxito! Inventarios actualizados.")
      loadTransfers(businessIdState, selectedBranch)
      loadProducts(selectedBranch)
      loadMovements(selectedBranch)
      loadOtherStoresProducts(businessIdState, selectedBranch)
    }
  }

  // Función para comprimir imagen antes de subirla
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredOtherStores = allStoreProducts.filter(p =>
    p.name.toLowerCase().includes(otherStoresSearch.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-white flex flex-col notranslate" translate="no">
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex justify-between items-center border border-slate-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Punto de Venta (POS)</h1>
          <select 
            value={selectedBranch} 
            onChange={e => handleBranchChange(e.target.value)}
            disabled={isStaff}
            className="bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-white outline-none focus:border-emerald-500 font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <button onClick={handleExit} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-semibold text-sm">
          {isStaff ? 'Cerrar Sesión' : 'Volver al Panel'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        
        {/* Columna 1: Menú Operativo Izquierdo */}
        <div className="bg-[#1e293b] p-5 rounded-lg shadow border border-slate-700 flex flex-col">
          <h2 className="text-md font-bold text-emerald-400 mb-3">Opciones Operativas</h2>
          
          <div className="grid grid-cols-2 gap-1 mb-4 bg-[#0f172a] p-1 rounded border border-slate-700 text-[11px]">
            <button 
              onClick={() => setActiveTab('addProduct')} 
              className={`py-2 px-1 rounded font-semibold text-center transition-colors ${activeTab === 'addProduct' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              ➕ Agregar
            </button>
            <button 
              onClick={() => setActiveTab('otherStores')} 
              className={`py-2 px-1 rounded font-semibold text-center transition-colors ${activeTab === 'otherStores' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              🏬 Otras Tiendas
            </button>
            <button 
              onClick={() => setActiveTab('transfers')} 
              className={`py-2 px-1 rounded font-semibold text-center transition-colors ${activeTab === 'transfers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              🔄 Traslados
            </button>
            <button 
              onClick={() => setActiveTab('movements')} 
              className={`py-2 px-1 rounded font-semibold text-center transition-colors ${activeTab === 'movements' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              📊 Movimientos
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[58vh] pr-1">
            {activeTab === 'ticket' && (
              <div className="text-center text-slate-400 text-xs py-12">
                Selecciona una opción arriba para agregar inventario, consultar red, gestionar traslados o ver movimientos.
              </div>
            )}

            {activeTab === 'addProduct' && (
              <form onSubmit={handleAddOrRestockProduct} className="space-y-3 text-xs">
                <p className="text-emerald-400 font-semibold mb-2">Ingresar Inventario / Producto</p>
                
                <div>
                  <label className="block text-slate-400 mb-1">Seleccionar Producto</label>
                  <select 
                    value={selectedExistingProduct}
                    onChange={e => setSelectedExistingProduct(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white text-xs"
                  >
                    <option value="">-- Selecciona una opción --</option>
                    <option value="NEW">✨ [+ Crear Nuevo Producto]</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>📦 {p.name} (Stock actual: {p.stock})</option>
                    ))}
                  </select>
                </div>

                {/* Si elige un producto existente, solo pide cantidad a sumar */}
                {selectedExistingProduct && selectedExistingProduct !== 'NEW' && (
                  <div>
                    <label className="block text-slate-400 mb-1">Cantidad a Agregar (Ingreso)</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={addMoreQuantity} 
                      onChange={e => setAddMoreQuantity(Number(e.target.value))} 
                      className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white" 
                      required 
                    />
                  </div>
                )}

                {/* Si elige crear nuevo producto, despliega formulario completo */}
                {selectedExistingProduct === 'NEW' && (
                  <div className="space-y-3 border-t border-slate-700 pt-3 mt-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Nombre del Nuevo Producto</label>
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. Plato Extra" className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white" required />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Precio (Q)</label>
                      <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.00" className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white" required />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Stock Inicial</label>
                      <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} placeholder="0" className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white" />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Imagen del Producto</label>
                      <input type="file" accept="image/*" onChange={handleImageChange} className="w-full bg-[#0f172a] border border-slate-600 p-1.5 rounded text-white text-[10px]" />
                      {imagePreview && (
                        <div className="mt-2 relative w-full h-24 bg-[#0f172a] rounded border border-slate-600 overflow-hidden">
                          <img src={imagePreview} alt="Vista previa" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedExistingProduct && (
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={uploadingImage} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2 rounded font-bold text-white">
                      {uploadingImage ? 'Guardando...' : 'Guardar y Registrar Ingreso'}
                    </button>
                    <button type="button" onClick={() => { setSelectedExistingProduct(''); setActiveTab('ticket'); }} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-white">Cancelar</button>
                  </div>
                )}
              </form>
            )}

            {activeTab === 'otherStores' && (
              <div className="space-y-3 text-xs">
                <p className="text-emerald-400 font-semibold mb-1">Inventario en Red (Otras Sucursales)</p>
                <input 
                  type="text"
                  value={otherStoresSearch}
                  onChange={e => setOtherStoresSearch(e.target.value)}
                  placeholder="🔍 Buscar en otras sucursales..."
                  className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white text-xs outline-none focus:border-emerald-500"
                />

                {filteredOtherStores.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No hay registros coincidentes.</p>
                ) : (
                  filteredOtherStores.map((p, idx) => (
                    <div key={idx} className="bg-[#0f172a] p-2.5 rounded border border-slate-700 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-[10px] text-amber-400 font-medium">Sucursal: {p.branch_name}</p>
                        <p className="text-[10px] text-slate-400">Stock: <span className="text-emerald-400 font-bold">{p.stock}</span></p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-emerald-400" translate="no">Q {p.price}</span>
                        <button 
                          onClick={() => {
                            setTransferProduct(p)
                            setTransferQuantity(1)
                            setActiveTab('transfers')
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-[10px] px-2 py-1 rounded text-white font-semibold"
                        >
                          Solicitar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className="space-y-3 text-xs">
                <p className="text-emerald-400 font-semibold mb-1">Módulo de Traslados</p>
                
                {transferProduct && (
                  <form onSubmit={handleRequestTransfer} className="bg-[#0f172a] p-3 rounded border border-emerald-500/50 space-y-2 mb-3">
                    <p className="font-bold text-white">Solicitar: {transferProduct.name}</p>
                    <p className="text-[10px] text-slate-400">Origen: {transferProduct.branch_name} (Stock: {transferProduct.stock})</p>
                    <div>
                      <label className="block text-slate-400 mb-1">Cantidad a solicitar:</label>
                      <input 
                        type="number" 
                        min="1" 
                        max={transferProduct.stock} 
                        value={transferQuantity} 
                        onChange={e => setTransferQuantity(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-600 p-1.5 rounded text-white text-xs" 
                        required
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1.5 rounded font-bold text-white">Enviar Solicitud</button>
                      <button type="button" onClick={() => setTransferProduct(null)} className="bg-slate-700 hover:bg-slate-600 px-2 py-1.5 rounded text-white">Cancelar</button>
                    </div>
                  </form>
                )}

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Historial de solicitudes y traslados activos entre sucursales:
                </p>

                <div className="space-y-2">
                  {transfersList.length === 0 ? (
                    <div className="bg-[#0f172a] p-3 rounded border border-slate-700 text-center py-6">
                      <p className="text-slate-500 text-xs">No hay traslados registrados.</p>
                    </div>
                  ) : (
                    transfersList.map((t) => (
                      <div key={t.id} className="bg-[#0f172a] p-2.5 rounded border border-slate-700 space-y-1">
                        <div className="flex justify-between font-semibold text-white">
                          <span>{t.product?.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.status === 'completado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {t.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">De: <span className="text-slate-300">{t.source?.name}</span> → Para: <span className="text-slate-300">{t.dest?.name}</span></p>
                        <p className="text-[10px] text-slate-400">Cantidad: <span className="text-emerald-400 font-bold">{t.quantity}</span></p>
                        
                        {t.status === 'pendiente' && t.source_branch_id === selectedBranch && (
                          <button 
                            onClick={() => handleCompleteTransfer(t.id)}
                            className="mt-2 w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] py-1 rounded font-semibold"
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
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-emerald-400 font-semibold">Movimientos (Cuadre)</p>
                  <button 
                    onClick={() => loadMovements(selectedBranch)} 
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600"
                  >
                    🔄 Actualizar
                  </button>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Registro de ventas y traslados de esta sucursal para tu cuadre diario:
                </p>

                <div className="space-y-2">
                  {branchMovements.length === 0 ? (
                    <div className="bg-[#0f172a] p-3 rounded border border-slate-700 text-center py-6">
                      <p className="text-slate-500 text-xs">No hay movimientos registrados en esta sucursal.</p>
                    </div>
                  ) : (
                    branchMovements.map((m) => (
                      <div key={m.id} className="bg-[#0f172a] p-2.5 rounded border border-slate-700 space-y-1">
                        <div className="flex justify-between font-semibold text-white">
                          <span>{m.product?.name || 'Producto'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            m.quantity < 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span className="uppercase tracking-wider font-semibold text-amber-300/80">{m.movement_type}</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {activeTab !== 'ticket' && (
            <button onClick={() => setActiveTab('ticket')} className="mt-3 w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded text-xs font-semibold">
              ← Volver al Ticket
            </button>
          )}
        </div>

        {/* Columna 2 y 3: Catálogo de Productos con Buscador y Autocompletado */}
        <div className="lg:col-span-2 bg-[#1e293b] p-6 rounded-lg shadow border border-slate-700 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-emerald-400">Catálogo de Productos (Matriz)</h2>
          </div>

          <div className="relative mb-4" ref={searchRef}>
            <input 
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="🔍 Buscar producto por nombre..."
              className="w-full bg-[#0f172a] border border-slate-600 px-4 py-2.5 rounded-lg text-white text-sm outline-none focus:border-emerald-500 transition-colors"
            />

            {showSuggestions && searchTerm.trim() !== '' && (
              <div className="absolute left-0 right-0 mt-1 bg-[#0f172a] border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">No se encontraron productos</div>
                ) : (
                  filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addToCart(p)
                        setSearchTerm('')
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex justify-between items-center border-b border-slate-800/60 transition-colors text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{p.name}</span>
                        <span className="text-slate-400 ml-2 text-[10px]">(Stock: {p.stock})</span>
                      </div>
                      <span className="text-emerald-400 font-bold" translate="no">Q {p.price}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[62vh] pr-1">
            {filteredProducts.length === 0 ? (
              <p className="text-slate-400 col-span-full text-center py-10">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="bg-[#0f172a] border border-slate-700 hover:border-emerald-500 p-3 rounded-lg flex flex-col justify-between text-left transition-all shadow hover:shadow-emerald-500/10 group overflow-hidden"
                >
                  <div>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover rounded mb-2 border border-slate-700" />
                    ) : (
                      <div className="w-full h-24 bg-[#1e293b] rounded mb-2 flex items-center justify-center text-xs text-slate-500 border border-slate-700/50">Sin imagen</div>
                    )}
                    <span className="text-xs text-slate-400 block mb-0.5">Stock: {p.stock}</span>
                    <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 text-xs">{p.name}</h3>
                  </div>
                  <span className="mt-2 text-emerald-400 font-extrabold text-sm" translate="no">Q {p.price}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Columna 4: Ticket de Venta Actual (Derecha) */}
        <div className="bg-[#1e293b] p-5 rounded-lg shadow border border-slate-700 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-emerald-400 mb-4">Ticket de Venta</h2>
            <div className="space-y-3 overflow-y-auto max-h-[48vh] pr-1">
              {cart.length === 0 ? (
                <p className="text-slate-400 text-center py-10 text-sm">El carrito está vacío.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-[#0f172a] p-3 rounded border border-slate-700 text-xs">
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-slate-400 text-[10px]">Cant: {item.quantity} x Q {item.price}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400" translate="no">Q {item.price * item.quantity}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300 font-bold px-1">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4 mt-4">
            <div className="flex justify-between items-center mb-4 text-lg font-bold">
              <span>Total:</span>
              <span className="text-emerald-400" translate="no">Q {totalCart}</span>
            </div>
            <button 
              onClick={processCheckout}
              disabled={cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-lg font-bold shadow transition-colors text-sm"
            >
              Completar Venta / Cobrar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}