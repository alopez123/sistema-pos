'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')

  // Estados para personal / cajeros (con usuario y código de acceso)
  const [username, setUsername] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffList, setStaffList] = useState<any[]>([])
  const [businessNemonico, setBusinessNemonico] = useState('')
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
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
        
        // Extraemos un nemónico del correo del dueño o usamos una por defecto (ej: "comedor")
        const nemonico = biz.owner_email ? biz.owner_email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'negocio'
        setBusinessNemonico(nemonico)

        fetchBranchesForBusiness(biz.id)
        fetchStaff(biz.id)
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

  async function addStaff() {
    if (!username.trim() || !accessCode.trim() || !staffName.trim() || !selectedBranch) {
      return alert("Completa el nombre, usuario, código de acceso y selecciona la sucursal.")
    }

    const fullUsername = `${businessNemonico}-${username.trim().toLowerCase()}`

    const { error } = await supabase.rpc('add_branch_user_safe', {
      p_business_id: currentBusinessId,
      p_branch_id: selectedBranch,
      p_username: fullUsername,
      p_access_code: accessCode.trim(),
      p_name: staffName.trim()
    })

    if (error) {
      alert("Error al registrar personal: " + error.message)
    } else {
      alert(`¡Personal asignado con éxito! Usuario: ${fullUsername}`)
      setUsername('')
      setAccessCode('')
      setStaffName('')
      fetchStaff()
    }
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
        p_image_url: imageUrl
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
        p_image_url: imageUrl
      })

      if (error) alert("Error al agregar: " + error.message)
      else {
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
    setImageFile(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setPrice('')
    setStock('')
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

  // --- NUEVA FUNCIÓN PARA DAR DE BAJA UNA SUCURSAL ---
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
    <div className="min-h-screen bg-[#0f172a] p-8 text-white">
      <div className="max-w-5xl mx-auto">
        <header className="bg-[#1e293b] shadow rounded-lg p-6 flex justify-between items-center mb-8 border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel de Control POS</h1>
            <p className="text-sm text-slate-400">Conectado como: {userEmail}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => router.push('/pos')} className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-500 transition-colors font-semibold shadow">🛒 Punto de Venta (POS)</button>
            <button onClick={() => router.push('/reportes')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition-colors font-semibold shadow">📊 Reportes</button>
            {isAdmin && <button onClick={() => router.push('/admin')} className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors font-semibold">Admin</button>}
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-500 transition-colors font-semibold">Cerrar Sesión</button>
          </div>
        </header>
        
        {/* Sucursales */}
        <div className="bg-[#1e293b] p-6 rounded-lg shadow mb-6 space-y-4 border border-slate-700">
          <div className="flex items-center gap-4">
            <label className="font-bold text-slate-300 w-36">Sucursal Activa:</label>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded flex-1 text-white">
              {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-4 border-t border-slate-700 pt-4">
            <label className="font-bold text-slate-300 w-36">Nueva Sucursal:</label>
            <input placeholder="Ej. Ferreteria Zona 6" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded flex-1 text-white" />
            <button onClick={addBranch} className="bg-emerald-600 text-white px-4 py-2 rounded font-semibold hover:bg-emerald-500">Crear Sucursal</button>
          </div>

          {/* Listado de Sucursales Existentes con Opción de Dar de Baja */}
          {branches.length > 0 && (
            <div className="border-t border-slate-700 pt-4 mt-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Sucursales Registradas y Gestión</h3>
              <div className="space-y-2">
                {branches.map(b => (
                  <div key={b.id} className="flex justify-between items-center bg-[#0f172a] p-3 rounded border border-slate-700">
                    <span className="text-sm font-semibold text-emerald-400">{b.name}</span>
                    <button 
                      onClick={() => deleteBranch(b.id, b.name)}
                      className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                    >
                      Dar de Baja
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Asignar Personal a Sucursal (Con Usuario y Contraseña) */}
        <div className="bg-[#1e293b] p-6 rounded-lg shadow mb-8 border border-slate-700">
          <h2 className="text-lg font-bold text-emerald-400 mb-1">Asignar Personal a Sucursal</h2>
          <p className="text-xs text-slate-400 mb-4">El sistema generará el usuario con el prefijo: <span className="text-amber-400 font-mono">{businessNemonico}-</span></p>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <input placeholder="Nombre (Ej. Nancy Oliva)" value={staffName} onChange={e => setStaffName(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded text-white text-sm" />
            
            <div className="flex items-center bg-[#0f172a] border border-slate-600 rounded overflow-hidden">
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-2.5 font-mono border-r border-slate-600">{businessNemonico}-</span>
              <input placeholder="usuario" value={username} onChange={e => setUsername(e.target.value)} className="bg-transparent p-2 text-white text-sm flex-1 outline-none" />
            </div>

            <input placeholder="Código de Acceso" type="password" value={accessCode} onChange={e => setAccessCode(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded text-white text-sm" />
            
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded text-white text-sm">
              {branches.length === 0 ? <option value="">No hay sucursales</option> : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <button onClick={addStaff} className="bg-emerald-600 text-white p-2 rounded font-semibold hover:bg-emerald-500 text-sm">Asignar Empleado</button>
          </div>

          {/* Tabla de Personal Asignado */}
          {staffList.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-700 text-slate-300">
                  <tr>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Usuario de Acceso</th>
                    <th className="p-3">Sucursal Asignada</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => {
                    const branchObj = branches.find(b => b.id === s.branch_id)
                    return (
                      <tr key={s.id} className="border-b border-slate-700">
                        <td className="p-3 font-semibold">{s.name}</td>
                        <td className="p-3 text-amber-300 font-mono">{s.username}</td>
                        <td className="p-3 text-emerald-400">{branchObj ? branchObj.name : 'Sucursal'}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => deleteStaff(s.id)} className="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">Quitar</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulario Productos (Crear / Editar) */}
        <div className={`p-6 rounded-lg shadow mb-8 grid grid-cols-1 md:grid-cols-5 gap-4 items-end border ${editingId ? 'bg-amber-950/40 border-amber-500/50' : 'bg-[#1e293b] border-slate-700'}`}>
          <div className="col-span-full">
            <h3 className={`font-bold text-sm ${editingId ? 'text-amber-400' : 'text-emerald-400'}`}>
              {editingId ? '✏️ Editando Producto Existente' : '➕ Agregar Nuevo Producto'}
            </h3>
          </div>
          <input placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded text-white" />
          <input placeholder="Precio" type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded text-white" />
          <input placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} className="bg-[#0f172a] border border-slate-600 p-2 rounded text-white" />
          <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-xs text-slate-400 file:bg-slate-700 file:text-white file:border-0 file:p-2 file:rounded" />
          
          <div className="flex gap-2">
            <button onClick={handleSaveProduct} className={`flex-1 p-2 rounded font-semibold text-white shadow ${editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
              {editingId ? 'Actualizar' : 'Agregar'}
            </button>
            {editingId && (
              <button onClick={cancelEdit} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded font-semibold text-white text-xs">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Productos */}
        <div className="bg-[#1e293b] rounded-lg shadow overflow-hidden border border-slate-700">
          <table className="w-full text-left">
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
                      <button onClick={() => startEdit(p)} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded text-xs font-semibold shadow">Editar / Foto</button>
                      <button onClick={() => deleteProduct(p.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-semibold shadow">Quitar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}