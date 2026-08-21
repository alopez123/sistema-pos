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

  // Estado para modal de ajuste rápido de stock y justificación
  const [adjustingProduct, setAdjustingProduct] = useState<any | null>(null)
  const [adjustQuantity, setAdjustQuantity] = useState<string>('1')
  const [adjustReason, setAdjustReason] = useState<string>('Se rompió / merma')

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

    // Llamamos a la función original que tu base de datos ya tiene creada y validada
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-6 text-white flex flex-col notranslate" translate="no">
      
      {/* HEADER */}
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border border-slate-700">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-emerald-400">📊 Administración de Inventario</h1>
          <select 
            value={selectedBranch} 
            onChange={e => handleBranchChange(e.target.value)}
            className="bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-white text-sm font-semibold outline-none focus:border-emerald-500"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/compras')} className="bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded text-sm font-semibold transition-colors">
            📦 Módulo de Compras
          </button>
          <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors">
            ← Volver al POS
          </button>
        </div>
      </header>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="bg-[#1e293b] p-4 rounded-lg border border-slate-700 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <input 
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="🔍 Buscar producto en inventario..."
          className="w-full md:w-96 bg-[#0f172a] border border-slate-600 p-2.5 rounded-lg text-sm text-white outline-none focus:border-emerald-500"
        />

        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === null ? 'bg-emerald-600 text-white' : 'bg-[#0f172a] text-slate-300 border border-slate-700'
            }`}
          >
            ✨ Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id ? 'bg-emerald-600 text-white' : 'bg-[#0f172a] text-slate-300 border border-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* TABLA DE INVENTARIO */}
      <div className="bg-[#1e293b] rounded-lg border border-slate-700 overflow-hidden flex-1 shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0f172a] text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                <th className="p-3.5">Imagen</th>
                <th className="p-3.5">Producto</th>
                <th className="p-3.5">Precio Venta</th>
                <th className="p-3.5">Stock Actual</th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    No se encontraron productos en esta sucursal.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3.5">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-12 h-12 object-cover rounded border border-slate-700" />
                      ) : (
                        <div className="w-12 h-12 bg-[#0f172a] rounded flex items-center justify-center text-[10px] text-slate-500 border border-slate-700">Sin img</div>
                      )}
                    </td>
                    <td className="p-3.5 font-bold text-white">{p.name}</td>
                    <td className="p-3.5 text-emerald-400 font-extrabold" translate="no">Q {p.price}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        p.stock <= 5 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {p.stock} unidades {p.stock <= 5 && '⚠️ (Crítico)'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button 
                        onClick={() => { setAdjustingProduct(p); setAdjustQuantity('1'); setAdjustReason('Se rompió / merma'); }}
                        className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-xs font-bold text-white transition-colors"
                      >
                        ⚡ Ajustar Stock
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE AJUSTE RÁPIDO DE STOCK */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" style={{ zIndex: 99999 }}>
          <div className="bg-[#1e293b] p-6 rounded-xl border border-emerald-500 w-full max-w-sm text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="text-base font-bold text-emerald-400">⚡ Ajustar Stock</h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-slate-400 hover:text-white font-bold text-base">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="font-semibold text-white">{adjustingProduct.name}</p>
              <p className="text-xs text-slate-300">Stock Actual: <span className="text-emerald-400 font-bold">{adjustingProduct.stock}</span></p>

              <form onSubmit={handleQuickAdjust} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Cantidad a sumar (o restar con negativo ej. -2)</label>
                  <input 
                    type="text" 
                    value={adjustQuantity} 
                    onChange={e => setAdjustQuantity(e.target.value)} 
                    placeholder="Ej. 5 o -2"
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm outline-none focus:border-emerald-500 font-bold text-emerald-400" 
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Motivo / Justificación *</label>
                  <select 
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm outline-none focus:border-emerald-500 mb-2"
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
                    className="w-full bg-[#0f172a] border border-slate-600 p-2 rounded text-white text-xs outline-none focus:border-emerald-500" 
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded text-sm font-bold text-white transition-colors"
                  >
                    Guardar Ajuste
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setAdjustingProduct(null)} 
                    className="bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded text-sm text-slate-200"
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