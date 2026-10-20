import { useState, useEffect } from 'react';

export default function Cooperativas() {
  const [cooperativas, setCooperativas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({
    nombre: '',
    ruc: '',
    telefono: '',
    email: '',
    direccion: '',
    logo_url: ''
  });
  const [idEdicion, setIdEdicion] = useState(null);

  const API_URL = 'http://localhost:3000/api/cooperativas';

  const cargarCooperativas = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCooperativas(data);
      }
    } catch (err) {
      console.error('Error al cargar cooperativas:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCooperativas();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const url = idEdicion ? `${API_URL}/${idEdicion}` : API_URL;
    const method = idEdicion ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setForm({ nombre: '', ruc: '', telefono: '', email: '', direccion: '', logo_url: '' });
        setIdEdicion(null);
        cargarCooperativas();
      } else {
        alert('Error al guardar la cooperativa');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleEditar = (item) => {
    setIdEdicion(item.id);
    setForm({
      nombre: item.nombre || '',
      ruc: item.ruc || '',
      telefono: item.telefono || '',
      email: item.email || '',
      direccion: item.direccion || '',
      logo_url: item.logo_url || ''
    });
  };

  const toggleEstado = async (id, estadoActual) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/${id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activa: !estadoActual })
      });

      if (res.ok) {
        cargarCooperativas();
      }
    } catch (err) {
      console.error('Error al cambiar estado:', err);
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Administración de Cooperativas</h2>

      {/* Formulario */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-primary text-white">
          <h5 className="card-title mb-0">
            {idEdicion ? 'Editar Cooperativa' : 'Registrar Nueva Cooperativa'}
          </h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Nombre de la Cooperativa</label>
              <input
                type="text"
                name="nombre"
                className="form-control"
                value={form.nombre}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">RUC</label>
              <input
                type="text"
                name="ruc"
                className="form-control"
                value={form.ruc}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                name="telefono"
                className="form-control"
                value={form.telefono}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">URL del Logo</label>
              <input
                type="text"
                name="logo_url"
                className="form-control"
                value={form.logo_url}
                onChange={handleChange}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Dirección</label>
              <input
                type="text"
                name="direccion"
                className="form-control"
                value={form.direccion}
                onChange={handleChange}
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-success me-2">
                {idEdicion ? 'Actualizar' : 'Guardar'}
              </button>
              {idEdicion && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIdEdicion(null);
                    setForm({ nombre: '', ruc: '', telefono: '', email: '', direccion: '', logo_url: '' });
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Tabla */}
      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="card-title mb-3">Listado de Cooperativas</h5>
          {cargando ? (
            <p>Cargando registros...</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>RUC</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cooperativas.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.nombre}</td>
                      <td>{item.ruc}</td>
                      <td>{item.telefono || 'N/A'}</td>
                      <td>{item.email || 'N/A'}</td>
                      <td>
                        <span className={`badge ${item.activa ? 'bg-success' : 'bg-danger'}`}>
                          {item.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => handleEditar(item)}
                        >
                          Editar
                        </button>
                        <button
                          className={`btn btn-sm ${item.activa ? 'btn-outline-warning' : 'btn-outline-success'}`}
                          onClick={() => toggleEstado(item.id, item.activa)}
                        >
                          {item.activa ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cooperativas.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-3">
                        No hay cooperativas registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}