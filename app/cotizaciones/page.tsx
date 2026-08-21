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
  
  const [businessLogo, setBusinessLogo] = useState<string | null>(null)
  
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const [nit, setNit] = useState('')
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')

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
        bId = staff.business_id || staff.busines_id || ''
        brId = staff.branch_id || ''
      } else if (bizStr) {
        const biz = JSON.parse(bizStr)
        bId = biz.id || biz.business_id || biz.busines_id || ''
      }

      setBusinessId(bId)
      setBranchId(brId)

      const fetchLogoUsingRpc = async (targetBranchId?: string, targetBizId?: string) => {
        const { data, error } = await supabase.rpc('get_business_logo_info', {
          p_branch_id: targetBranchId || null,
          p_business_name: targetBranchId ? null : 'Comedor'
        })

        if (!error && data && data.length > 0 && data[0].logo_url) {
          setBusinessLogo(data[0].logo_url)
          if (data[0].business_id && !bId) setBusinessId(data[0].business_id)
          return
        }

        if (targetBizId) {
          const { data: bizData } = await supabase.from('businesses').select('logo_url').eq('id', targetBizId).single()
          if (bizData?.logo_url) {
            setBusinessLogo(bizData.logo_url)
            return
          }
        }

        const { data: fallbackBiz } = await supabase.from('businesses').select('logo_url').eq('name', 'Comedor').single()
        if (fallbackBiz?.logo_url) {
          setBusinessLogo(fallbackBiz.logo_url)
        }
      }

      fetchLogoUsingRpc(brId, bId)

      if (bId) {
        loadBranches(bId)
        loadCategories(bId)
      }

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

  // CORREGIDO: Uso de get_products_by_branch igual que el POS para asegurar que traiga category_id
  const loadProducts = async (branchIdToLoad: string) => {
    const { data, error } = await supabase.rpc('get_products_by_branch', { p_branch_id: branchIdToLoad })
    if (!error && data) {
      setProducts(data)
    } else {
      console.error("Error cargando productos en cotización:", error?.message)
    }
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

  const handlePrintQuoteMobile = () => {
    const activeBranchName = branches.find(b => b.id === branchId)?.name || 'Sucursal Principal'
    const logoToPrint = businessLogo || '';
    
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
              body { font-family: Arial, sans-serif; padding: 20px; color: #000; display: flex; flex-direction: column; min-height: 90vh; }
              .content { flex: 1; }
              .header-container { text-align: center; margin-bottom: 15px; }
              .logo { height: 50px; width: auto; object-fit: contain; margin-bottom: 5px; display: block; margin-left: auto; margin-right: auto; }
              h1 { font-size: 16px; margin: 0 0 2px 0; text-transform: uppercase; }
              h2 { font-size: 13px; margin: 0 0 12px 0; border-bottom: 2px solid #000; padding-bottom: 6px; text-align: center; }
              .info { font-size: 11px; background: #f9f9f9; padding: 8px; border: 1px solid #ddd; margin-bottom: 15px; line-height: 1.4; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: 11px; }
              th { border-bottom: 2px solid #000; font-weight: bold; }
              .text-right { text-align: right; }
              .total { text-align: right; font-weight: bold; margin-top: 15px; font-size: 14px; }
              .footer { text-align: center; font-size: 11px; font-style: italic; color: #555; margin-top: 40px; border-top: 1px dashed #ccc; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="content">
              <div class="header-container">
                ${logoToPrint ? `<img src="${logoToPrint}" class="logo" crossorigin="anonymous" />` : ''}
                <h1>${activeBranchName}</h1>
              </div>
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
            </div>

            <div class="footer">
              Esta cotización tiene validez durante 24 horas, luego de eso puede estar sujeta a cambios.
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 800);
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

      const { data: quoteData, error: quoteError } = await supabase.from('quotes').insert([{
        business_id: businessId, 
        branch_id: branchId || branches[0]?.id, 
        customer_id: customerId, 
        nit: nit.trim(), 
        customer_name: nombre.trim(), 
        total_amount: totalAmount
      }]).select('id').single()

      if (quoteError) throw quoteError

      const quoteItemsPayload = cart.map(item => ({
        quote_id: quoteData.id, 
        product_id: item.id, 
        quantity: item.quantity, 
        price_at_quote: item.price
      }))

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsPayload)
      if (itemsError) throw itemsError

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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-6 text-white flex flex-col notranslate" translate="no">
      
      {/* Cabecera Responsive con Logotipo */}
      <header className="bg-[#1e293b] p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border border-slate-700">
        <div className="flex items-center gap-3">
          {businessLogo ? (
            <img src={businessLogo} alt="Logo" className="w-12 h-12 object-contain bg-[#0f172a] rounded-lg p-1 border border-slate-600 shadow" />
          ) : (
            <div className="w-12 h-12 bg-[#0f172a] rounded-lg flex items-center justify-center text-[10px] text-slate-500 border border-slate-600">POS</div>
          )}
          <h1 className="text-lg sm:text-xl font-bold text-emerald-400">Nueva Cotización / Proforma</h1>
        </div>
        <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors text-center">
          ← Volver al POS
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* COLUMNA 1: FORMULARIO Y RESUMEN */}
        <div className="bg-[#1e293b] p-4 sm:p-5 rounded-lg shadow border border-slate-700 flex flex-col gap-4 justify-between">
          
          <div className="space-y-3">
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

          <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col justify-between">
            <div>
              <h2 className="text-md font-bold text-emerald-400 mb-3 border-b border-slate-700 pb-2">Detalle de Artículos</h2>
              
              <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1">
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

              <p className="text-[10px] text-slate-400 text-center mt-3 italic">
                * Esta cotización tiene validez durante 24 horas, luego de eso puede estar sujeta a cambios.
              </p>
            </div>
          </div>
        </div>

        {/* COLUMNAS 2 y 3: Catálogo Web y Táctil con Buscador, Categorías y Feedback Táctil */}
        <div className="lg:col-span-2 bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow border border-slate-700 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-bold text-emerald-400">Catálogo de Productos (Matriz)</h2>
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

          {/* PESTAÑAS DE FILTRADO POR CATEGORÍA */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === null ? 'bg-emerald-600 text-white shadow' : 'bg-[#0f172a] text-slate-300 hover:bg-slate-800 border border-slate-700'
              }`}
            >
              ✨ Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id ? 'bg-emerald-600 text-white shadow' : 'bg-[#0f172a] text-slate-300 hover:bg-slate-800 border border-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* TARJETAS DE PRODUCTOS CON FEEDBACK TÁCTIL Y RESPONSIVE */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto max-h-[55vh] pr-1">
            {filteredProducts.length === 0 ? (
              <p className="text-slate-400 col-span-full text-center py-10">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => addToCart(p)} 
                  className="bg-[#0f172a] border border-slate-700 hover:border-emerald-500 active:scale-95 active:bg-emerald-950/40 active:border-emerald-400 p-3 rounded-lg flex flex-col justify-between text-left transition-all duration-150 shadow hover:shadow-emerald-500/10 group cursor-pointer h-full select-none"
                >
                  <div className="flex flex-col">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover rounded mb-2 border border-slate-700 pointer-events-none" />
                    ) : (
                      <div className="w-full h-24 bg-[#1e293b] rounded mb-2 flex items-center justify-center text-xs text-slate-500 border border-slate-700/50">Sin imagen</div>
                    )}
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