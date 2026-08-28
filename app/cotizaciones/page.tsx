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
  
  // Tema (Modo Oscuro / Modo Claro)
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Vista en dispositivos móviles
  const [mobileViewTab, setMobileViewTab] = useState<'form' | 'catalog'>('catalog')

  // SISTEMA DE TOASTS MODERNOS FLOTANTES
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => { setToast(null) }, 4500)
  }

  // MODAL DE PRODUCTO PERSONALIZADO
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [pendingCustomProduct, setPendingCustomProduct] = useState<any>(null)
  const [customNotesInput, setCustomNotesInput] = useState('')
  const [customPriceInput, setCustomPriceInput] = useState('')
  const [customEventDateInput, setCustomEventDateInput] = useState('')

  useEffect(() => {
    const savedTheme = localStorage.getItem('quotes_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('quotes_theme', newMode ? 'dark' : 'light')
  }
  
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

  // BÚSQUEDA INTELIGENTE DE CLIENTE EXISTENTE AL SALIR DEL NIT
  const handleNitBlur = async () => {
    const cleanNit = nit.trim()
    if (!cleanNit || !businessId) return

    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('nit', cleanNit)
        .maybeSingle()

      if (data) {
        setNombre(data.name || '')
        setDireccion(data.address || '')
        setTelefono(data.phone || '')
        setCorreo(data.email || '')
        showToast(`Cliente encontrado: ${data.name}`, 'info')
      }
    } catch (err) {
      console.error("Búsqueda de cliente:", err)
    }
  }

  const addToCart = (product: any) => {
    const isCustomByName = product.name && (
      product.name.toLowerCase().includes('vinil') || 
      product.name.toLowerCase().includes('personaliz') ||
      product.name.toLowerCase().includes('manta') ||
      product.name.toLowerCase().includes('evento')
    );

    if (!isCustomByName && product.stock <= 0) {
      showToast("⚠️ Este producto no tiene existencias disponibles (Stock 0).", 'error')
      return
    }
    
    if (isCustomByName) {
      setPendingCustomProduct(product);
      setCustomNotesInput('');
      setCustomPriceInput(product.price > 0 ? String(product.price) : '');
      setCustomEventDateInput('');
      setShowCustomModal(true);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && !item.notes)
      if (existing) {
        if (existing.quantity >= product.stock) {
          showToast("No puedes agregar más de las existencias disponibles.", 'error')
          return prev
        }
        return prev.map(item => item.id === product.id && !item.notes ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { ...product, quantity: 1, originalPrice: product.price, notes: '', eventDate: null }]
    })
  }

  const handleConfirmCustomProduct = () => {
    if (!customNotesInput.trim()) {
      showToast("Ingresa las medidas, notas o características.", 'error');
      return;
    }
    const customPrice = parseFloat(customPriceInput || '0');
    if (isNaN(customPrice) || customPrice < 0) {
      showToast("Ingresa un precio cotizado válido.", 'error');
      return;
    }

    setCart(prevCart => [
      ...prevCart,
      {
        ...pendingCustomProduct,
        id: pendingCustomProduct.id,
        name: pendingCustomProduct.name,
        notes: customNotesInput.trim(),
        eventDate: customEventDateInput || null,
        price: customPrice,
        quantity: 1
      }
    ]);

    setShowCustomModal(false);
    setPendingCustomProduct(null);
  }

  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
    } else {
      setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item))
    }
  }

  const handlePriceChange = (productId: string, newPriceText: string) => {
    const newPrice = parseFloat(newPriceText) || 0;
    setCart(prev => prev.map(item => item.id === productId ? { ...item, price: newPrice } : item));
  };

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
              th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: 11px; vertical-align: top; }
              th { border-bottom: 2px solid #000; font-weight: bold; }
              .text-right { text-align: right; }
              .notes { font-size: 10px; color: #444; margin-top: 2px; }
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
                    <th>Descripción y Detalles</th>
                    <th class="text-right">Precio U.</th>
                    <th class="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${cart.map(item => `
                    <tr>
                      <td><b>${item.quantity}</b></td>
                      <td>
                        <div>${item.name}</div>
                        ${item.notes ? `<div class="notes">📝 <b>Notas:</b> ${item.notes}</div>` : ''}
                        ${item.eventDate ? `<div class="notes">📅 <b>Entrega/Evento:</b> ${new Date(item.eventDate).toLocaleString()}</div>` : ''}
                      </td>
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

  // GUARDADO INTELIGENTE: CREA O ACTUALIZA CLIENTE Y REGISTRA LA COTIZACIÓN
  const handleGuardarYGenerarPDF = async () => {
    const cleanNit = nit.trim() || 'CF'
    const cleanName = nombre.trim()

    if (!cleanName) {
      showToast('Por favor ingrese el nombre o razón social del cliente.', 'error')
      return
    }

    if (cart.length === 0) {
      showToast('Por favor agregue al menos un producto a la cotización.', 'error')
      return
    }

    setLoading(true)
    try {
      // 1. Verificar si el cliente ya existe por NIT o crearlo automáticamente
      let customerId = null
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('business_id', businessId)
        .eq('nit', cleanNit)
        .maybeSingle()

      if (existingCustomer) {
        customerId = existingCustomer.id
        // Actualizar datos por si cambiaron
        await supabase.from('customers').update({
          name: cleanName,
          address: direccion.trim(),
          phone: telefono.trim(),
          email: correo.trim()
        }).eq('id', customerId)
      } else {
        // Crear nuevo cliente automáticamente
        const { data: newCustomer, error: newCustErr } = await supabase
          .from('customers')
          .insert({
            business_id: businessId,
            nit: cleanNit,
            name: cleanName,
            address: direccion.trim(),
            phone: telefono.trim(),
            email: correo.trim()
          })
          .select('id')
          .single()

        if (newCustErr) throw newCustErr
        customerId = newCustomer?.id
      }

      // 2. Registrar la cotización principal
      const { data: quoteData, error: quoteError } = await supabase.from('quotes').insert([{
        business_id: businessId, 
        branch_id: branchId || branches[0]?.id, 
        customer_id: customerId, 
        nit: cleanNit, 
        customer_name: cleanName, 
        total_amount: totalAmount
      }]).select('id').single()

      if (quoteError) throw quoteError

      // 3. Registrar los ítems de la cotización con notas y fecha de evento
      const quoteItemsPayload = cart.map(item => ({
        quote_id: quoteData.id, 
        product_id: item.id, 
        quantity: item.quantity, 
        price_at_quote: item.price,
        notes: item.notes || null,
        event_date: item.eventDate || null
      }))

      const { error: itemsError } = await supabase.from('quote_items').insert(quoteItemsPayload)
      if (itemsError) throw itemsError

      handlePrintQuoteMobile()

      showToast('✅ ¡Cotización guardada y PDF generado con éxito!')
      setTimeout(() => router.push('/pos'), 1500)
    } catch (err: any) {
      console.error(err)
      showToast('Error al guardar: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true
    return matchesSearch && matchesCategory
  })

  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-4 sm:p-6 flex flex-col notranslate ${themeBg}`} translate="no">
      
      {/* TOAST FLOTANTE MODERNO */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999999] animate-bounce">
          <div className={`px-5 py-3 rounded-xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : toast.type === 'info' ? 'bg-blue-600 text-white border-blue-400' : 'bg-red-600 text-white border-red-400'
          }`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'info' ? 'ℹ️' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Cabecera */}
      <header className={`p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border ${panelBg}`}>
        <div className="flex items-center gap-3">
          {businessLogo ? (
            <img src={businessLogo} alt="Logo" className={`w-24 h-24 object-contain rounded-lg p-1 border shadow ${isDarkMode ? 'bg-[#0f172a] border-slate-600' : 'bg-white border-slate-300'}`} />
          ) : (
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-[10px] border ${isDarkMode ? 'bg-[#0f172a] border-slate-600 text-slate-500' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>POS</div>
          )}
          <h1 className="text-lg sm:text-xl font-bold text-emerald-500">Nueva Cotización / Proforma</h1>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button 
            onClick={toggleTheme}
            className={`px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors border ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-amber-300 border-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'}`}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>

          <button onClick={() => router.push('/pos')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm font-semibold transition-colors text-center text-white">
            ← Volver al POS
          </button>
        </div>
      </header>

      {/* Selector móvil */}
      <div className="flex lg:hidden grid grid-cols-2 gap-2 mb-4">
        <button 
          onClick={() => setMobileViewTab('catalog')}
          className={`py-2.5 rounded-lg font-bold text-xs shadow transition-colors ${mobileViewTab === 'catalog' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}
        >
          🛍️ Catálogo de Productos
        </button>
        <button 
          onClick={() => setMobileViewTab('form')}
          className={`py-2.5 rounded-lg font-bold text-xs shadow relative transition-colors ${mobileViewTab === 'form' ? 'bg-emerald-600 text-white' : `${panelBg} opacity-85`}`}
        >
          📋 Cliente y Detalle ({cart.reduce((a, c) => a + c.quantity, 0)})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Formulario */}
        <div className={`p-4 sm:p-5 rounded-lg shadow border flex flex-col gap-4 justify-between ${mobileViewTab === 'form' ? 'flex' : 'hidden'} lg:flex ${panelBg}`}>
          
          <div className="space-y-3">
            <h2 className="text-md font-bold text-emerald-500 border-b pb-2 border-opacity-50">Datos del Cliente</h2>
            <div>
              <label className="text-xs opacity-75 block mb-1">NIT *</label>
              <input type="text" value={nit} onChange={e => setNit(e.target.value)} onBlur={handleNitBlur} placeholder="Ej. 123456-7 o C/F" className={`w-full border px-3 py-2 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`}/>
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Nombre / Razón Social *</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del cliente o empresa" className={`w-full border px-3 py-2 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`}/>
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Dirección</label>
              <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección fiscal o entrega" className={`w-full border px-3 py-2 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`}/>
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Teléfono</label>
              <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Número de contacto" className={`w-full border px-3 py-2 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`}/>
            </div>
            <div>
              <label className="text-xs opacity-75 block mb-1">Correo Electrónico</label>
              <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" className={`w-full border px-3 py-2 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`}/>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-opacity-50 flex flex-col justify-between">
            <div>
              <h2 className="text-md font-bold text-emerald-500 mb-3 border-b pb-2 border-opacity-50">Detalle de Artículos</h2>
              
              <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <p className="opacity-75 text-xs text-center py-4">No hay productos agregados.</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className={`p-2.5 rounded border flex flex-col gap-1 text-xs ${subPanelBg}`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{item.name}</span>
                        <button onClick={() => updateQuantity(item.id, 0)} className="text-red-400 font-bold px-1.5 bg-slate-700 rounded text-sm">×</button>
                      </div>

                      {item.notes && (
                        <div className="bg-emerald-950/30 border border-emerald-500/30 p-1.5 rounded text-[10px] text-emerald-300">
                          <p>📝 <strong>Notas:</strong> {item.notes}</p>
                          {item.eventDate && <p className="text-amber-300">📅 <strong>Entrega:</strong> {new Date(item.eventDate).toLocaleString()}</p>}
                        </div>
                      )}

                      <div className="flex justify-between items-center gap-2 pt-1">
                        <div className="flex items-center gap-1">
                          <span>Precio Q:</span>
                          <input type="number" step="0.01" value={item.price} onChange={(e) => handlePriceChange(item.id, e.target.value)} className={`w-16 border rounded px-1.5 py-0.5 text-emerald-400 font-bold ${inputBg}`} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Cant:</span>
                          <input type="number" min="1" value={item.quantity} onChange={(e) => updateQuantity(item.id, Number(e.target.value))} className={`w-12 border rounded px-1 py-0.5 text-center font-bold ${inputBg}`} />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-opacity-30 font-bold">
                        <span>Subtotal:</span>
                        <span className="text-emerald-500" translate="no">Q {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-opacity-50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-base font-bold opacity-80">Total Cotización:</span>
                <span className="text-xl font-extrabold text-emerald-500" translate="no">Q {totalAmount.toFixed(2)}</span>
              </div>
              
              <button onClick={handleGuardarYGenerarPDF} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors disabled:opacity-50">
                {loading ? 'Generando...' : '💾 Guardar y Generar PDF'}
              </button>

              <p className="text-[10px] opacity-75 text-center mt-3 italic">
                * Esta cotización tiene validez durante 24 horas, luego de eso puede estar sujeta a cambios.
              </p>
            </div>
          </div>
        </div>

        {/* Catálogo */}
        <div className={`lg:col-span-2 p-4 sm:p-6 rounded-lg shadow border flex flex-col ${mobileViewTab === 'catalog' ? 'flex' : 'hidden'} lg:flex ${panelBg}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-bold text-emerald-500">Catálogo de Productos (Matriz)</h2>
          </div>

          <div className="relative mb-4" ref={searchRef}>
            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="🔍 Buscar producto por nombre..." className={`w-full border px-4 py-2.5 rounded-lg text-sm outline-none focus:border-emerald-500 transition-colors ${inputBg}`} />
            
            {showSuggestions && searchTerm.trim() !== '' && (
              <div className={`absolute left-0 right-0 mt-1 border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto ${subPanelBg}`}>
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-xs opacity-75 text-center">No se encontraron productos</div>
                ) : (
                  filteredProducts.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => { 
                        addToCart(p); 
                        setSearchTerm(''); 
                        setShowSuggestions(false); 
                      }} 
                      className={`w-full text-left px-4 py-2.5 hover:opacity-75 flex justify-between items-center border-b transition-colors text-xs ${subPanelBg}`}
                    >
                      <div><span className="font-semibold">{p.name}</span><span className="opacity-75 ml-2 text-[10px]">(Stock: {p.stock})</span></div>
                      <span className="text-emerald-500 font-bold" translate="no">Q {p.price}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Categorías */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-thin">
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

          {/* Tarjetas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto max-h-[60vh] pr-1">
            {filteredProducts.length === 0 ? (
              <p className="opacity-75 col-span-full text-center py-10">No hay productos que coincidan con la búsqueda.</p>
            ) : (
              filteredProducts.map(p => {
                const isCustomByName = p.name && (
                  p.name.toLowerCase().includes('vinil') || 
                  p.name.toLowerCase().includes('personaliz') ||
                  p.name.toLowerCase().includes('manta') ||
                  p.name.toLowerCase().includes('evento')
                );
                const isOutOfStock = !isCustomByName && p.stock <= 0;

                return (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)} 
                    className={`border p-3 rounded-lg flex flex-col justify-between text-left transition-all duration-150 shadow h-full select-none ${subPanelBg} ${
                      isOutOfStock 
                        ? 'opacity-50 cursor-not-allowed border-red-500/40' 
                        : 'hover:border-emerald-500 active:scale-95 active:border-emerald-400 cursor-pointer group'
                    }`}
                  >
                    <div className="flex flex-col">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-24 object-cover rounded mb-2 border border-opacity-50 pointer-events-none" />
                      ) : (
                        <div className={`w-full h-24 rounded mb-2 flex items-center justify-center text-xs opacity-50 border border-opacity-50 ${panelBg}`}>Sin imagen</div>
                      )}
                      <span className={`text-[11px] block mb-0.5 ${isOutOfStock ? 'text-red-400 font-bold' : 'opacity-75'}`}>
                        Stock: {isCustomByName ? 'N/A' : p.stock} {isOutOfStock ? '(Agotado)' : ''}
                      </span>
                      <h3 className={`font-bold transition-colors line-clamp-2 text-xs leading-snug ${isOutOfStock ? 'opacity-75' : 'group-hover:text-emerald-500'}`}>{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-1 border-t border-opacity-50 flex items-center justify-between">
                      <span className="text-[10px] opacity-70 uppercase">{isCustomByName ? 'Variable' : 'Precio'}</span>
                      <span className="text-emerald-500 font-extrabold text-sm sm:text-base" translate="no">{isCustomByName ? 'A cotizar' : `Q ${p.price}`}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Modal Personalizado */}
      {showCustomModal && pendingCustomProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 999999 }}>
          <div className={`p-6 rounded-2xl border border-emerald-500 w-full max-w-md shadow-2xl space-y-4 ${panelBg}`}>
            <div className="flex justify-between items-center border-b pb-3 border-opacity-50">
              <h3 className="text-base font-bold text-emerald-500">✨ Especificaciones de Cotización</h3>
              <button onClick={() => setShowCustomModal(false)} className="font-bold text-lg opacity-75 hover:opacity-100">✕</button>
            </div>

            <div>
              <p className="font-bold text-sm">{pendingCustomProduct.name}</p>
              <p className="text-xs opacity-75 mt-1">Ingresa las medidas, diseño, notas o detalles para incluir en la proforma:</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 opacity-90">Notas / Medidas / Características *</label>
                <textarea 
                  value={customNotesInput}
                  onChange={e => setCustomNotesInput(e.target.value)}
                  placeholder="Ej. Arreglo para 20 mesas..."
                  rows={3}
                  className={`w-full border p-2.5 rounded-xl text-sm outline-none resize-none ${inputBg}`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-90">Fecha y Hora de Entrega / Evento</label>
                <input 
                  type="datetime-local"
                  value={customEventDateInput}
                  onChange={e => setCustomEventDateInput(e.target.value)}
                  className={`w-full border p-2.5 rounded-xl text-sm outline-none ${inputBg}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-90">Precio Cotizado (Q) *</label>
                <input 
                  type="number"
                  step="0.01"
                  value={customPriceInput}
                  onChange={e => setCustomPriceInput(e.target.value)}
                  placeholder="0.00"
                  className={`w-full border p-2.5 rounded-xl text-sm outline-none ${inputBg}`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleConfirmCustomProduct}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-sm shadow"
              >
                Agregar a Cotización
              </button>
              <button 
                onClick={() => setShowCustomModal(false)}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}