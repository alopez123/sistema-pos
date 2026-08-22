'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')

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

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim() || !currentBusinessId) return

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
        p_category_id: selectedCategoryId || null
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
    setImageFile(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setPrice('')
    setStock('')
    setSelectedCategoryId('')
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

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 sm:p-6 lg:p-8 text-white w-full max-w-[1600px] mx-auto notranslate" translate="no">
      <div className="max-w-5xl mx-auto w-full">
        
        {/* HEADER RESPONSIVE CON BOTÓN DE COMPRAS */}
        <header className="bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow mb-6 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border border-slate-700 w-full">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Panel de Control POS</h1>
            <p className="text-xs sm:text-sm text-slate-400">Conectado como: {userEmail}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button onClick={() => router.push('/pos')} className="flex-1 sm:flex-initial bg-sky-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-sky-500 transition-colors font-semibold text-xs sm:text-sm shadow">🛒 POS</button>
            <button onClick={() => router.push('/cajero')} className="flex-1 sm:flex-initial bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors font-semibold text-xs sm:text-sm shadow">💵 Caja</button>
            <button onClick={() => router.push('/compras')} className="flex-1 sm:flex-initial bg-amber-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-amber-500 transition-colors font-semibold text-xs sm:text-sm shadow">📦 Compras</button>
            <button onClick={() => router.push('/reportes')} className="flex-1 sm:flex-initial bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-emerald-500 transition-colors font-semibold text-xs sm:text-sm shadow">📊 Reportes</button>
            {/* BOTÓN DE INVENTARIO */}
           <button onClick={() => router.push('/inventario')} className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1">📋 Inventario</button>
           <button onClick={() => router.push('/estadisticas')} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded font-semibold text-xs sm:text-sm transition-colors text-white"  >    📈 Estadísticas  </button>
            {isAdmin && <button onClick={() => router.push('/admin')} className="bg-slate-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors text-xs sm:text-sm font-semibold">Admin</button>}
            <button onClick={handleLogout} className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-500 transition-colors text-xs sm:text-sm font-semibold">Salir</button>
          </div>
        </header>
        
        {/* SECCIÓN 1: CREACIÓN Y MANTENIMIENTO DE SUCURSALES */}
        <div className="bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow mb-6 space-y-4 border border-slate-700">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-emerald-400 mb-1">Creación y Mantenimiento de Sucursales</h2>
            <p className="text-xs text-slate-400">Selecciona tu sucursal activa, crea nuevas localidades o da de baja las que ya no utilices.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <label className="font-bold text-slate-300 sm:w-36 text-xs sm:text-sm">Sucursal Activa:</label>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2.5 rounded flex-1 text-white text-sm">
              {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-slate-700 pt-4">
            <label className="font-bold text-slate-300 sm:w-36 text-xs sm:text-sm">Nueva Sucursal:</label>
            <input placeholder="Ej. Comedor Zona 1" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2.5 rounded flex-1 text-white text-sm" />
            <button onClick={addBranch} className="bg-emerald-600 text-white px-4 py-2.5 rounded font-semibold hover:bg-emerald-500 text-sm shadow">Crear Sucursal</button>
          </div>

          {branches.length > 0 && (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Sucursales Registradas y Gestión</h3>
              <div className="space-y-2">
                {branches.map(b => (
                  <div key={b.id} className="flex justify-between items-center bg-[#0f172a] p-3 rounded border border-slate-700 gap-2">
                    <span className="text-sm font-semibold text-emerald-400 truncate">{b.name}</span>
                    <button 
                      onClick={() => deleteBranch(b.id, b.name)}
                      className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0"
                    >
                      Dar de Baja
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN 2: ASIGNAR / EDITAR PERSONAL A SUCURSAL */}
        <div className={`p-4 sm:p-6 rounded-lg shadow mb-6 border ${editingStaffId ? 'bg-amber-950/40 border-amber-500/50' : 'bg-[#1e293b] border-slate-700'}`}>
          <div className="flex justify-between items-center mb-1">
            <h2 className={`text-base sm:text-lg font-bold ${editingStaffId ? 'text-amber-400' : 'text-emerald-400'}`}>
              {editingStaffId ? '✏️ Editando Empleado' : 'Asignar Personal a Sucursal'}
            </h2>
            {editingStaffId && (
              <button onClick={cancelEditStaff} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded font-semibold text-white">
                Cancelar Edición
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">El sistema genera el usuario con el prefijo: <span className="text-amber-400 font-mono">{businessNemonico}-</span></p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4 items-end">
            <div>
              <label className="block text-[11px] sm:text-[10px] text-slate-400 mb-1 font-medium">Nombre</label>
              <input 
                placeholder="Ej. pedro" 
                value={staffName} 
                onChange={handleNameChange} 
                className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm" 
              />
            </div>
            
            <div>
              <label className="block text-[11px] sm:text-[10px] text-slate-400 mb-1 font-medium">Usuario</label>
              <input 
                placeholder="usuario" 
                value={username} 
               onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm outline-none" 
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-[10px] text-slate-400 mb-1 font-medium">Contraseña</label>
              <input 
                placeholder="Código de Acceso" 
                type="password" 
                value={accessCode} 
                onFocus={() => { if (accessCode === '••••••••') setAccessCode(''); }}
                onChange={e => setAccessCode(e.target.value)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm" 
              />
            </div>
            
            <div>
              <label className="block text-[11px] sm:text-[10px] text-slate-400 mb-1 font-medium">Sucursal</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm">
                {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] sm:text-[10px] text-slate-400 mb-1 font-medium">Rol</label>
              <select value={staffRole} onChange={e => setStaffRole(e.target.value)} className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm font-semibold text-emerald-300">
                <option value="vendedor">🛒 Vendedor</option>
                <option value="cajero">💵 Cajero</option>
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
                <thead className="bg-slate-700 text-slate-300">
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
                      <tr key={s.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="p-3 font-semibold">{s.name}</td>
                        <td className="p-3 text-amber-300 font-mono">{s.username}</td>
                        <td className="p-3 text-emerald-400">{branchObj ? branchObj.name : 'Sucursal'}</td>
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

        {/* SECCIÓN 3: GESTIÓN DE CATEGORÍAS */}
        <div className="bg-[#1e293b] p-4 sm:p-6 rounded-lg shadow mb-8 border border-slate-700">
          <h2 className="text-base sm:text-lg font-bold text-emerald-400 mb-1">Gestión de Categorías</h2>
          <p className="text-xs text-slate-400 mb-4">Crea las categorías (ej. Bebidas, Almuerzos, Postres) para clasificar tus productos.</p>
          
          <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end mb-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-300 mb-1">Nombre de la Categoría</label>
              <input 
                placeholder="Ej. Refacciones" 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                className="w-full bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm outline-none focus:border-emerald-500" 
                required
              />
            </div>
            <button type="submit" className="bg-emerald-600 text-white px-5 py-2.5 rounded font-semibold hover:bg-emerald-500 text-sm shadow">
              + Crear Categoría
            </button>
          </form>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
              {categories.map(cat => (
                <span key={cat.id} className="bg-[#0f172a] border border-slate-600 text-emerald-300 text-xs px-3 py-1.5 rounded-full font-semibold">
                  🏷️ {cat.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Formulario Productos (Crear / Editar con Selector de Categoría) */}
        <div className={`p-4 sm:p-6 rounded-lg shadow mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4 items-end border ${editingId ? 'bg-amber-950/40 border-amber-500/50' : 'bg-[#1e293b] border-slate-700'}`}>
          <div className="col-span-full">
            <h3 className={`font-bold text-sm ${editingId ? 'text-amber-400' : 'text-emerald-400'}`}>
              {editingId ? '✏️ Editando Producto Existente' : '➕ Agregar Nuevo Producto'}
            </h3>
          </div>
          
          <input placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm" />
          <input placeholder="Precio" type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm" />
          <input placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm" />
          
          <select 
            value={selectedCategoryId} 
            onChange={e => setSelectedCategoryId(e.target.value)} 
            className="bg-[#0f172a] border border-slate-600 p-2.5 rounded text-white text-sm"
          >
            <option value="">-- Sin Categoría --</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-xs text-slate-400 file:bg-slate-700 file:text-white file:border-0 file:p-2 file:rounded w-full" />
          
          <div className="flex gap-2 w-full">
            <button onClick={handleSaveProduct} className={`flex-1 p-2.5 rounded font-semibold text-white shadow text-sm ${editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {editingId ? 'Actualizar' : 'Agregar'}
            </button>
            {editingId && (
              <button onClick={cancelEdit} className="bg-slate-700 hover:bg-slate-600 px-3 py-2.5 rounded font-semibold text-white text-xs">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Productos */}
        <div className="bg-[#1e293b] rounded-lg shadow overflow-hidden border border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-slate-700 text-slate-300 border-b border-slate-600">
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
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400">No hay productos en esta sucursal.</td></tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                      <td className="p-2">
                        {p.image_url ? (
                          <img src={p.image_url} className="w-12 h-12 object-cover rounded" alt={p.name} />
                        ) : (
                          <div className="w-12 h-12 bg-slate-800 rounded flex items-center justify-center text-xs text-slate-500">Sin foto</div>
                        )}
                      </td>
                      <td className="p-4 font-semibold">{p.name}</td>
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

      </div>
    </div>
  )
}