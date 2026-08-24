'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [isCustomProduct, setIsCustomProduct] = useState(false)

  // Estado para controlar la vista activa mediante las Cards del Menú Principal
  const [activeSection, setActiveSection] = useState<'menu' | 'branches' | 'staff' | 'categories' | 'add_product' | 'products_list'>('menu')

  // Estado para el Menú Lateral Deslizante (Hamburguesa ☰)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Estado para el Tema (Modo Oscuro / Modo Claro Local)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard_theme')
    if (savedTheme === 'light') {
      setIsDarkMode(false)
    }
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('dashboard_theme', newMode ? 'dark' : 'light')
  }

  // Estados para personal / cajeros
  const [username, setUsername] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState('vendedor')
  const [staffList, setStaffList] = useState<any[]>([])
  const [businessNemonico, setBusinessNemonico] = useState('')
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  
  // Estados para Categorías y Productos
  const [categories, setCategories] = useState<any[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null) 
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  
  const [newBranchName, setNewBranchName] = useState('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentBusinessId, setCurrentBusinessId] = useState<string>('')
  
  const router = useRouter()

  useEffect(() => {
    const currentBusinessStr = localStorage.getItem('currentBusiness')
    if (currentBusinessStr) {
      try {
        const biz = JSON.parse(currentBusinessStr)
        setUserEmail(biz.owner_email || 'Negocio')
        setCurrentBusinessId(biz.id)
        
        const nemonico = biz.owner_email ? biz.owner_email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'negocio'
        setBusinessNemonico(nemonico)

        fetchBranchesForBusiness(biz.id)
        fetchStaff(biz.id)
        fetchCategories(biz.id)
      } catch (e) {
        console.error("Error al leer el negocio:", e)
      }
    } else {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) router.push('/')
        else {
          setUserEmail(user.email ?? '')
          if (user.email === 'alopezadmin@admin.com') setIsAdmin(true)
        }
      })
    }
  }, [router])

  useEffect(() => {
    if (selectedBranch) fetchProducts()
  }, [selectedBranch])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setStaffName(val)

    if (!editingStaffId) {
      const generatedUser = val
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '')
      setUsername(generatedUser)
    }
  }

  async function compressImage(file: File, maxWidth = 500, maxHeight = 500, quality = 0.75): Promise<File> {
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
          if (width > height) {
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('Compresión fallida')); return }
            const compressedFile = new File([blob], file.name.split('.')[0] + ".jpg", { type: 'image/jpeg' })
            resolve(compressedFile)
          }, 'image/jpeg', quality)
        }
      }
      reader.onerror = (error) => reject(error)
    })
  }

  async function fetchBranchesForBusiness(businessId: string) {
    const { data, error } = await supabase.rpc('get_branches_safe', { p_business_id: businessId })
    if (error) return console.error(error.message)
    if (data) {
      setBranches(data)
      if (data.length > 0 && (!selectedBranch || !data.some((b: any) => b.id === selectedBranch))) {
        setSelectedBranch(data[0].id)
      } else if (data.length === 0) {
        setSelectedBranch('')
      }
    }
  }

  async function fetchCategories(businessId: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true })

    if (!error && data) {
      setCategories(data)
    }
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim() || !currentBusinessId) return

    if (editingCategoryId) {
      const { error } = await supabase
        .from('categories')
        .update({ name: newCategoryName.trim() })
        .eq('id', editingCategoryId)

      if (error) {
        alert("Error al actualizar categoría: " + error.message)
      } else {
        alert("¡Categoría actualizada con éxito!")
        setEditingCategoryId(null)
        setNewCategoryName('')
        fetchCategories(currentBusinessId)
      }
    } else {
      const { data, error } = await supabase.rpc('create_category_safe', {
        p_business_id: currentBusinessId,
        p_name: newCategoryName.trim()
      })

      if (error) {
        alert("Error al crear categoría: " + error.message)
      } else {
        alert("¡Categoría creada con éxito!")
        setNewCategoryName('')
        fetchCategories(currentBusinessId)
      }
    }
  }

  function startEditCategory(cat: { id: string; name: string }) {
    setEditingCategoryId(cat.id)
    setNewCategoryName(cat.name)
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setNewCategoryName('')
  }

  async function deleteCategory(categoryId: string) {
    if (!confirm("¿Estás seguro de dar de baja esta categoría? Se validará que no tenga productos asociados.")) return

    const { data, error } = await supabase.rpc('delete_category_safely', {
      p_category_id: categoryId
    })

    if (error) {
      alert("Error al ejecutar la acción: " + error.message)
    } else {
      alert(data.message)
      if (data.success) {
        fetchCategories(currentBusinessId)
      }
    }
  }

  async function fetchProducts() {
    if (!selectedBranch) return
    const { data, error } = await supabase.rpc('get_products_safe', { p_branch_id: selectedBranch })
    if (error) return console.error(error.message)
    setProducts(data || [])
  }

  async function fetchStaff(bizId?: string) {
    const bId = bizId || currentBusinessId
    if (!bId) return
    const { data } = await supabase.rpc('get_branch_users_safe', { p_business_id: bId })
    setStaffList(data || [])
  }

  async function handleSaveStaff() {
    if (!username.trim() || !staffName.trim() || !selectedBranch) {
      return alert("Completa el nombre, usuario y selecciona la sucursal.")
    }

    if (!editingStaffId && !accessCode.trim()) {
      return alert("Por favor ingresa un código de acceso para el nuevo empleado.")
    }

    const fullUsername = username.includes('-') ? username.trim().toLowerCase() : `${businessNemonico}-${username.trim().toLowerCase()}`

    if (editingStaffId) {
      const passwordToSend = (accessCode === '••••••••' || !accessCode.trim()) ? null : accessCode.trim()

      const { error } = await supabase.rpc('update_branch_user_safe', {
        p_user_id: editingStaffId,
        p_branch_id: selectedBranch,
        p_name: staffName.trim(),
        p_username: fullUsername,
        p_role: staffRole,
        p_access_code: passwordToSend
      })

      if (error) {
        alert("Error al actualizar personal: " + error.message)
      } else {
        alert("¡Personal actualizado con éxito!")
        cancelEditStaff()
        fetchStaff()
      }
    } else {
      const { error } = await supabase.rpc('add_branch_user_safe', {
        p_business_id: currentBusinessId,
        p_branch_id: selectedBranch,
        p_username: fullUsername,
        p_access_code: accessCode.trim(),
        p_name: staffName.trim(),
        p_role: staffRole
      })

      if (error) {
        alert("Error al registrar personal: " + error.message)
      } else {
        alert(`¡Personal asignado con éxito! Usuario: ${fullUsername} (${staffRole.toUpperCase()})`)
        cancelEditStaff()
        fetchStaff()
      }
    }
  }

  function startEditStaff(staff: any) {
    setEditingStaffId(staff.id)
    setStaffName(staff.name || '')
    const cleanUser = staff.username ? staff.username.replace(`${businessNemonico}-`, '') : ''
    setUsername(cleanUser)
    setAccessCode('••••••••')
    setSelectedBranch(staff.branch_id || selectedBranch)
    setStaffRole(staff.role || 'vendedor')
  }

  function cancelEditStaff() {
    setEditingStaffId(null)
    setUsername('')
    setAccessCode('')
    setStaffName('')
    setStaffRole('vendedor')
  }

  async function deleteStaff(staffId: string) {
    if (!confirm("¿Deseas quitar el acceso a este empleado?")) return
    const { error } = await supabase.rpc('delete_branch_user_safe', { p_user_id: staffId })
    if (error) alert("Error: " + error.message)
    else fetchStaff()
  }

  async function handleSaveProduct() {
    if (!selectedBranch || !name.trim()) return alert("Selecciona sucursal y nombre.")

    let imageUrl = null
    if (imageFile) {
      try {
        const optimizedFile = await compressImage(imageFile)
        const fileName = `${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage.from('products').upload(fileName, optimizedFile)
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('products').getPublicUrl(fileName)
        imageUrl = data.publicUrl
      } catch (err) {
        return alert("Error al procesar/subir imagen.")
      }
    }

    if (editingId) {
      const { error } = await supabase.rpc('update_product_safe', {
        p_product_id: editingId,
        p_name: name,
        p_price: parseFloat(price) || 0,
        p_stock: parseInt(stock) || 0,
        p_image_url: imageUrl,
        p_category_id: selectedCategoryId || null
      })

      if (error) alert("Error al actualizar: " + error.message)
      else {
        alert("¡Producto actualizado con éxito!")
        cancelEdit()
        fetchProducts()
      }
    } else {
      const { error } = await supabase.rpc('add_product_safe', {
        p_name: name,
        p_price: parseFloat(price) || 0,
        p_stock: parseInt(stock) || 0,
        p_branch_id: selectedBranch,
        p_image_url: imageUrl,
        p_category_id: selectedCategoryId || null,
        p_is_custom: isCustomProduct
      })

      if (error) alert("Error al agregar: " + error.message)
      else {
        alert("¡Producto agregado con éxito!")
        cancelEdit()
        fetchProducts()
      }
    }
  }

  function startEdit(product: any) {
    setEditingId(product.id)
    setName(product.name)
    setPrice(product.price)
    setStock(product.stock)
    setSelectedCategoryId(product.category_id || '')
    setIsCustomProduct(product.is_custom || false)
    setImageFile(null)
    setActiveSection('add_product')
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setPrice('')
    setStock('')
    setSelectedCategoryId('')
    setIsCustomProduct(false)
    setImageFile(null)
  }

  async function deleteProduct(productId: string) {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return
    const { error } = await supabase.rpc('delete_product_safe', { p_product_id: productId })
    if (error) alert("Error al eliminar: " + error.message)
    else fetchProducts()
  }

  async function addBranch() {
    if (!newBranchName.trim() || !currentBusinessId) return

    const { data, error } = await supabase.rpc('create_branch_safe', {
      p_business_id: currentBusinessId,
      p_name: newBranchName.trim(),
      p_address: 'Sin dirección'
    })

    if (error) {
      alert("Error al crear sucursal: " + error.message)
      return
    }

    alert(data.message)

    if (data.success) {
      setNewBranchName('')
      fetchBranchesForBusiness(currentBusinessId)
    }
  }

  async function deleteBranch(branchId: string, branchName: string) {
    if (!confirm(`¿Estás seguro de dar de baja la sucursal "${branchName}"? Se perderán sus productos y accesos asociados.`)) return

    const { data, error } = await supabase.rpc('delete_branch_safe', {
      p_branch_id: branchId,
      p_business_id: currentBusinessId
    })

    if (error) {
      alert("Error al dar de baja la sucursal: " + error.message)
      return
    }

    alert(data.message)

    if (data.success) {
      fetchBranchesForBusiness(currentBusinessId)
      fetchStaff(currentBusinessId)
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('currentBusiness')
    await supabase.auth.signOut()
    router.push('/')
  }

  // Clases dinámicas según el tema (Modo Oscuro vs Modo Claro)
  const themeBg = isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-900'
  const panelBg = isDarkMode ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-md'
  const subPanelBg = isDarkMode ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  const inputBg = isDarkMode ? 'bg-[#0f172a] text-white border-slate-600' : 'bg-white text-slate-900 border-slate-300'

  return (
    <div className={`min-h-screen p-2 md:p-4 flex flex-col notranslate pb-20 lg:pb-4 ${themeBg}`} translate="no">
      <div className="max-w-5xl mx-auto w-full">
        
        {/* HEADER ADAPTABLE CON BOTÓN HAMBURGUESA (☰) Y TEMA */}
        <header className={`p-3 rounded-lg shadow mb-4 flex flex-wrap justify-between items-center gap-2 border w-full ${panelBg}`}>
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center shadow transition-colors"
              title="Herramientas y Menú"
            >
              ☰
            </button>
            <div>
              <h1 className="text-xs md:text-sm font-bold text-emerald-500">Panel de Control POS</h1>
              <p className="text-[10px] opacity-75">Conectado como: {userEmail}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* BOTÓN INTERRUPTOR DE TEMA (SOLO ICONO) */}
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg text-sm font-semibold border transition-colors ${isDarkMode ? 'bg-slate-700 text-amber-300 border-slate-600' : 'bg-slate-200 text-slate-800 border-slate-300'}`}
              title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* BOTÓN DE RETORNO SI ESTÁ DENTRO DE UNA SECCIÓN */}
        {activeSection !== 'menu' && (
          <div className="mb-4">
            <button 
              onClick={() => { setActiveSection('menu'); cancelEdit(); cancelEditStaff(); cancelEditCategory(); }}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-1.5"
            >
              ← Volver al Menú Principal
            </button>
          </div>
        )}

        {/* MENÚ PRINCIPAL DE TARJETAS (CARDS) */}
        {activeSection === 'menu' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <h2 className="text-lg md:text-xl font-bold text-emerald-500">Panel de Administración del Negocio</h2>
              <p className="text-xs opacity-75">Selecciona una tarjeta para configurar tu negocio, sucursales y catálogo.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              
              {/* CARD 1: SUCURSALES */}
              <div 
                onClick={() => setActiveSection('branches')}
                className={`p-5 rounded-xl border cursor-pointer hover:border-emerald-500 transition-all shadow-md flex flex-col justify-between gap-3 ${panelBg}`}
              >
                <div>
                  <div className="text-2xl mb-2">📍</div>
                  <h3 className="font-bold text-base text-emerald-500">Gestión de Sucursales</h3>
                  <p className="text-xs opacity-75 mt-1">Crea nuevas sucursales, selecciona la activa o da de baja las existentes.</p>
                </div>
                <span className="text-xs font-bold text-emerald-400">Administrar ➔</span>
              </div>

              {/* CARD 2: PERSONAL */}
              <div 
                onClick={() => setActiveSection('staff')}
                className={`p-5 rounded-xl border cursor-pointer hover:border-emerald-500 transition-all shadow-md flex flex-col justify-between gap-3 ${panelBg}`}
              >
                <div>
                  <div className="text-2xl mb-2">👥</div>
                  <h3 className="font-bold text-base text-emerald-500">Asignación de Personal</h3>
                  <p className="text-xs opacity-75 mt-1">Registra cajeros, vendedores o bodegueros y asígnales sucursales y roles.</p>
                </div>
                <span className="text-xs font-bold text-emerald-400">Administrar ➔</span>
              </div>

              {/* CARD 3: CATEGORÍAS */}
              <div 
                onClick={() => setActiveSection('categories')}
                className={`p-5 rounded-xl border cursor-pointer hover:border-emerald-500 transition-all shadow-md flex flex-col justify-between gap-3 ${panelBg}`}
              >
                <div>
                  <div className="text-2xl mb-2">🏷️</div>
                  <h3 className="font-bold text-base text-emerald-500">Gestión de Categorías</h3>
                  <p className="text-xs opacity-75 mt-1">Organiza tus artículos creando, renombrando o dando de baja categorías.</p>
                </div>
                <span className="text-xs font-bold text-emerald-400">Administrar ➔</span>
              </div>

              {/* CARD 4: AGREGAR PRODUCTOS */}
              <div 
                onClick={() => setActiveSection('add_product')}
                className={`p-5 rounded-xl border cursor-pointer hover:border-emerald-500 transition-all shadow-md flex flex-col justify-between gap-3 ${panelBg}`}
              >
                <div>
                  <div className="text-2xl mb-2">➕</div>
                  <h3 className="font-bold text-base text-emerald-500">Agregar Producto</h3>
                  <p className="text-xs opacity-75 mt-1">Da de alta nuevos productos con foto, precio, stock y categoría.</p>
                </div>
                <span className="text-xs font-bold text-emerald-400">Administrar ➔</span>
              </div>

              {/* CARD 5: LISTA DE PRODUCTOS */}
              <div 
                onClick={() => setActiveSection('products_list')}
                className={`p-5 rounded-xl border cursor-pointer hover:border-emerald-500 transition-all shadow-md flex flex-col justify-between gap-3 ${panelBg}`}
              >
                <div>
                  <div className="text-2xl mb-2">📋</div>
                  <h3 className="font-bold text-base text-emerald-500">Catálogo de Productos</h3>
                  <p className="text-xs opacity-75 mt-1">Visualiza, edita o elimina los productos actuales de tu sucursal activa.</p>
                </div>
                <span className="text-xs font-bold text-emerald-400">Administrar ➔</span>
              </div>

              {/* CARD 6: ESTADÍSTICAS Y REPORTES */}
              <div 
                onClick={() => router.push('/estadisticas')}
                className={`p-5 rounded-xl border cursor-pointer hover:border-indigo-500 transition-all shadow-md flex flex-col justify-between gap-3 ${panelBg}`}
              >
                <div>
                  <div className="text-2xl mb-2">📈</div>
                  <h3 className="font-bold text-base text-indigo-400">Estadísticas y Reportes</h3>
                  <p className="text-xs opacity-75 mt-1">Consulta gráficos y reportes detallados sobre el rendimiento de tus ventas.</p>
                </div>
                <span className="text-xs font-bold text-indigo-400">Ver Reportes ➔</span>
              </div>

            </div>
          </div>
        )}
        
        {/* SECCIÓN 1: SUCURSALES */}
        {activeSection === 'branches' && (
          <div className={`p-4 sm:p-6 rounded-lg shadow mb-6 space-y-4 border ${panelBg}`}>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-emerald-500 mb-1">Creación y Mantenimiento de Sucursales</h2>
              <p className="text-xs opacity-75">Selecciona tu sucursal activa, crea nuevas localidades o da de baja las que ya no utilices.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <label className="font-bold sm:w-36 text-xs sm:text-sm">Sucursal Activa:</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={`border p-2.5 rounded flex-1 text-sm outline-none ${inputBg}`}>
                {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-opacity-50 pt-4">
              <label className="font-bold sm:w-36 text-xs sm:text-sm">Nueva Sucursal:</label>
              <input placeholder="Ej. Comedor Zona 1" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} className={`border p-2.5 rounded flex-1 text-sm outline-none ${inputBg}`} />
              <button onClick={addBranch} className="bg-emerald-600 text-white px-4 py-2.5 rounded font-semibold hover:bg-emerald-500 text-sm shadow">Crear Sucursal</button>
            </div>

            {branches.length > 0 && (
              <div className="border-t border-opacity-50 pt-4 mt-4">
                <h3 className="text-xs font-bold opacity-75 uppercase mb-3">Sucursales Registradas y Gestión</h3>
                <div className="space-y-2">
                  {branches.map(b => (
                    <div key={b.id} className={`flex justify-between items-center p-3 rounded border gap-2 ${subPanelBg}`}>
                      <span className="text-sm font-semibold text-emerald-500 truncate">{b.name}</span>
                      <button 
                        onClick={() => deleteBranch(b.id, b.name)}
                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0 shadow"
                      >
                        Dar de Baja
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN 2: PERSONAL */}
        {activeSection === 'staff' && (
          <div className={`p-4 sm:p-6 rounded-lg shadow mb-6 border ${editingStaffId ? 'bg-amber-950/40 border-amber-500/50' : panelBg}`}>
            <div className="flex justify-between items-center mb-1">
              <h2 className={`text-base sm:text-lg font-bold ${editingStaffId ? 'text-amber-400' : 'text-emerald-500'}`}>
                {editingStaffId ? '✏️ Editando Empleado' : 'Asignar Personal a Sucursal'}
              </h2>
              {editingStaffId && (
                <button onClick={cancelEditStaff} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded font-semibold text-white">
                  Cancelar Edición
                </button>
              )}
            </div>
            <p className="text-xs opacity-75 mb-4">El sistema genera el usuario con el prefijo: <span className="text-amber-500 font-mono">{businessNemonico}-</span></p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4 items-end">
              <div>
                <label className="block text-[11px] sm:text-[10px] opacity-75 mb-1 font-medium">Nombre</label>
                <input 
                  placeholder="Ej. pedro" 
                  value={staffName} 
                  onChange={handleNameChange} 
                  className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} 
                />
              </div>
              
              <div>
                <label className="block text-[11px] sm:text-[10px] opacity-75 mb-1 font-medium">Usuario</label>
                <input 
                  placeholder="usuario" 
                  value={username} 
                  onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                  className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} 
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-[10px] opacity-75 mb-1 font-medium">Contraseña</label>
                <input 
                  placeholder="Código de Acceso" 
                  type="password" 
                  value={accessCode} 
                  onFocus={() => { if (accessCode === '••••••••') setAccessCode(''); }}
                  onChange={e => setAccessCode(e.target.value)} 
                  className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`} 
                />
              </div>
              
              <div>
                <label className="block text-[11px] sm:text-[10px] opacity-75 mb-1 font-medium">Sucursal</label>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={`w-full border p-2.5 rounded text-sm outline-none ${inputBg}`}>
                  {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] sm:text-[10px] opacity-75 mb-1 font-medium">Rol</label>
                <select value={staffRole} onChange={e => setStaffRole(e.target.value)} className={`w-full border p-2.5 rounded text-sm font-semibold text-emerald-500 outline-none ${inputBg}`}>
                  <option value="vendedor">🛒 Vendedor</option>
                  <option value="cajero">💵 Cajero</option>
                  <option value="bodega">📦 Bodega</option>
                  <option value="encargado">⭐ Encargado</option>
                </select>
              </div>

              <button 
                onClick={handleSaveStaff} 
                className={`text-white p-2.5 rounded font-semibold text-sm shadow w-full ${editingStaffId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              >
                {editingStaffId ? 'Actualizar' : 'Asignar'}
              </button>
            </div>

            {staffList.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="opacity-75 border-b border-opacity-50">
                    <tr>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Usuario de Acceso</th>
                      <th className="p-3">Sucursal Asignada</th>
                      <th className="p-3">Rol</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((s) => {
                      const branchObj = branches.find(b => b.id === s.branch_id)
                      return (
                        <tr key={s.id} className="border-b border-opacity-50 hover:bg-opacity-50">
                          <td className="p-3 font-semibold">{s.name}</td>
                          <td className="p-3 text-amber-500 font-mono">{s.username}</td>
                          <td className="p-3 text-emerald-500">{branchObj ? branchObj.name : 'Sucursal'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${s.role === 'cajero' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {s.role || 'vendedor'}
                            </span>
                          </td>
                          <td className="p-3 text-center space-x-2">
                            <button onClick={() => startEditStaff(s)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-xs font-semibold shadow">Editar</button>
                            <button onClick={() => deleteStaff(s.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-semibold shadow">Quitar</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN 3: CATEGORÍAS */}
        {activeSection === 'categories' && (
          <div className={`p-4 sm:p-6 rounded-lg shadow mb-8 border ${editingCategoryId ? 'bg-amber-950/40 border-amber-500/50' : panelBg}`}>
            <div className="flex justify-between items-center mb-1">
              <h2 className={`text-base sm:text-lg font-bold ${editingCategoryId ? 'text-amber-400' : 'text-emerald-500'}`}>
                {editingCategoryId ? '✏️ Editando Categoría' : 'Gestión de Categorías'}
              </h2>
              {editingCategoryId && (
                <button onClick={cancelEditCategory} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded font-semibold text-white">
                  Cancelar Edición
                </button>
              )}
            </div>
            <p className="text-xs opacity-75 mb-4">Crea, renombra o da de baja tus categorías de forma segura considerando los productos asociados.</p>
            
            <form onSubmit={handleSaveCategory} className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end mb-4">
              <div className="flex-1">
                <label className="block text-xs opacity-75 mb-1">Nombre de la Categoría</label>
                <input 
                  placeholder="Ej. Refacciones" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  className={`w-full border p-2.5 rounded text-sm outline-none focus:border-emerald-500 ${inputBg}`} 
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className={`px-5 py-2.5 rounded font-semibold text-white text-sm shadow ${editingCategoryId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                  {editingCategoryId ? 'Actualizar Categoría' : '+ Crear Categoría'}
                </button>
                {editingCategoryId && (
                  <button type="button" onClick={cancelEditCategory} className="bg-slate-700 hover:bg-slate-600 px-3 py-2.5 rounded font-semibold text-white text-xs">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-opacity-50">
                {categories.map(cat => (
                  <div key={cat.id} className={`flex items-center border text-xs px-3 py-1.5 rounded-full font-semibold gap-2 ${subPanelBg}`}>
                    <span>🏷️ {cat.name}</span>
                    <button onClick={() => startEditCategory(cat)} className="text-amber-500 hover:text-amber-400 font-bold" title="Renombrar">
                      ✏️
                    </button>
                    <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-300 font-bold" title="Dar de baja">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Formulario Productos */}
        {activeSection === 'add_product' && (
          <div className={`p-4 sm:p-6 rounded-lg shadow mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4 items-end border ${editingId ? 'bg-amber-950/40 border-amber-500/50' : panelBg}`}>
            <div className="col-span-full mb-2">
              <h3 className={`font-bold text-base ${editingId ? 'text-amber-400' : 'text-emerald-500'}`}>
                {editingId ? '✏️ Editando Producto Existente' : '➕ Agregar Nuevo Producto'}
              </h3>
              <p className="text-xs opacity-75">Sucursal destino seleccionada actualmente.</p>
            </div>

            <div className="col-span-full">
              <label className="block text-xs opacity-75 mb-1">Sucursal</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={`border p-2.5 rounded text-sm outline-none w-full ${inputBg}`}>
                {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            
            <input placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} className={`border p-2.5 rounded text-sm outline-none ${inputBg}`} />
            <input placeholder="Precio" type="number" value={price} onChange={e => setPrice(e.target.value)} className={`border p-2.5 rounded text-sm outline-none ${inputBg}`} />
            <input placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} className={`border p-2.5 rounded text-sm outline-none ${inputBg}`} />
            
            <select 
              value={selectedCategoryId} 
              onChange={e => setSelectedCategoryId(e.target.value)} 
              className={`border p-2.5 rounded text-sm outline-none ${inputBg}`}
            >
              <option value="">-- Sin Categoría --</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-xs opacity-75 file:bg-slate-700 file:text-white file:border-0 file:p-2 file:rounded w-full" />
            
            <div className={`col-span-full flex items-center gap-2 pt-2 p-3 rounded border ${subPanelBg}`}>
              <input 
                type="checkbox" 
                id="customCheck"
                checked={isCustomProduct} 
                onChange={e => setIsCustomProduct(e.target.checked)} 
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
              <label htmlFor="customCheck" className="text-xs font-semibold cursor-pointer">
                ¿Es un producto personalizable o de precio/medida abierta? (Ej. Mantas vinílicas)
              </label>
            </div>

            <div className="col-span-full flex gap-2 w-full pt-2">
              <button onClick={handleSaveProduct} className={`flex-1 p-2.5 rounded font-semibold text-white shadow text-sm ${editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                {editingId ? 'Actualizar Producto' : 'Guardar y Agregar Producto'}
              </button>
              {editingId && (
                <button onClick={cancelEdit} className="bg-slate-700 hover:bg-slate-600 px-3 py-2.5 rounded font-semibold text-white text-xs">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabla de Productos */}
        {activeSection === 'products_list' && (
          <div className={`rounded-lg shadow overflow-hidden border ${panelBg}`}>
            <div className="p-4 border-b border-opacity-50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <h3 className="font-bold text-base text-emerald-500">📋 Catálogo de Productos</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold">Sucursal:</label>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={`border p-2 rounded text-xs outline-none ${inputBg}`}>
                  {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className={`border-b opacity-75 ${subPanelBg}`}>
                  <tr>
                    <th className="p-4">Foto</th>
                    <th className="p-4">Producto</th>
                    <th className="p-4">Precio</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center opacity-75">No hay productos en esta sucursal.</td></tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="border-b border-opacity-50 hover:bg-opacity-50">
                        <td className="p-2">
                          {p.image_url ? (
                            <img src={p.image_url} className="w-12 h-12 object-cover rounded" alt={p.name} />
                          ) : (
                            <div className={`w-12 h-12 rounded flex items-center justify-center text-xs opacity-50 ${subPanelBg}`}>Sin foto</div>
                          )}
                        </td>
                        <td className="p-4 font-semibold">
                          {p.name} {p.is_custom && <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded ml-2">Personalizable</span>}
                        </td>
                        <td className="p-4" translate="no">Q {p.price}</td>
                        <td className="p-4">{p.stock}</td>
                        <td className="p-4 text-center space-x-2">
                          <button onClick={() => startEdit(p)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-semibold shadow">Editar / Foto</button>
                          <button onClick={() => deleteProduct(p.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold shadow">Quitar</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* MENÚ LATERAL DESLIZANTE (☰) CON ACCESOS GENERALES LIMPIOS */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/70 flex z-[9999]" onClick={() => setIsDrawerOpen(false)}>
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
                <p className="font-bold text-emerald-500 text-sm">Menú Principal Admin</p>
                <button onClick={() => { setIsDrawerOpen(false); setActiveSection('menu'); }} className="w-full bg-emerald-700 hover:bg-emerald-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>🏠 Ir al Menú de Tarjetas</span>
                  <span>➔</span>
                </button>

                <p className="font-bold text-emerald-500 text-sm pt-2">Módulos del Sistema</p>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/pos'); }} className="w-full bg-sky-600 hover:bg-sky-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>🛒 Ir al POS</span>
                  <span>➔</span>
                </button>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/cajero'); }} className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>💵 Módulo de Caja</span>
                  <span>➔</span>
                </button>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/compras'); }} className="w-full bg-amber-600 hover:bg-amber-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>📦 Módulo de Compras</span>
                  <span>➔</span>
                </button>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/inventario'); }} className="w-full bg-emerald-700 hover:bg-emerald-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>📋 Administración de Inventario</span>
                  <span>➔</span>
                </button>
                <button onClick={() => { setIsDrawerOpen(false); router.push('/ventas-historia'); }} className="w-full bg-teal-600 hover:bg-teal-500 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                  <span>📜 Historial de Ventas</span>
                  <span>➔</span>
                </button>
                {isAdmin && (
                  <button onClick={() => { setIsDrawerOpen(false); router.push('/admin'); }} className="w-full bg-slate-700 hover:bg-slate-600 py-2.5 px-3 rounded-lg font-semibold text-white shadow text-left flex items-center justify-between">
                    <span>👑 Panel de Admin</span>
                    <span>➔</span>
                  </button>
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

    </div>
  )
}