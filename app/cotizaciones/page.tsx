'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function NuevaCotizacionPage() {
  const router = useRouter()

  const [businessId, setBusinessId] = useState<string>('')
  const [branchId, setBranchId] = useState<string>('')
  const [branches, setBranches] = useState<any[]>([])
  
  // Datos del cliente
  const [nit, setNit] = useState('')
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')

  // Productos y carrito
  const [products, setProducts] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [cart, setCart] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const staffDataStr = localStorage.getItem('currentStaff')
      if (staffDataStr) {
        const staff = JSON.parse(staffDataStr)
        const bId = staff.business_id || ''
        const brId = staff.branch_id || ''

        setBusinessId(bId)
        setBranchId(brId)

        if (bId) loadBranches(bId)

        if (brId) {
          loadProducts(brId)
        } else if (bId) {
          loadProductsByBusiness(bId)
        }
      }
    } catch (e) {
      console.error("Error al leer la sesión:", e)
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadBranches = async (bId: string) => {
    const { data } = await supabase.from('branches').select('*').eq('business_id', bId)
    if (data) setBranches(data)
  }

  const loadProducts = async (branchIdToLoad: string) => {
    const { data } = await supabase.from('products').select('*').eq('branch_id', branchIdToLoad)
    if (data) setProducts(data)
  }

  const loadProductsByBusiness = async (businessIdToLoad: string) => {
    const { data } = await supabase.from('products').select('*').eq('tenant_id', businessIdToLoad)
    if (data) setProducts(data)
  }

  const handleNitBlur = async () => {
    if (!nit.trim() || !businessId) return
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('nit', nit.trim())
      .single()

    if (data) {
      setNombre(data.name || '')
      setDireccion(data.address || '')
      setTelefono(data.phone || '')
      setCorreo(data.email || '')
    }
  }

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
    } else {
      setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item))
    }
  }

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)

  const handleGuardarYGenerarPDF = async () => {
    if (!nit.trim() || !nombre.trim()) {
      alert('Por favor complete los campos obligatorios del cliente (NIT, Nombre).')
      return
    }

    if (cart.length === 0) {
      alert('Por favor agregue al menos un producto al detalle de la cotización.')
      return
    }

    setLoading(true)
    try {
      let customerId = null
      const { data: existingCustomer } = await supabase.from('customers').select('id').eq('business_id', businessId).eq('nit', nit.trim()).single()

      if (existingCustomer) {
        customerId = existingCustomer.id
        await supabase.from('customers').update({ name: nombre, address: direccion, phone: telefono, email: correo }).eq('id', customerId)
      } else {
        const { data: newCustomer, error: custError } = await supabase.from('customers').insert([{ business_id: businessId, nit: nit.trim(), name: nombre, address: direccion, phone: telefono, email: correo }]).select('id').single()
        if (custError) throw custError
        if (newCustomer) customerId = newCustomer.id
      }

      const { data: quoteData, error: quoteError } = await supabase.from('quotes').insert([{
          business_id: businessId, branch_id: branchId || branches[0]?.id, customer_id: customerId, nit: nit.trim(), customer_name: nombre, total_amount: totalAmount
        }]).select('id').single()

      if (quoteError) throw quoteError

      const quoteItemsPayload = cart.map(item => ({
        quote_id: quoteData.id, product_id: item.id, quantity: item.quantity, price_at_quote: item.price
      }))

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsPayload)
      if (itemsError) throw itemsError

      window.print()

      alert('¡Cotización guardada exitosamente y cliente actualizado!')
      router.push('/pos')
    } catch (err: any) {
      console.error(err)
      alert('Error al guardar la cotización: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const activeBranchName = branches.find(b => b.id === branchId)?.name || 'Sucursal Principal'

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-white flex flex-col print:bg-white print:text-black print:p-8">
      
      {/* Cabecera Web (Oculta en PDF) */}
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex justify-between items-center border border-slate-700 print:hidden">
        <h1 className="text-xl font-bold text-emerald-400">Nueva Cotización / Proforma</h1>
        <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors">
          ← Volver al POS
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 print:block">
        
        {/* COLUMNA 1: FORMULARIO Y RESUMEN */}
        <div className="bg-[#1e293b] p-5 rounded-lg shadow border border-slate-700 flex flex-col gap-4 print:bg-transparent print:border-none print:shadow-none print:p-0">
          
          {/* === DISEÑO FORMAL EXCLUSIVO PARA EL PDF === */}
          <div className="hidden print:block w-full mb-6">
            <h1 className="text-2xl font-extrabold text-center uppercase tracking-wider text-black mb-1">
              {activeBranchName}
            </h1>
            <h2 className="text-sm font-bold text-center border-b-2 border-black pb-3 mb-5 text-slate-700">
              COTIZACIÓN / PROFORMA
            </h2>
            
            {/* Datos del cliente alineados a la izquierda */}
            <div className="text-left text-xs text-black leading-relaxed space-y-0.5 bg-slate-50 p-3 border border-slate-300 rounded">
              <p><span className="font-bold">NIT:</span> {nit || 'C/F'}</p>
              <p><span className="font-bold">Nombre o Razón Social:</span> {nombre || 'Consumidor Final'}</p>
              {direccion && <p><span className="font-bold">Dirección:</span> {direccion}</p>}
              {telefono && <p><span className="font-bold">Teléfono:</span> {telefono}</p>}
              {correo && <p><span className="font-bold">Correo:</span> {correo}</p>}
            </div>
          </div>
          {/* =========================================== */}

          {/* Formulario Web de Datos (Oculto en PDF) */}
          <div className="print:hidden space-y-4">
            <h2 className="text-md font-bold text-emerald-400 border-b border-slate-700 pb-2">Datos del Cliente</h2>
            <div>
              <label className="text-xs text-slate-400 block mb-1">NIT *</label>
              <input type="text" value={nit} onChange={e => setNit(e.target.value)} onBlur={handleNitBlur} placeholder="Ej. 123456-7 o C/F" className="w-full bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-sm outline-none focus:border-emerald-500"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nombre / Razón Social *</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del cliente o empresa" className="w-full bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-sm outline-none focus:border-emerald-500"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Dirección</label>
              <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección fiscal o entrega" className="w-full bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-sm outline-none focus:border-emerald-500"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Teléfono</label>
              <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Número de contacto" className="w-full bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-sm outline-none focus:border-emerald-500"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Correo Electrónico</label>
              <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" className="w-full bg-[#0f172a] border border-slate-600 px-3 py-2 rounded text-sm outline-none focus:border-emerald-500"/>
            </div>
          </div>

          {/* Artículos Cotizados */}
          <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col justify-between flex-1 print:border-none print:mt-0 print:pt-0">
            <div>
              <h2 className="text-md font-bold text-emerald-400 mb-3 border-b border-slate-700 pb-2 print:text-black print:border-black print:text-sm uppercase">Detalle de Artículos</h2>
              
              {/* Vista normal web */}
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1 print:hidden">
                {cart.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-4">No hay productos agregados.</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="bg-[#0f172a] p-2 rounded border border-slate-700 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-slate-400">Q {item.price} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">Q {item.price * item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="text-red-400 font-bold px-1.5 bg-slate-800 rounded">×</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* === ESTILO DE TABLA LINEAL FORMAL EXCLUSIVO PARA EL PDF === */}
              <div className="hidden print:block w-full">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black text-black">
                      <th className="py-1.5 px-1">Cant.</th>
                      <th className="py-1.5 px-2">Descripción del Producto</th>
                      <th className="py-1.5 px-1 text-right">Precio U.</th>
                      <th className="py-1.5 px-1 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id} className="border-b border-slate-200 text-black">
                        <td className="py-2 px-1 font-semibold">{item.quantity}</td>
                        <td className="py-2 px-2">{item.name}</td>
                        <td className="py-2 px-1 text-right">Q {item.price.toFixed(2)}</td>
                        <td className="py-2 px-1 text-right font-bold">Q {(item.price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* ========================================================== */}

            </div>

            <div className="mt-4 pt-4 border-t border-slate-700 print:border-black print:pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-base font-bold text-slate-300 print:text-black print:text-sm">Total Cotización:</span>
                <span className="text-xl font-extrabold text-emerald-400 print:text-black print:text-base">Q {totalAmount.toFixed(2)}</span>
              </div>
              
              <button onClick={handleGuardarYGenerarPDF} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50 print:hidden">
                {loading ? 'Generando...' : '💾 Guardar y Generar PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNAS 2 y 3: Catálogo Web (Oculto en PDF) */}
        <div className="lg:col-span-2 bg-[#1e293b] p-6 rounded-lg shadow border border-slate-700 flex flex-col print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-emerald-400">Catálogo de Productos (Matriz)</h2>
          </div>

          <div className="relative mb-4" ref={searchRef}>
            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="🔍 Buscar producto por nombre..." className="w-full bg-[#0f172a] border border-slate-600 px-4 py-2.5 rounded-lg text-white text-sm outline-none focus:border-emerald-500 transition-colors" />
            
            {showSuggestions && searchTerm.trim() !== '' && (
              <div className="absolute left-0 right-0 mt-1 bg-[#0f172a] border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">No se encontraron productos</div>
                ) : (
                  filteredProducts.map(p => (
                    <button key={p.id} onClick={() => { addToCart(p); setSearchTerm(''); setShowSuggestions(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex justify-between items-center border-b border-slate-800/60 transition-colors text-xs">
                      <div><span className="font-semibold text-white">{p.name}</span><span className="text-slate-400 ml-2 text-[10px]">(Stock: {p.stock})</span></div>
                      <span className="text-emerald-400 font-bold">Q {p.price}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[65vh] pr-1">
            {filteredProducts.length === 0 ? (
              <p className="text-slate-400 col-span-full text-center py-10">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} className="bg-[#0f172a] border border-slate-700 hover:border-emerald-500 p-3 rounded-lg flex flex-col justify-between text-left transition-all shadow hover:shadow-emerald-500/10 group cursor-pointer h-full">
                  <div className="flex flex-col">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover rounded mb-2 border border-slate-700" /> : <div className="w-full h-24 bg-[#1e293b] rounded mb-2 flex items-center justify-center text-xs text-slate-500 border border-slate-700/50">Sin imagen</div>}
                    <span className="text-[11px] text-slate-400 block mb-0.5">Stock: {p.stock}</span>
                    <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 text-xs leading-snug">{p.name}</h3>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase">Precio</span>
                    <span className="text-emerald-400 font-extrabold text-sm sm:text-base">Q {p.price}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}