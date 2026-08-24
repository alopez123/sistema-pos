'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function InventarioPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string>('')
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Estado para el Menú Lateral Deslizante (Hamburguesa ☰)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('inventory_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('inventory_theme', newMode ? 'dark' : 'light')
  }

  // Estado para verificar si es rol Bodega
  const [isBodega, setIsBodega] = useState(false)

  // Estados para Modal de Ajuste de Stock
  const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)
  const [adjustQuantity, setAdjustQuantity] = useState<string>('1')
  const [adjustReason, setAdjustReason] = useState<string>('Se rompió / merma')

  // Estados para Modal de Historial de Movimientos y Pestañas
  const [showMovementsModal, setShowMovementsModal] = useState(false)
  const [branchMovements, setBranchMovements] = useState<any[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [movementTab, setMovementTab] = useState<string>('todos')

  useEffect(() => {
    try {
      const staffDataStr = localStorage.getItem('currentStaff')
      const bizStr = localStorage.getItem('currentBusiness')

      let bId = ''
      let brId = ''

      if (staffDataStr) {
        const staff = JSON.parse(staffDataStr)
        if (staff.role && staff.role.trim().toLowerCase() === 'bodega') {
          setIsBodega(true)
        }
        bId = staff.business_id || staff.busines_id || ''
        brId = staff.branch_id || ''
      } else if (bizStr) {
        const biz = JSON.parse(bizStr)
        bId = biz.id || biz.business_id || biz.busines_id || ''
      }

      setBusinessId(bId)

      if (bId) {
        loadBranches(bId)
        loadCategories(bId)
      }
    } catch (e) {
      console.error("Error al cargar sesión:", e)
    }
  }, [])

  const loadBranches = async (bId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('business_id', bId)
    if (data && data.length > 0) {
      setBranches(data)
      setSelectedBranch(data[0].id)
      loadInventory(data[0].id)
    }
  }

  const loadCategories = async (bId: string) => {
    const { data } = await supabase.from('categories').select('*').eq('business_id', bId).order('name', { ascending: true })
    if (data) setCategories(data)
  }

  const loadInventory = async (branchId: string) => {
    const { data, error } = await supabase.rpc('get_products_by_branch', { p_branch_id: branchId })
    if (!error && data) {
      setProducts(data)
    }
  }

  const loadMovements = async (branchId: string) => {
    setLoadingMovements(true)
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*, product:products(name)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(100)

    setLoadingMovements(false)
    if (!error && data) {
      setBranchMovements(data)
    }
  }

  const handleBranchChange = (branchId: string) => {
    setSelectedBranch(branchId)
    loadInventory(branchId)
  }

  const handleQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedQty = Number(adjustQuantity)
    if (!adjustingProduct || isNaN(parsedQty) || parsedQty === 0) return

    if (!adjustReason.trim()) {
      return alert("Por favor ingresa una justificación para el ajuste.")
    }

    const { error } = await supabase.rpc('add_stock_to_product', {
      p_branch_id: selectedBranch,
      p_product_id: adjustingProduct.id,
      p_quantity: parsedQty
    })

    if (error) {
      alert("Error al ajustar inventario: " + error.message)
    } else {
      alert("¡Inventario actualizado con éxito!")
      setAdjustingProduct(null)
      setAdjustQuantity('1')
      setAdjustReason('Se rompió / merma')
      loadInventory(selectedBranch)
    }
  } 

  const handleLogout = () => {
    localStorage.removeItem('currentStaff')
    localStorage.removeItem('currentBusiness')
    router.push('/')
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true
    return matchesSearch && matchesCategory
  })

  // Filtrado preciso de movimientos según la pestaña seleccionada
  const filteredMovements = branchMovements.filter(m => {
    const type = (m.movement_type || '').toLowerCase().trim()
    
    if (movementTab === 'todos') return true
    if (movementTab === 'venta') return type === 'venta' || type === 'sales'
    if (movementTab === 'ingreso') return type.includes('ingreso') || type.includes('compra')
    if (movementTab === 'ajuste') return type.includes('ajuste') || type.includes('manual')
    if (movementTab === 'traslado_salida') return type.includes('salida') || type.includes('traslado_salida')
    if (movementTab === 'traslado_entrada') return type.includes('entrada') || type.includes('traslado_entrada')
    
    return true
  })

  // Clases dinámicas según el tema (Modo Oscuro vs Modo Claro)
  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-2 md:p-4 flex flex-col notranslate pb-20 lg:pb-4 ${themeBg}`} translate="no">
      
      {/* BARRA SUPERIOR ADAPTABLE CON BOTÓN HAMBURGUESA (☰) */}
      <header className={`p-3 rounded-lg shadow mb-3 flex flex-wrap justify-between items-center gap-2 border w-full ${panelBg}`}>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center shadow transition-colors"
            title="Herramientas y Menú"
          >
            ☰
          </button>

          <div>
            <h1 className="text-xs md:text-sm font-bold leading-tight text-emerald-500">Administración de Inventario</h1>
            <select 
              value={selectedBranch} 
              onChange={e => handleBranchChange(e.target.value)}
              className={`border px-2 py-0.5 rounded-md font-semibold text-xs mt-1 outline-none focus:border-emerald-500 ${inputBg}`}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* BOTÓN INTERRUPTOR DE TEMA (SOLO ICONO COMO EN EL POS Y CAJA) */}
          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-lg text-sm font-semibold border transition-colors ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* FILTROS Y BÚSQUEDA */}
      <div className={`p-3 md:p-4 rounded-lg border mb-3 flex flex-col md:flex-row gap-3 justify-between items-center ${panelBg}`}>
        <input 
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="🔍 Buscar producto en inventario..."
          className={`w-full md:w-96 border p-2 rounded-lg text-xs md:text-sm outline-none focus:border-emerald-500 ${inputBg}`}
        />

        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === null ? 'bg-emerald-600 text-white' : `${subPanelBg} border`
            }`}
          >
            ✨ Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id ? 'bg-emerald-600 text-white' : `${subPanelBg} border`
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* TABLA DE INVENTARIO */}
      <div className={`rounded-lg border overflow-hidden flex-1 shadow ${panelBg}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-xs uppercase tracking-wider border-b ${subPanelBg}`}>
                <th className="p-3">Imagen</th>
                <th className="p-3">Producto</th>
                <th className="p-3">Precio Venta</th>
                <th className="p-3">Stock Actual</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-opacity-50 text-xs md:text-sm">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 opacity-75">
                    No se encontraron productos en esta sucursal.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-opacity-50 transition-colors">
                    <td className="p-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded border border-opacity-50" />
                      ) : (
                        <div className={`w-10 h-10 rounded flex items-center justify-center text-[10px] opacity-50 border ${subPanelBg}`}>Sin img</div>
                      )}
                    </td>
                    <td className="p-3 font-bold">{p.name}</td>
                    <td className="p-3 text-emerald-500 font-extrabold" translate="no">Q {p.price}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        p.stock <= 5 ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-600'
                      }`}>
                        {p.stock} un. {p.stock <= 5 && '⚠️'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => { setAdjustingProduct(p); setAdjustQuantity('1'); setAdjustReason('Se rompió / merma'); }}
                        className="bg-blue-600 hover:bg-blue-500 px-2.5 py-1.5 rounded text-xs font-bold text-white transition-colors shadow"
                      >
                        ⚡ Ajustar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MENÚ LATERAL DESLIZANTE (☰) CON HERRAMIENTAS AGRUPADAS */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 flex z-[9999]" onClick={() => setIsDrawerOpen(false)}>
          <div 
            className={`w-[380px] md:w-[420px] h-full p-6 flex flex-col shadow-2xl border-r ${panelBg}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-opacity-50">
              <h2 className="text-lg font-bold text-emerald-500">🛠️ Herramientas de Inventario</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-xl font-bold opacity-75 hover:opacity-100 p-1">✕</button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs">
              <div className="space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Operaciones y Módulos</p>
                <button 
                  onClick={() => {
                    setIsDrawerOpen(false);
                    router.push('/compras');
                  }} 
                  className="w-full bg-amber-700 hover:bg-amber-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between"
                >
                  <span>📦 Módulo de Compras</span>
                  <span>➔</span>
                </button>

                <button 
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setShowMovementsModal(true);
                    loadMovements(selectedBranch);
                  }} 
                  className="w-full bg-blue-700 hover:bg-blue-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between"
                >
                  <span>📊 Ver Historial de Movimientos</span>
                  <span>➔</span>
                </button>
              </div>

              <div className="pt-3 border-t border-opacity-50 space-y-2">
                <p className="font-bold text-emerald-500 text-sm">Navegación</p>
                {!isBodega && (
                  <button onClick={() => router.push('/pos')} className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left">
                    🛒 Volver al POS
                  </button>
                )}

                {isBodega && (
                  <button onClick={handleLogout} className="w-full bg-red-700 hover:bg-red-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left">
                    🚪 Cerrar Sesión
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL DE MOVIMIENTOS CON PESTAÑAS */}
      {showMovementsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-xl border border-blue-500 w-full max-w-3xl shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2 border-opacity-50">
              <h3 className="text-base font-bold text-blue-400">📊 Historial de Movimientos de Inventario</h3>
              <button onClick={() => setShowMovementsModal(false)} className="font-bold text-base opacity-75 hover:opacity-100">✕</button>
            </div>

            {/* Pestañas de Clasificación */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-opacity-50 scrollbar-thin">
              {[
                { id: 'todos', label: '✨ Todos' },
                { id: 'venta', label: '🛒 Venta' },
                { id: 'ingreso', label: '📦 Ingreso' },
                { id: 'ajuste', label: '⚡ Ajuste Manual' },
                { id: 'traslado_salida', label: '📤 Traslado Salida' },
                { id: 'traslado_entrada', label: '📥 Traslado Entrada' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMovementTab(tab.id)}
                  className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                    movementTab === tab.id ? 'bg-blue-600 text-white shadow' : `${subPanelBg} border`
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 text-xs">
              {loadingMovements ? (
                <p className="text-center py-8 opacity-75">Cargando movimientos...</p>
              ) : filteredMovements.length === 0 ? (
                <p className="text-center py-8 opacity-75">No hay movimientos registrados en esta categoría.</p>
              ) : (
                filteredMovements.map((m) => (
                  <div key={m.id} className={`p-3 rounded border space-y-1 ${subPanelBg}`}>
                    <div className="flex justify-between font-semibold text-xs">
                      <span>{m.product?.name || 'Producto'}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        m.quantity < 0 ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
                      }`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] opacity-75">
                      <span className="uppercase tracking-wider font-semibold text-amber-500">{m.movement_type}</span>
                      <span>{new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => setShowMovementsModal(false)} 
              className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg font-semibold text-xs mt-2"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE RÁPIDO DE STOCK */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className={`p-6 rounded-xl border border-emerald-500 w-full max-w-sm shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-2 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-500">⚡ Ajustar Stock</h3>
              <button onClick={() => setAdjustingProduct(null)} className="font-bold text-base opacity-75 hover:opacity-100">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-semibold text-sm">{adjustingProduct.name}</p>
              <p className="opacity-75">Stock Actual: <span className="text-emerald-500 font-bold">{adjustingProduct.stock}</span></p>

              <form onSubmit={handleQuickAdjust} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs mb-1 opacity-80">Cantidad a sumar o restar (ej. -2)</label>
                  <input 
                    type="text" 
                    value={adjustQuantity} 
                    onChange={e => setAdjustQuantity(e.target.value)} 
                    placeholder="Ej. 5 o -2"
                    className={`w-full border p-2.5 rounded text-xs outline-none focus:border-emerald-500 font-bold text-emerald-500 ${inputBg}`} 
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1 opacity-80">Motivo / Justificación *</label>
                  <select 
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    className={`w-full border p-2 rounded text-xs outline-none focus:border-emerald-500 mb-2 ${inputBg}`}
                  >
                    <option value="Se rompió / merma">Se rompió / merma</option>
                    <option value="Se lo robaron / faltante">Se lo robaron / faltante</option>
                    <option value="Conteo físico / ajuste">Conteo físico / ajuste</option>
                    <option value="Devolución de cliente">Devolución de cliente</option>
                    <option value="Otro motivo">Otro motivo</option>
                  </select>
                  
                  <input 
                    type="text" 
                    value={adjustReason} 
                    onChange={e => setAdjustReason(e.target.value)} 
                    placeholder="O escribe un detalle..."
                    className={`w-full border p-2 rounded text-xs outline-none focus:border-emerald-500 ${inputBg}`} 
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded text-xs font-bold text-white transition-colors shadow"
                  >
                    Guardar Ajuste
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setAdjustingProduct(null)} 
                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}