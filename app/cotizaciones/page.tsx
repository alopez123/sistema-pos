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
      const bizStr = localStorage.getItem('currentBusiness')

      let bId = ''
      let brId = ''

      if (staffDataStr) {
        const staff = JSON.parse(staffDataStr)
        bId = staff.business_id || ''
        brId = staff.branch_id || ''
      } else if (bizStr) {
        const biz = JSON.parse(bizStr)
        bId = biz.id || biz.business_id || ''
      }

      setBusinessId(bId)
      setBranchId(brId)

      if (bId) loadBranches(bId)

      if (brId) {
        loadProducts(brId)
      } else if (bId) {
        loadProductsByBusiness(bId)
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

  // Función de impresión segura compatible con iPhone / iOS
  const handlePrintQuoteMobile = () => {
    const activeBranchName = branches.find(b => b.id === branchId)?.name || 'Sucursal Principal'
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cotización</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
              h1 { text-align: center; font-size: 18px; margin: 0 0 5px 0; text-transform: uppercase; }
              h2 { text-align: center; font-size: 14px; margin: 0 0 15px 0; border-bottom: 2px solid #000; padding-bottom: 8px; }
              .info { font-size: 11px; background: #f9f9f9; padding: 8px; border: 1px solid #ddd; margin-bottom: 15px; line-height: 1.4; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: 11px; }
              th { border-bottom: 2px solid #000; font-weight: bold; }
              .text-right { text-align: right; }
              .total { text-align: right; font-weight: bold; margin-top: 15px; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>${activeBranchName}</h1>
            <h2>COTIZACIÓN / PROFORMA</h2>
            
            <div class="info">
              <div><b>NIT:</b> ${nit || 'C/F'}</div>
              <div><b>Nombre o Razón Social:</b> ${nombre || 'Consumidor Final'}</div>
              ${direccion ? `<div><b>Dirección:</b> ${direccion}</div>` : ''}
              ${telefono ? `<div><b>Teléfono:</b> ${telefono}</div>` : ''}
              ${correo ? `<div><b>Correo:</b> ${correo}</div>` : ''}
              <div><b>Fecha:</b> ${new Date().toLocaleString()}</div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Cant.</th>
                  <th>Descripción</th>
                  <th class="text-right">Precio U.</th>
                  <th class="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${cart.map(item => `
                  <tr>
                    <td><b>${item.quantity}</b></td>
                    <td>${item.name}</td>
                    <td class="text-right">Q ${item.price.toFixed(2)}</td>
                    <td class="text-right"><b>Q ${(item.price * item.quantity).toFixed(2)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total">Total Cotización: Q ${totalAmount.toFixed(2)}</div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 500);
      }, 500);
    }
  }

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
      // 1. Guardar o actualizar cliente automáticamente con todos sus datos
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .upsert({
          business_id: businessId,
          nit: nit.trim(),
          name: nombre.trim(),
          address: direccion.trim(),
          phone: telefono.trim(),
          email: correo.trim()
        }, { onConflict: 'business_id, nit' })
        .select('id')
        .single()

      if (customerError) throw customerError
      const customerId = customerData?.id

      // 2. Crear la cotización
      const { data: quoteData, error: quoteError } = await supabase.from('quotes').insert([{
        business_id: businessId, 
        branch_id: branchId || branches[0]?.id, 
        customer_id: customerId, 
        nit: nit.trim(), 
        customer_name: nombre.trim(), 
        total_amount: totalAmount
      }]).select('id').single()

      if (quoteError) throw quoteError

      // 3. Registrar los ítems de la cotización
      const quoteItemsPayload = cart.map(item => ({
        quote_id: quoteData.id, 
        product_id: item.id, 
        quantity: item.quantity, 
        price_at_quote: item.price
      }))

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsPayload)
      if (itemsError) throw itemsError

      // Llamada de impresión optimizada para iPhone y navegadores móviles
      handlePrintQuoteMobile()

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
    <div className="min-h-screen bg-[#0f172a] p-6 text-white flex flex-col notranslate" translate="no">
      
      {/* Cabecera Web */}
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex justify-between items-center border border-slate-700">
        <h1 className="text-xl font-bold text-emerald-400">Nueva Cotización / Proforma</h1>
        <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors">
          ← Volver al POS
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* COLUMNA 1: FORMULARIO Y RESUMEN */}
        <div className="bg-[#1e293b] p-5 rounded-lg shadow border border-slate-700 flex flex-col gap-4">
          
          {/* Formulario Web de Datos */}
          <div className="space-y-4">
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
          <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col justify-between flex-1">
            <div>
              <h2 className="text-md font-bold text-emerald-400 mb-3 border-b border-slate-700 pb-2">Detalle de Artículos</h2>
              
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-4">No hay productos agregados.</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="bg-[#0f172a] p-2 rounded border border-slate-700 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-slate-400" translate="no">Q {item.price} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold" translate="no">Q {item.price * item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="text-red-400 font-bold px-1.5 bg-slate-800 rounded">×</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <span className="text-base font-bold text-slate-300">Total Cotización:</span>
                <span className="text-xl font-extrabold text-emerald-400" translate="no">Q {totalAmount.toFixed(2)}</span>
              </div>
              
              <button onClick={handleGuardarYGenerarPDF} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50">
                {loading ? 'Generando...' : '💾 Guardar y Generar PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNAS 2 y 3: Catálogo Web */}
        <div className="lg:col-span-2 bg-[#1e293b] p-6 rounded-lg shadow border border-slate-700 flex flex-col">
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
                      <span className="text-emerald-400 font-bold" translate="no">Q {p.price}</span>
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
                    <span className="text-emerald-400 font-extrabold text-sm sm:text-base" translate="no">Q {p.price}</span>
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