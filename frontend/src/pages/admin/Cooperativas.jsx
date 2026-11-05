import { useState, useEffect } from 'react';
import api from '../../services/api.js';

const FORM_VACIO = { nombre: '', ruc: '', telefono: '', email: '', direccion: '', logo_url: '' };

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor';
}

export default function Cooperativas() {
  const [cooperativas, setCooperativas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [idEdicion, setIdEdicion] = useState(null);

  const cargarCooperativas = () =>
    api.get('/cooperativas')
      .then(({ data }) => setCooperativas(data))
      .catch((err) => console.error('Error al cargar cooperativas:', mensajeDeError(err)))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargarCooperativas();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (idEdicion) {
        await api.put(`/cooperativas/${idEdicion}`, form);
      } else {
        await api.post('/cooperativas', form);
      }
      setForm(FORM_VACIO);
      setIdEdicion(null);
      cargarCooperativas();
    } catch (err) {
      const detalles = err.response?.data?.detalles;
      const lista = detalles ? '\n- ' + Object.values(detalles).join('\n- ') : '';
      alert(mensajeDeError(err) + lista);
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
    try {
      await api.patch(`/cooperativas/${id}/estado`, { activa: !estadoActual });
      cargarCooperativas();
    } catch (err) {
      alert(mensajeDeError(err));
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